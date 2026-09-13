// sync-service.js
// Handles real-time Firestore synchronization using a modular document-per-collection layout,
// automated background auth, explicit connection/error notifications, and self-hosted server image uploads.

(function () {
  const isFirebaseConfigured =
    window.FIREBASE_CONFIG &&
    window.FIREBASE_CONFIG.apiKey &&
    window.FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";

  let statusBadge = null;
  let errorBanner = null;

  const KEY_TO_DOC = {
    "weddingTracker.budget": "budget",
    "weddingTracker.budgetGoal": "budgetGoal",
    "weddingTracker.vendors": "vendors",
    "weddingTracker.timeline": "timeline",
    "weddingTracker.stationary": "stationary",
    "weddingTracker.gifts": "gifts",
    "weddingTracker.thriftStore": "thriftStore",
    "weddingTracker.guests": "guests",
    "weddingTracker.brainDump": "brainDump",
  };

  const DOC_TO_KEY = Object.fromEntries(
    Object.entries(KEY_TO_DOC).map(([k, doc]) => [doc, k])
  );

  function ensureStatusUI() {
    if (document.getElementById("sync-status-badge")) return;

    statusBadge = document.createElement("div");
    statusBadge.id = "sync-status-badge";
    statusBadge.className = "sync-status-badge connecting";
    statusBadge.innerHTML = `<span class="sync-dot"></span><span id="sync-status-text">Verbinden met Firestore...</span>`;
    document.body.appendChild(statusBadge);
  }

  function setStatus(state, message) {
    ensureStatusUI();
    statusBadge.className = `sync-status-badge ${state}`;
    const textEl = document.getElementById("sync-status-text");
    if (textEl) textEl.textContent = message;
  }

  function showCriticalError(title, message) {
    ensureStatusUI();
    setStatus("error", "Firestore Fout");

    if (!errorBanner) {
      errorBanner = document.createElement("div");
      errorBanner.id = "sync-error-banner";
      errorBanner.className = "sync-error-banner";
      document.body.appendChild(errorBanner);
    }

    errorBanner.innerHTML = `
      <div>
        <strong>⚠️ ${title}:</strong> ${message}
      </div>
      <button type="button" onclick="location.reload()">Opnieuw proberen</button>
    `;
    errorBanner.style.display = "flex";
  }

  function hideCriticalError() {
    if (errorBanner) {
      errorBanner.style.display = "none";
    }
  }

  // --- Self-hosted Image Upload Helper ---
  window.uploadImageToServer = async function (file) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Uploaden mislukt." }));
      throw new Error(err.error || `Server gaf foutcode ${response.status}`);
    }

    return await response.json(); // { url: "/uploads/...", filename: "..." }
  };

  // --- Initialize Firestore if configured ---
  if (!isFirebaseConfigured) {
    document.addEventListener("DOMContentLoaded", () => {
      ensureStatusUI();
      setStatus(
        "connecting",
        "Lokale modus (vul firebase-config.js in voor live sync)"
      );
    });
    return;
  }

  // Load Firebase App SDK
  const appScript = document.createElement("script");
  appScript.src = "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js";

  appScript.onload = () => {
    // Load Firebase Auth and Firestore SDKs
    const authScript = document.createElement("script");
    authScript.src = "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js";

    authScript.onload = () => {
      const firestoreScript = document.createElement("script");
      firestoreScript.src = "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js";

      firestoreScript.onload = async () => {
        try {
          if (!firebase.apps.length) {
            firebase.initializeApp(window.FIREBASE_CONFIG);
          }

          const auth = firebase.auth();
          const db = firebase.firestore();

          ensureStatusUI();

          // Seamless background sign-in (compatible with Authentik SSO at proxy level)
          if (!auth.currentUser) {
            try {
              await auth.signInAnonymously();
            } catch (authErr) {
              console.warn("Firebase anonymous auth note:", authErr);
            }
          }

          const collectionRef = db.collection("weddingTracker");

          const lastSyncedHash = {};

          // Real-time listener across all modular documents in weddingTracker collection
          collectionRef.onSnapshot(
            (snapshot) => {
              hideCriticalError();
              setStatus("connected", "Firestore Verbonden");

              snapshot.forEach((doc) => {
                const docId = doc.id;
                const storageKey = DOC_TO_KEY[docId] || `weddingTracker.${docId}`;
                const data = doc.data();
                const value = data && Object.prototype.hasOwnProperty.call(data, "value")
                  ? data.value
                  : data;

                window.STATE_CACHE = window.STATE_CACHE || {};
                window.STATE_CACHE[storageKey] = value;
                lastSyncedHash[storageKey] = JSON.stringify(value);
              });

              window.dispatchEvent(new CustomEvent("wedding-data-synced"));
            },
            (error) => {
              console.error("Firestore sync error:", error);
              showCriticalError(
                "Firestore Verbindingsfout",
                `Kon niet synchroniseren (${error.message || error.code}). Wijzigingen worden NIET opgeslagen!`
              );
            }
          );

          // Modular per-section saver (only writes if value has actually changed)
          window.saveToFirestore = async function (key, value) {
            try {
              const strVal = JSON.stringify(value);
              if (lastSyncedHash[key] === strVal) {
                return; // Exact same data as already in Firestore, skip write to prevent loop!
              }
              lastSyncedHash[key] = strVal;

              const docName = KEY_TO_DOC[key] || key.replace(/^weddingTracker\./, "");
              const docRef = collectionRef.doc(docName);
              await docRef.set({
                value: value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              });
              hideCriticalError();
              setStatus("connected", "Firestore Verbonden");
            } catch (err) {
              console.error("Firestore save error:", err);
              showCriticalError(
                "Firestore Opslaan Mislukt",
                `Wijzigingen voor '${key}' zijn NIET gesynchroniseerd naar Firestore! Fout: ${err.message}`
              );
              throw err;
            }
          };

          // Batch saver for full JSON backups into individual documents
          window.saveFullStateToFirestore = async function (fullState) {
            try {
              const batch = db.batch();

              Object.entries(fullState).forEach(([key, value]) => {
                const docName = KEY_TO_DOC[key] || key.replace(/^weddingTracker\./, "");
                const docRef = collectionRef.doc(docName);
                batch.set(docRef, {
                  value: value,
                  updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
              });

              await batch.commit();
              hideCriticalError();
              setStatus("connected", "Firestore Verbonden");
            } catch (err) {
              console.error("Firestore backup batch error:", err);
              showCriticalError(
                "Firestore Backup Opslaan Mislukt",
                `Kon backup niet naar Firestore schrijven! Fout: ${err.message}`
              );
              throw err;
            }
          };
        } catch (err) {
          console.error("Firebase init error:", err);
          showCriticalError("Firebase Initialisatiefout", err.message);
        }
      };

      firestoreScript.onerror = () => {
        showCriticalError("Netwerkfout", "Kon Firestore bibliotheek niet inladen vanaf CDN.");
      };

      document.head.appendChild(firestoreScript);
    };

    authScript.onerror = () => {
      showCriticalError("Netwerkfout", "Kon Firebase Auth bibliotheek niet inladen vanaf CDN.");
    };

    document.head.appendChild(authScript);
  };

  appScript.onerror = () => {
    showCriticalError("Netwerkfout", "Kon Firebase bibliotheek niet inladen vanaf CDN.");
  };

  document.head.appendChild(appScript);
})();
