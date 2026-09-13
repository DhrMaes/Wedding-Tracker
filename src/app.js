const STORAGE_KEYS = {
  budget: "weddingTracker.budget",
  budgetGoal: "weddingTracker.budgetGoal",
  vendors: "weddingTracker.vendors",
  timeline: "weddingTracker.timeline",
  stationary: "weddingTracker.stationary",
  gifts: "weddingTracker.gifts",
  thriftStore: "weddingTracker.thriftStore",
  guests: "weddingTracker.guests",
  brainDump: "weddingTracker.brainDump",
};

const GUEST_PARTS = [
  { key: "gemeentehuis", label: "Gemeentehuis" },
  { key: "ceremonie", label: "Ceremonie" },
  { key: "receptie", label: "Receptie" },
  { key: "catering", label: "Catering" },
  { key: "dansfeest", label: "Dansfeest" },
];

// Basiscategorieën die altijd meetellen in de teller op het dashboard.
const CORE_VENDOR_CATEGORIES = [
  "Fotograaf",
  "Catering",
  "Sanitair",
  "DJ / muziek / band",
  "Tent & overkapping",
  "Verhuur meubels",
  "Bloemen / florist",
  "Haar & make-up",
];

const DEFAULT_BUDGET_GOAL = 8000;

const DONUT_COLORS = [
  "#f09721",
  "#c2cca8",
  "#2d3930",
  "#fdd08d",
  "#7d9b7a",
  "#c0562a",
  "#9aa88a",
  "#e0b15f",
  "#5b6f5f",
  "#d9d3bd",
];

const defaultTimeline = [
  { title: "Budget en gastenlijst bepalen", date: "", note: "12 maanden op voorhand" },
  { title: "Locatie vastleggen", date: "", note: "10 maanden op voorhand" },
  { title: "Belangrijke leveranciers kiezen", date: "", note: "8 maanden op voorhand" },
];

const currency = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function readJson(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  if (key === STORAGE_KEYS.thriftStore) {
    updateThriftStoreBudget(value);
  }
}

function updateThriftStoreBudget(entries = readJson(STORAGE_KEYS.thriftStore)) {
  const total = entries.reduce((sum, entry) => sum + (Number(entry.cost) || 0), 0);
  const rows = readJson(STORAGE_KEYS.budget);
  const row = rows.find((entry) => entry.source === "thrift-store");

  if (row) {
    row.actual = total;
    row.paid = true;
  } else {
    rows.push({
      id: uid(),
      name: "Kringwinkel koopjes",
      category: "Kringwinkel",
      actual: total,
      paid: true,
      source: "thrift-store",
    });
  }

  localStorage.setItem(STORAGE_KEYS.budget, JSON.stringify(rows));
}

async function compressImage(dataUrl) {
  if (!String(dataUrl || "").startsWith("data:image/")) {
    return dataUrl;
  }

  const image = new Image();
  image.src = dataUrl;
  await image.decode();

  const maxDimension = 500;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fffdf7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.65);
}

async function lightenBlackImageBackground(dataUrl) {
  if (!String(dataUrl || "").startsWith("data:image/")) {
    return dataUrl;
  }

  const image = new Image();
  image.src = dataUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const seen = new Uint8Array(canvas.width * canvas.height);
  const queue = [];
  const addIfBlack = (x, y) => {
    const index = y * canvas.width + x;
    const pixel = index * 4;
    if (seen[index] || pixels.data[pixel] > 28 || pixels.data[pixel + 1] > 28 || pixels.data[pixel + 2] > 28) {
      return;
    }
    seen[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < canvas.width; x += 1) {
    addIfBlack(x, 0);
    addIfBlack(x, canvas.height - 1);
  }
  for (let y = 0; y < canvas.height; y += 1) {
    addIfBlack(0, y);
    addIfBlack(canvas.width - 1, y);
  }

  while (queue.length) {
    const index = queue.pop();
    const pixel = index * 4;
    pixels.data[pixel] = 255;
    pixels.data[pixel + 1] = 253;
    pixels.data[pixel + 2] = 247;
    const x = index % canvas.width;
    const y = Math.floor(index / canvas.width);
    if (x > 0) addIfBlack(x - 1, y);
    if (x < canvas.width - 1) addIfBlack(x + 1, y);
    if (y > 0) addIfBlack(x, y - 1);
    if (y < canvas.height - 1) addIfBlack(x, y + 1);
  }

  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function compressStoredThriftImages() {
  const entries = readJson(STORAGE_KEYS.thriftStore);
  if (!entries.some((entry) => String(entry.image || "").length > 150000)) {
    return;
  }

  Promise.all(entries.map(async (entry) => ({ ...entry, image: await compressImage(entry.image) })))
    .then((compressedEntries) => saveJson(STORAGE_KEYS.thriftStore, compressedEntries))
    .catch((error) => console.error("Foto's verkleinen mislukt:", error));
}

function lightenStoredThriftImages() {
  const entries = readJson(STORAGE_KEYS.thriftStore);
  const needsUpdate = entries.some((entry) => String(entry.image || "").startsWith("data:image/jpeg"));
  if (!needsUpdate || localStorage.getItem("weddingTracker.lightenedImageBackgrounds")) {
    return;
  }

  Promise.all(entries.map(async (entry) => ({ ...entry, image: await lightenBlackImageBackground(entry.image) })))
    .then((updatedEntries) => {
      saveJson(STORAGE_KEYS.thriftStore, updatedEntries);
      localStorage.setItem("weddingTracker.lightenedImageBackgrounds", "true");
    })
    .catch((error) => console.error("Fotoachtergronden aanpassen mislukt:", error));
}

function initBackupExport() {
  const exportButton = document.getElementById("export-backup");
  const importInput = document.getElementById("import-backup");
  if (!exportButton || !(importInput instanceof HTMLInputElement)) {
    return;
  }

  exportButton.addEventListener("click", () => {
    const backup = Object.fromEntries(
      Object.entries(STORAGE_KEYS).map(([name, key]) => [name, readJson(key)]),
    );
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `wedding-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file || !confirm("Je huidige gegevens in deze browser worden vervangen. Doorgaan?")) {
      importInput.value = "";
      return;
    }

    try {
      const backup = JSON.parse(await file.text());
      const isValid = Object.keys(STORAGE_KEYS).every((name) => Object.prototype.hasOwnProperty.call(backup, name));
      if (!isValid) {
        throw new Error("Dit is geen geldige Wedding Tracker-backup.");
      }

      const thriftEntries = Array.isArray(backup.thriftStore)
        ? await Promise.all(
            backup.thriftStore.map(async (entry) => ({ ...entry, image: await compressImage(entry.image) })),
          )
        : [];

      Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
        localStorage.setItem(key, JSON.stringify(name === "thriftStore" ? thriftEntries : backup[name]));
      });
      localStorage.removeItem("weddingTracker.lightenedImageBackgrounds");
      updateThriftStoreBudget(thriftEntries);
      location.reload();
    } catch (error) {
      alert(error.message || "De backup kon niet worden teruggezet.");
      importInput.value = "";
    }
  });
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
}

// Alleen http(s) doorlaten zodat javascript:-links niet uitvoerbaar zijn.
function safeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function removeById(key, id) {
  const rows = readJson(key);
  saveJson(
    key,
    rows.filter((row) => row.id !== id),
  );
}

function formatDate(dateString) {
  if (!dateString) {
    return "geen datum";
  }

  try {
    return new Intl.DateTimeFormat("nl-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

function getCountdownText(targetDateString) {
  const target = new Date(`${targetDateString}T00:00:00`);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "Vandaag is jullie dag!";
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.ceil(totalHours / 24);
  return `${days} dagen`;
}

// Elke zaterdag vanaf morgen telt als een weekend.
function countWeekendsUntil(targetDateString) {
  const target = new Date(`${targetDateString}T00:00:00`);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);

  let weekends = 0;
  while (cursor <= target) {
    if (cursor.getDay() === 6) {
      weekends += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return weekends;
}

function initBudgetPage() {
  const form = document.getElementById("budget-form");
  const tableBody = document.getElementById("budget-table-body");
  const actualTotal = document.getElementById("actual-total");
  const paidTotal = document.getElementById("paid-total");
  const unpaidTotal = document.getElementById("unpaid-total");

  if (!form || !tableBody || !actualTotal || !paidTotal || !unpaidTotal) {
    return;
  }

  const render = () => {
    const rows = readJson(STORAGE_KEYS.budget);
    tableBody.innerHTML = "";

    let actual = 0;
    let paid = 0;

    rows.forEach((row) => {
      const name = row.name || "(zonder naam)";
      const isThriftStoreTotal = row.source === "thrift-store";
      actual += Number(row.actual) || 0;
      paid += row.paid ? Number(row.actual) || 0 : 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(row.category)}</td>
        <td>${currency.format(row.actual || 0)}</td>
        <td>
          <label class="checkbox-line">
            <input data-toggle-budget-paid="${row.id}" type="checkbox" ${row.paid ? "checked" : ""} ${isThriftStoreTotal ? "disabled" : ""} />
            <span class="chip ${row.paid ? "chip-paid" : "chip-unpaid"}">${row.paid ? "Al betaald" : "Nog niet"}</span>
          </label>
        </td>
        <td class="table-actions">
          ${
            isThriftStoreTotal
              ? ""
              : `<button class="icon-btn edit" data-edit-budget="${row.id}" type="button" aria-label="Budgetlijn bewerken">✎</button>
          <button class="icon-btn delete" data-remove-budget="${row.id}" type="button" aria-label="Budgetlijn verwijderen">🗑</button>`
          }
        </td>
      `;
      tableBody.appendChild(tr);
    });

    actualTotal.textContent = currency.format(actual);
    paidTotal.textContent = currency.format(paid);
    unpaidTotal.textContent = currency.format(actual - paid);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);

    const item = {
      id: uid(),
      name: String(data.get("name") || "").trim(),
      category: String(data.get("category") || "").trim(),
      actual: Number(data.get("actual") || 0),
      paid: Boolean(data.get("paid")),
    };

    if (!item.name || !item.category) {
      return;
    }

    const rows = readJson(STORAGE_KEYS.budget);
    rows.push(item);
    saveJson(STORAGE_KEYS.budget, rows);
    form.reset();
    render();
  });

  const togglePaidById = (toggleId) => {
    const rows = readJson(STORAGE_KEYS.budget);
    const row = rows.find((entry) => entry.id === toggleId);
    if (row) {
      row.paid = !row.paid;
    }
    saveJson(STORAGE_KEYS.budget, rows);
    render();
  };

  tableBody.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const toggleId = target.dataset.toggleBudgetPaid;
    if (!toggleId) {
      return;
    }

    togglePaidById(toggleId);
  });

  tableBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const editId = target.dataset.editBudget;
    const id = target.dataset.removeBudget;

    if (editId) {
      const rows = readJson(STORAGE_KEYS.budget);
      const row = rows.find((entry) => entry.id === editId);
      if (!row) {
        return;
      }

      const name = window.prompt("Naam:", row.name || "");
      if (name === null) {
        return;
      }

      const category = window.prompt("Categorie:", row.category || "");
      if (category === null) {
        return;
      }

      const actual = window.prompt("Bedrag (EUR):", String(row.actual || 0));
      if (actual === null) {
        return;
      }

      row.name = name.trim() || row.name || "(zonder naam)";
      row.category = category.trim() || row.category;
      row.actual = Number(actual) || 0;

      saveJson(STORAGE_KEYS.budget, rows);
      render();
      return;
    }

    if (id) {
      removeById(STORAGE_KEYS.budget, id);
      render();
    }
  });

  render();
}

function initVendorsPage() {
  const form = document.getElementById("vendor-form");
  const list = document.getElementById("vendors-list");
  const pickedList = document.getElementById("vendors-picked-list");
  const categorySelect = document.getElementById("category-select");

  if (!form || !list || !pickedList) {
    return;
  }

  const normalizePicked = (vendors) => {
    const seen = new Set();
    vendors.forEach((vendor) => {
      vendor.picked = Boolean(vendor.picked);
      const categoryKey = String(vendor.category || "Overig").toLowerCase();
      if (vendor.picked) {
        if (seen.has(categoryKey)) {
          vendor.picked = false;
        } else {
          seen.add(categoryKey);
        }
      }
    });
    return vendors;
  };

  const submitButton = form.querySelector("button[type='submit']");
  const cancelButton = document.getElementById("vendor-cancel-edit");
  const formTitle = document.getElementById("vendor-form-title");
  let editingId = null;

  const stopEditing = () => {
    editingId = null;
    form.reset();
    if (submitButton) {
      submitButton.textContent = "Toevoegen";
    }
    if (formTitle) {
      formTitle.textContent = "Nieuwe leverancier";
    }
    if (cancelButton) {
      cancelButton.classList.add("is-hidden");
    }
  };

  const startEditing = (row) => {
    editingId = row.id;
    form.elements.name.value = row.name || "";
    form.elements.category.value = row.category || "";
    form.elements.contact.value = row.contact || "";
    form.elements.quote.value = String(row.quote || 0);
    form.elements.status.value = row.status || "To review";

    if (submitButton) {
      submitButton.textContent = "Bijwerken";
    }
    if (formTitle) {
      formTitle.textContent = `Bewerken: ${row.name}`;
    }
    if (cancelButton) {
      cancelButton.classList.remove("is-hidden");
    }

    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.name.focus();
  };

  if (cancelButton) {
    cancelButton.addEventListener("click", stopEditing);
  }

  const updateCategoryFilter = (vendors) => {
    if (!categorySelect) return;
    
    const categories = new Set();
    vendors.forEach((vendor) => {
      categories.add(vendor.category || "Overig");
    });
    
    const currentValue = categorySelect.value;
    const options = categorySelect.querySelectorAll("option:not(:first-child)");
    options.forEach(opt => opt.remove());
    
    [...categories]
      .sort((a, b) => a.localeCompare(b, "nl"))
      .forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
      });
    
    categorySelect.value = currentValue;
  };

  const render = () => {
    const vendors = normalizePicked(readJson(STORAGE_KEYS.vendors));
    saveJson(STORAGE_KEYS.vendors, vendors);
    
    updateCategoryFilter(vendors);
    
    list.innerHTML = "";
    pickedList.innerHTML = "";

    const pickedByCategory = new Map();
    vendors.forEach((vendor) => {
      if (vendor.picked) {
        pickedByCategory.set(vendor.category, vendor);
      }
    });

    if (!pickedByCategory.size) {
      pickedList.innerHTML = "<p>Nog geen categorie gekozen.</p>";
    } else {
      pickedByCategory.forEach((vendor, category) => {
        const card = document.createElement("article");
        card.className = "vendor-card";
        card.innerHTML = `
          <div>
            <strong>${escapeHtml(category)}</strong>
            <p class="vendor-meta">${escapeHtml(vendor.name)}</p>
            <p class="vendor-meta">Offerte: ${currency.format(vendor.quote || 0)}</p>
          </div>
        `;
        pickedList.appendChild(card);
      });
    }

    if (!vendors.length) {
      list.innerHTML = "<p>Nog geen leveranciers toegevoegd.</p>";
      return;
    }

    const selectedCategory = categorySelect ? categorySelect.value : "";
    const filteredVendors = selectedCategory 
      ? vendors.filter(v => (v.category || "Overig") === selectedCategory)
      : vendors;

    const byCategory = new Map();
    filteredVendors.forEach((vendor) => {
      const category = vendor.category || "Overig";
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category).push(vendor);
    });

    [...byCategory.keys()]
      .sort((a, b) => a.localeCompare(b, "nl"))
      .forEach((category) => {
        const group = document.createElement("section");
        group.className = "vendor-group";

        const entries = byCategory
          .get(category)
          .slice()
          .sort((a, b) => (Number(a.quote) || 0) - (Number(b.quote) || 0));

        const hasWinner = entries.some((vendor) => vendor.picked);
        group.innerHTML = `
          <header class="vendor-group-head">
            <h3>${escapeHtml(category)}</h3>
            <span class="chip ${hasWinner ? "chip-picked" : "chip-unpaid"}">${
              hasWinner ? "Gekozen" : `${entries.length} offerte(s)`
            }</span>
          </header>
        `;

        entries.forEach((vendor) => {
          const card = document.createElement("article");
          card.className = `vendor-card ${vendor.picked ? "is-winner" : ""}`;
          card.innerHTML = `
            <div>
              <strong>${escapeHtml(vendor.name)}</strong>
              <p class="vendor-meta">${escapeHtml(vendor.contact || "geen contact")}</p>
              <p class="vendor-meta">Offerte: ${currency.format(vendor.quote || 0)}</p>
              <span class="chip ${vendor.picked ? "chip-picked" : ""}">${
                vendor.picked ? "Gekozen" : escapeHtml(vendor.status)
              }</span>
            </div>
            <div class="item-actions">
              <button class="icon-btn" data-pick-vendor="${vendor.id}" type="button" aria-label="Kies leverancier voor categorie">★</button>
              <button class="icon-btn edit" data-edit-vendor="${vendor.id}" type="button" aria-label="Leverancier bewerken">✎</button>
              <button class="icon-btn delete" data-remove-vendor="${vendor.id}" type="button" aria-label="Leverancier verwijderen">🗑</button>
            </div>
          `;
          group.appendChild(card);
        });

        list.appendChild(group);
      });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const values = {
      name: String(data.get("name") || "").trim(),
      category: String(data.get("category") || "Overig").trim(),
      contact: String(data.get("contact") || "").trim(),
      quote: Number(data.get("quote") || 0),
      status: String(data.get("status") || "To review"),
    };

    if (!values.name || !values.category) {
      return;
    }

    const rows = readJson(STORAGE_KEYS.vendors);

    if (editingId) {
      const row = rows.find((entry) => entry.id === editingId);
      if (row) {
        Object.assign(row, values);
        if (row.picked) {
          rows.forEach((entry) => {
            if (entry.id !== row.id && entry.category === row.category) {
              entry.picked = false;
            }
          });
        }
      }
    } else {
      rows.push({ id: uid(), ...values, picked: false });
    }

    saveJson(STORAGE_KEYS.vendors, rows);
    stopEditing();
    render();
  });

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const editId = target.dataset.editVendor;
    const pickId = target.dataset.pickVendor;
    const id = target.dataset.removeVendor;

    if (pickId) {
      const rows = readJson(STORAGE_KEYS.vendors);
      const pickedVendor = rows.find((entry) => entry.id === pickId);
      if (!pickedVendor) {
        return;
      }

      const isAlreadyPicked = Boolean(pickedVendor.picked);
      rows.forEach((entry) => {
        if (entry.category === pickedVendor.category) {
          entry.picked = false;
        }
      });
      pickedVendor.picked = !isAlreadyPicked;

      saveJson(STORAGE_KEYS.vendors, rows);
      render();
      return;
    }

    if (editId) {
      const rows = readJson(STORAGE_KEYS.vendors);
      const row = rows.find((entry) => entry.id === editId);
      if (row) {
        startEditing(row);
      }
      return;
    }

    if (!id) {
      return;
    }

    if (editingId === id) {
      stopEditing();
    }

    removeById(STORAGE_KEYS.vendors, id);
    render();
  });

  if (categorySelect) {
    categorySelect.addEventListener("change", () => {
      render();
    });
  }

  render();
}

function initPlanningTimelinePage() {
  const form = document.getElementById("timeline-form");
  const list = document.getElementById("timeline-list");

  if (!form || !list) {
    return;
  }

  const render = () => {
    let events = readJson(STORAGE_KEYS.timeline);
    if (!events.length) {
      events = defaultTimeline.map((entry) => ({ id: uid(), ...entry }));
      saveJson(STORAGE_KEYS.timeline, events);
    }

    list.innerHTML = "";

    events
      .slice()
      .sort((a, b) => String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99")))
      .forEach((entry) => {
        const li = document.createElement("li");
        li.className = "timeline-item";
        li.innerHTML = `
          <strong>${escapeHtml(entry.title)}</strong>
          <p class="task-meta">${formatDate(entry.date)}${entry.note ? ` | ${escapeHtml(entry.note)}` : ""}</p>
          <div class="item-actions">
            <button class="icon-btn edit" data-edit-timeline="${entry.id}" type="button" aria-label="Mijlpaal bewerken">✎</button>
            <button class="icon-btn delete" data-remove-timeline="${entry.id}" type="button" aria-label="Mijlpaal verwijderen">🗑</button>
          </div>
        `;
        list.appendChild(li);
      });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const item = {
      id: uid(),
      title: String(data.get("title") || "").trim(),
      date: String(data.get("date") || ""),
      note: String(data.get("note") || "").trim(),
    };

    if (!item.title || !item.date) {
      return;
    }

    const rows = readJson(STORAGE_KEYS.timeline);
    rows.push(item);
    saveJson(STORAGE_KEYS.timeline, rows);
    form.reset();
    render();
  });

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const editId = target.dataset.editTimeline;
    const id = target.dataset.removeTimeline;

    if (editId) {
      const rows = readJson(STORAGE_KEYS.timeline);
      const row = rows.find((entry) => entry.id === editId);
      if (!row) {
        return;
      }

      const title = window.prompt("Titel:", row.title || "");
      if (title === null) {
        return;
      }

      const date = window.prompt("Datum (YYYY-MM-DD):", row.date || "");
      if (date === null) {
        return;
      }

      const note = window.prompt("Notitie:", row.note || "");
      if (note === null) {
        return;
      }

      row.title = title.trim() || row.title;
      row.date = date.trim() || row.date;
      row.note = note.trim();
      saveJson(STORAGE_KEYS.timeline, rows);
      render();
      return;
    }

    if (!id) {
      return;
    }

    removeById(STORAGE_KEYS.timeline, id);
    render();
  });

  render();
}

function initIdeasPage() {
  const form = document.getElementById("ideas-form");
  const list = document.getElementById("ideas-list");
  const keyName = document.body.dataset.ideasKey;
  const emptyText = document.body.dataset.emptyText || "Nog geen items toegevoegd.";

  if (!form || !list || !keyName || !(keyName in STORAGE_KEYS)) {
    return;
  }

  const storageKey = STORAGE_KEYS[keyName];

  const render = () => {
    const rows = readJson(storageKey);
    list.innerHTML = "";

    rows.forEach((row) => {
      const card = document.createElement("article");
      card.className = "vendor-card";
      card.innerHTML = `
        <div>
          <strong>${escapeHtml(row.title)}</strong>
          <p class="vendor-meta">${escapeHtml(row.note || "geen notitie")}</p>
        </div>
        <div class="item-actions">
          <button class="icon-btn edit" data-edit-idea="${row.id}" type="button" aria-label="Item bewerken">✎</button>
          <button class="icon-btn delete" data-remove-idea="${row.id}" type="button" aria-label="Item verwijderen">🗑</button>
        </div>
      `;
      list.appendChild(card);
    });

    if (!rows.length) {
      list.innerHTML = `<p>${emptyText}</p>`;
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const item = {
      id: uid(),
      title: String(data.get("title") || "").trim(),
      note: String(data.get("note") || "").trim(),
    };

    if (!item.title) {
      return;
    }

    const rows = readJson(storageKey);
    rows.push(item);
    saveJson(storageKey, rows);
    form.reset();
    render();
  });

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const editId = target.dataset.editIdea;
    const id = target.dataset.removeIdea;

    if (editId) {
      const rows = readJson(storageKey);
      const row = rows.find((entry) => entry.id === editId);
      if (!row) {
        return;
      }

      const title = window.prompt("Titel:", row.title || "");
      if (title === null) {
        return;
      }

      const note = window.prompt("Notitie:", row.note || "");
      if (note === null) {
        return;
      }

      row.title = title.trim() || row.title;
      row.note = note.trim();
      saveJson(storageKey, rows);
      render();
      return;
    }

    if (!id) {
      return;
    }

    removeById(storageKey, id);
    render();
  });

  render();
}

function initStationaryPage() {
  const form = document.getElementById("stationary-form");
  const list = document.getElementById("stationary-list");

  if (!form || !list) {
    return;
  }

  const render = () => {
    const rows = readJson(STORAGE_KEYS.stationary);
    list.innerHTML = "";

    if (!rows.length) {
      list.innerHTML = "<p>Nog geen ontwerpen toegevoegd.</p>";
      return;
    }

    rows.forEach((row) => {
      const url = safeUrl(row.url);
      const image = safeUrl(row.image);

      const card = document.createElement("article");
      card.className = "preview-card";
      card.innerHTML = `
        ${
          image
            ? `<img class="preview-image" src="${escapeHtml(image)}" alt="Preview van ${escapeHtml(row.title)}" loading="lazy" />`
            : `<div class="preview-image preview-placeholder">geen preview</div>`
        }
        <div class="preview-body">
          <strong>${escapeHtml(row.title)}</strong>
          ${row.category ? `<span class="chip">${escapeHtml(row.category)}</span>` : ""}
          <p class="vendor-meta">${escapeHtml(row.note || "geen notitie")}</p>
          ${
            url
              ? `<a class="preview-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open link</a>`
              : ""
          }
        </div>
        <div class="item-actions">
          <button class="icon-btn edit" data-edit-stationary="${row.id}" type="button" aria-label="Ontwerp bewerken">✎</button>
          <button class="icon-btn delete" data-remove-stationary="${row.id}" type="button" aria-label="Ontwerp verwijderen">🗑</button>
        </div>
      `;
      list.appendChild(card);
    });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const item = {
      id: uid(),
      title: String(data.get("title") || "").trim(),
      url: String(data.get("url") || "").trim(),
      image: String(data.get("image") || "").trim(),
      category: String(data.get("category") || "").trim(),
      note: String(data.get("note") || "").trim(),
    };

    if (!item.title) {
      return;
    }

    const rows = readJson(STORAGE_KEYS.stationary);
    rows.push(item);
    saveJson(STORAGE_KEYS.stationary, rows);
    form.reset();
    render();
  });

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const editId = target.dataset.editStationary;
    const id = target.dataset.removeStationary;

    if (editId) {
      const rows = readJson(STORAGE_KEYS.stationary);
      const row = rows.find((entry) => entry.id === editId);
      if (!row) {
        return;
      }

      const title = window.prompt("Titel:", row.title || "");
      if (title === null) {
        return;
      }

      const url = window.prompt("Link:", row.url || "");
      if (url === null) {
        return;
      }

      const image = window.prompt("Preview afbeelding (URL):", row.image || "");
      if (image === null) {
        return;
      }

      const category = window.prompt("Type:", row.category || "");
      if (category === null) {
        return;
      }

      const note = window.prompt("Notitie:", row.note || "");
      if (note === null) {
        return;
      }

      row.title = title.trim() || row.title;
      row.url = url.trim();
      row.image = image.trim();
      row.category = category.trim();
      row.note = note.trim();

      saveJson(STORAGE_KEYS.stationary, rows);
      render();
      return;
    }

    if (id) {
      removeById(STORAGE_KEYS.stationary, id);
      render();
    }
  });

  render();
}

function initGuestsPage() {
  const form = document.getElementById("guest-form");
  const tableBody = document.getElementById("guest-table-body");
  const countEl = document.getElementById("guest-count");
  const submitButton = form?.querySelector("button[type='submit']");
  const cancelButton = document.getElementById("guest-cancel-edit");
  const formTitle = document.getElementById("guest-form-title");
  let editingId = null;

  if (!form || !tableBody || !countEl) {
    return;
  }

  const stopEditing = () => {
    editingId = null;
    form.reset();
    if (submitButton) submitButton.textContent = "Toevoegen";
    if (formTitle) formTitle.textContent = "Nieuwe gast";
    if (cancelButton) cancelButton.classList.add("is-hidden");
  };

  const startEditing = (row) => {
    editingId = row.id;
    form.elements.name.value = row.name || "";
    form.elements.group.value = row.group || "";
    form.elements.note.value = row.note || "";
    form.elements.getuige.checked = Boolean(row.getuige);
    GUEST_PARTS.forEach((part) => {
      form.elements[part.key].checked = Boolean(row[part.key]);
    });
    if (submitButton) submitButton.textContent = "Bijwerken";
    if (formTitle) formTitle.textContent = `Bewerken: ${row.name || "gast"}`;
    if (cancelButton) cancelButton.classList.remove("is-hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.name.focus();
  };

  if (cancelButton) cancelButton.addEventListener("click", stopEditing);

  const render = () => {
    const rows = readJson(STORAGE_KEYS.guests);
    tableBody.innerHTML = "";

    const totals = {};
    GUEST_PARTS.forEach((part) => {
      totals[part.key] = 0;
    });

    rows.forEach((row) => {
      GUEST_PARTS.forEach((part) => {
        if (row[part.key]) {
          totals[part.key] += 1;
        }
      });
    });

    const byGroup = new Map();
    rows.forEach((row) => {
      const group = row.group || "Zonder groep";
      if (!byGroup.has(group)) {
        byGroup.set(group, []);
      }
      byGroup.get(group).push(row);
    });

    const groupOrder = [
      "Vrienden bruid",
      "Vrienden bruidegom",
      "Familie bruid",
      "Familie bruidegom",
      "Collega's",
      "Buren",
    ];
    const groupNames = [...byGroup.keys()].sort((a, b) => {
      if (a === "Zonder groep") return 1;
      if (b === "Zonder groep") return -1;
      const aIndex = groupOrder.indexOf(a);
      const bIndex = groupOrder.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return a.localeCompare(b, "nl");
    });

    groupNames.forEach((group) => {
      const entries = byGroup.get(group).slice().sort((a, b) => {
        if (Boolean(a.getuige) !== Boolean(b.getuige)) {
          return a.getuige ? -1 : 1;
        }
        return a.name.localeCompare(b.name, "nl");
      });

      const headerRow = document.createElement("tr");
      headerRow.className = "group-row";
      headerRow.innerHTML = `
        <th colspan="${GUEST_PARTS.length + 2}">
          ${escapeHtml(group)} <span class="group-count">${entries.length}</span>
        </th>
      `;
      tableBody.appendChild(headerRow);

      entries.forEach((row) => {
        const tr = document.createElement("tr");
        const checkboxes = GUEST_PARTS.map(
          (part) => `
            <td class="cell-check">
              <input data-guest-toggle="${row.id}" data-guest-part="${part.key}" type="checkbox" ${row[part.key] ? "checked" : ""} aria-label="${part.label}" />
            </td>
          `,
        ).join("");

        tr.innerHTML = `
          <td>
            <strong>${escapeHtml(row.name)}${row.getuige ? ' <span class="guest-witness" title="Getuige" aria-label="Getuige">💍</span>' : ""}</strong>
            ${row.note ? `<p class="task-meta">${escapeHtml(row.note)}</p>` : ""}
          </td>
          ${checkboxes}
          <td class="table-actions">
            <button class="icon-btn edit" data-edit-guest="${row.id}" type="button" aria-label="Gast bewerken">✎</button>
            <button class="icon-btn delete" data-remove-guest="${row.id}" type="button" aria-label="Gast verwijderen">🗑</button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
    });

    countEl.textContent = String(rows.length);
    GUEST_PARTS.forEach((part) => {
      const el = document.getElementById(`guest-${part.key}`);
      if (el) {
        el.textContent = `${totals[part.key]}/${rows.length}`;
      }
    });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const values = {
      name: String(data.get("name") || "").trim(),
      group: String(data.get("group") || "").trim(),
      note: String(data.get("note") || "").trim(),
      getuige: Boolean(data.get("getuige")),
    };

    GUEST_PARTS.forEach((part) => {
      values[part.key] = Boolean(data.get(part.key));
    });

    if (!values.name) {
      return;
    }

    const rows = readJson(STORAGE_KEYS.guests);
    if (editingId) {
      const row = rows.find((entry) => entry.id === editingId);
      if (row) Object.assign(row, values);
    } else {
      rows.push({ id: uid(), ...values });
    }
    saveJson(STORAGE_KEYS.guests, rows);
    stopEditing();
    render();
  });

  tableBody.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const guestId = target.dataset.guestToggle;
    const part = target.dataset.guestPart;
    if (!guestId || !part) {
      return;
    }

    const rows = readJson(STORAGE_KEYS.guests);
    const row = rows.find((entry) => entry.id === guestId);
    if (row) {
      row[part] = target.checked;
      saveJson(STORAGE_KEYS.guests, rows);
    }
    render();
  });

  tableBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const editId = target.dataset.editGuest;
    const id = target.dataset.removeGuest;

    if (editId) {
      const rows = readJson(STORAGE_KEYS.guests);
      const row = rows.find((entry) => entry.id === editId);
      if (!row) {
        return;
      }

      startEditing(row);
      return;
    }

    if (id) {
      removeById(STORAGE_KEYS.guests, id);
      render();
    }
  });

  render();
}

function initBrainDumpPage() {
  const text = document.getElementById("brain-dump-text");
  const saved = document.getElementById("brain-dump-saved");

  if (!text || !saved) {
    return;
  }

  const existing = readJson(STORAGE_KEYS.brainDump, { text: "", updatedAt: "" });
  text.value = existing.text || "";
  saved.textContent = existing.updatedAt
    ? `Laatst opgeslagen op ${existing.updatedAt}`
    : "Nog niet opgeslagen.";

  text.addEventListener("input", () => {
    const now = new Intl.DateTimeFormat("nl-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    saveJson(STORAGE_KEYS.brainDump, {
      text: text.value,
      updatedAt: now,
    });

    saved.textContent = `Laatst opgeslagen op ${now}`;
  });
}

function initDashboardPage() {
  const budgetPaid = document.getElementById("budget-paid");
  const countdownDisplay = document.getElementById("countdown-display");

  if (!budgetPaid || !countdownDisplay) {
    return;
  }

  const budgetRows = readJson(STORAGE_KEYS.budget);
  const vendorRows = readJson(STORAGE_KEYS.vendors);
  const guestRows = readJson(STORAGE_KEYS.guests);
  const timelineRows = readJson(STORAGE_KEYS.timeline);

  const actual = budgetRows.reduce((sum, row) => sum + (Number(row.actual) || 0), 0);
  const paid = budgetRows.reduce((sum, row) => sum + (row.paid ? Number(row.actual) || 0 : 0), 0);

  budgetPaid.textContent = currency.format(paid);

  countdownDisplay.textContent = getCountdownText("2027-07-02");
  const countdownSub = document.getElementById("countdown-sub");
  if (countdownSub) {
    const weekends = countWeekendsUntil("2027-07-02");
    countdownSub.textContent = `Dat zijn nog ${weekends} weekends.`;
  }

  const guestTotal = document.getElementById("guest-total");
  if (guestTotal) {
    guestTotal.textContent = String(guestRows.length);
  }

  const categories = new Set(CORE_VENDOR_CATEGORIES);
  vendorRows.forEach((vendor) => categories.add(vendor.category || "Overig"));
  const pickedCategories = new Set(
    vendorRows.filter((vendor) => vendor.picked).map((vendor) => vendor.category || "Overig"),
  );

  const vendorPickedCount = document.getElementById("vendor-picked-count");
  if (vendorPickedCount) {
    vendorPickedCount.textContent = `${pickedCategories.size}/${categories.size}`;
  }

  const goalInput = document.getElementById("budget-goal-input");
  const goalBar = document.getElementById("budget-goal-bar");
  const goalText = document.getElementById("budget-goal-text");
  if (goalInput instanceof HTMLInputElement && goalBar && goalText) {
    const stored = readJson(STORAGE_KEYS.budgetGoal, { amount: DEFAULT_BUDGET_GOAL });
    const startAmount = Number(stored.amount) || DEFAULT_BUDGET_GOAL;
    goalInput.value = String(startAmount);

    const renderGoal = () => {
      const goal = Number(goalInput.value) || 0;
      if (!goal) {
        goalBar.style.width = "0%";
        goalText.textContent = "Stel een streefbudget in om je voortgang te zien.";
        return;
      }

      const ratio = Math.min(100, Math.round((actual / goal) * 100));
      goalBar.style.width = `${ratio}%`;
      goalBar.classList.toggle("over-budget", actual > goal);
      goalText.textContent =
        actual > goal
          ? `${currency.format(actual - goal)} over budget (${ratio}% van ${currency.format(goal)}).`
          : `${currency.format(actual)} van ${currency.format(goal)} gebruikt. Nog ${currency.format(goal - actual)} beschikbaar.`;
    };

    goalInput.addEventListener("input", () => {
      saveJson(STORAGE_KEYS.budgetGoal, { amount: Number(goalInput.value) || 0 });
      renderGoal();
    });

    saveJson(STORAGE_KEYS.budgetGoal, { amount: startAmount });
    renderGoal();
  }

  renderBudgetDonut(budgetRows, actual);

  const milestones = document.getElementById("upcoming-milestones");
  if (milestones) {
    const today = new Date().toISOString().slice(0, 10);
    const next = timelineRows
      .filter((entry) => entry.date && entry.date >= today)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 3);

    milestones.innerHTML = next.length
      ? next
          .map(
            (entry, index) => `
              <li class="milestone ${index === 0 ? "is-next" : "is-later"}">
                <span class="milestone-dot"></span>
                <div>
                  <strong>${escapeHtml(entry.title)}</strong>
                  <p class="task-meta">${formatDate(entry.date)}${entry.note ? ` | ${escapeHtml(entry.note)}` : ""}</p>
                </div>
              </li>
            `,
          )
          .join("")
      : "<li>Nog geen mijlpalen ingepland.</li>";
  }
}

function renderBudgetDonut(budgetRows, actual) {
  const legend = document.getElementById("budget-by-category");
  const segments = document.getElementById("budget-donut-segments");
  const totalLabel = document.getElementById("budget-donut-total");

  if (!legend || !segments || !totalLabel) {
    return;
  }

  const totals = new Map();
  budgetRows.forEach((row) => {
    const category = row.category || "Overig";
    totals.set(category, (totals.get(category) || 0) + (Number(row.actual) || 0));
  });

  const sorted = [...totals.entries()].filter(([, sum]) => sum > 0).sort((a, b) => b[1] - a[1]);
  segments.innerHTML = "";
  totalLabel.textContent = currency.format(actual);

  if (!sorted.length || !actual) {
    legend.innerHTML = "<li>Nog geen budgetlijnen toegevoegd.</li>";
    return;
  }

  // De ring heeft omtrek 100, dus percentages zijn meteen bruikbaar als dash-lengte.
  let offset = 25;
  legend.innerHTML = "";

  sorted.forEach(([category, sum], index) => {
    const share = (sum / actual) * 100;
    const color = DONUT_COLORS[index % DONUT_COLORS.length];

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "donut-segment");
    circle.setAttribute("cx", "21");
    circle.setAttribute("cy", "21");
    circle.setAttribute("r", "15.915");
    circle.setAttribute("stroke", color);
    circle.setAttribute("stroke-dasharray", `${share} ${100 - share}`);
    circle.setAttribute("stroke-dashoffset", String(offset));
    segments.appendChild(circle);
    offset = (offset - share + 100) % 100;

    const li = document.createElement("li");
    li.innerHTML = `
      <span class="legend-dot" style="background:${color}"></span>
      <span class="legend-label">${escapeHtml(category)}</span>
      <span class="legend-value">${currency.format(sum)} (${Math.round(share)}%)</span>
    `;
    legend.appendChild(li);
  });
}

function initThriftStorePage() {
  const form = document.getElementById("thrift-form");
  const list = document.getElementById("thrift-list");
  const summary = document.getElementById("thrift-summary");
  const cancelButton = document.getElementById("thrift-cancel-edit");
  const formTitle = document.getElementById("thrift-form-title");
  const imagePreview = document.getElementById("thrift-image-preview");
  const submitButton = form?.querySelector("button[type='submit']");
  let editingId = null;
  let currentImage = "";

  if (!form || !list || !summary) {
    return;
  }

  const showPreview = (src) => {
    if (!imagePreview) return;
    if (src) {
      imagePreview.src = src;
      imagePreview.classList.remove("is-hidden");
    } else {
      imagePreview.src = "";
      imagePreview.classList.add("is-hidden");
    }
  };

  const stopEditing = () => {
    editingId = null;
    currentImage = "";
    form.reset();
    form.elements.quantity.value = "1";
    form.elements.cost.value = "0";
    if (submitButton) submitButton.textContent = "Toevoegen";
    if (formTitle) formTitle.textContent = "Nieuw koopje";
    if (cancelButton) cancelButton.classList.add("is-hidden");
    showPreview("");
  };

  const startEditing = (entry) => {
    editingId = entry.id;
    currentImage = entry.image || "";
    form.elements.category.value = entry.category || "";
    form.elements.quantity.value = String(entry.quantity || 1);
    form.elements.cost.value = String(entry.cost || 0);
    form.elements.image.value = "";
    if (submitButton) submitButton.textContent = "Bijwerken";
    if (formTitle) formTitle.textContent = `Bewerken: ${entry.category || "koopje"}`;
    if (cancelButton) cancelButton.classList.remove("is-hidden");
    showPreview(currentImage);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.category.focus();
  };

  form.elements.image?.addEventListener("change", () => {
    const file = form.elements.image.files[0];
    if (!file) {
      showPreview(currentImage);
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => showPreview(reader.result));
    reader.readAsDataURL(file);
  });

  const render = () => {
    const entries = readJson(STORAGE_KEYS.thriftStore);
    const totals = new Map();
    let totalQuantity = 0;
    let totalCost = 0;

    entries.forEach((entry) => {
      const category = entry.category || "Overig";
      const quantity = Number(entry.quantity) || 0;
      const cost = Number(entry.cost) || 0;
      const categoryTotal = totals.get(category) || { quantity: 0, cost: 0 };
      categoryTotal.quantity += quantity;
      categoryTotal.cost += cost;
      totals.set(category, categoryTotal);
      totalQuantity += quantity;
      totalCost += cost;
    });

    summary.innerHTML = `
      <article class="stat-card">
        <h2>Totaal items</h2>
        <p class="stat-value">${totalQuantity}</p>
      </article>
      <article class="stat-card">
        <h2>Totaal uitgegeven</h2>
        <p class="stat-value">${currency.format(totalCost)}</p>
      </article>
    `;

    list.innerHTML = "";
    if (!entries.length) {
      list.innerHTML = "<p>Nog geen kringwinkelkoopjes toegevoegd.</p>";
      return;
    }

    [...totals.keys()]
      .sort((a, b) => a.localeCompare(b, "nl"))
      .forEach((category) => {
        const categoryEntries = entries.filter((entry) => (entry.category || "Overig") === category);
        const categoryTotal = totals.get(category);
        const group = document.createElement("section");
        group.className = "vendor-group";
        group.innerHTML = `
          <header class="vendor-group-head">
            <h3>${escapeHtml(category)}</h3>
            <span class="chip chip-picked">${categoryTotal.quantity} stuks | ${currency.format(categoryTotal.cost)}</span>
          </header>
        `;

        const cards = document.createElement("div");
        cards.className = "thrift-card-grid";

        categoryEntries.forEach((entry) => {
          const image = String(entry.image || "");
          const imageMarkup = image.startsWith("data:image/")
            ? `<img class="thrift-image" src="${escapeHtml(image)}" alt="Kringwinkelkoopje in ${escapeHtml(category)}" loading="lazy" />`
            : `<div class="thrift-image thrift-image-placeholder">geen foto</div>`;
          const card = document.createElement("article");
          card.className = "vendor-card thrift-card";
          card.innerHTML = `
            ${imageMarkup}
            <div>
              <p class="vendor-meta">${Number(entry.quantity) || 0} stuks</p>
              <p class="vendor-meta">Totale kost: ${currency.format(Number(entry.cost) || 0)}</p>
            </div>
            <div class="item-actions">
              <button class="icon-btn edit" data-edit-thrift="${entry.id}" type="button" aria-label="Koopje bewerken">✎</button>
              <button class="icon-btn delete" data-remove-thrift="${entry.id}" type="button" aria-label="Koopje verwijderen">🗑</button>
            </div>
          `;
          cards.appendChild(card);
        });

        group.appendChild(cards);
        list.appendChild(group);
      });
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const entries = readJson(STORAGE_KEYS.thriftStore);
    const currentEntry = entries.find((item) => item.id === editingId);
    const imageFile = form.elements.image.files[0];

    if (!editingId && !imageFile) {
      form.elements.image.setCustomValidity("Kies een foto voor dit koopje.");
      form.reportValidity();
      return;
    }

    form.elements.image.setCustomValidity("");
    const image = imageFile
      ? await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => resolve(reader.result));
          reader.addEventListener("error", reject);
          reader.readAsDataURL(imageFile);
        })
      : currentEntry?.image || "";
    const values = {
      image: await compressImage(image),
      category: String(data.get("category") || "Overig").trim(),
      quantity: Number(data.get("quantity") || 0),
      cost: Number(data.get("cost") || 0),
    };

    if (!values.image || !values.category || values.quantity < 1 || values.cost < 0) {
      return;
    }

    if (editingId) {
      const entry = entries.find((item) => item.id === editingId);
      if (entry) Object.assign(entry, values);
    } else {
      entries.push({ id: uid(), ...values });
    }

    saveJson(STORAGE_KEYS.thriftStore, entries);
    stopEditing();
    render();
  });

  if (cancelButton) cancelButton.addEventListener("click", stopEditing);

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const editId = target.dataset.editThrift;
    const removeId = target.dataset.removeThrift;
    const entries = readJson(STORAGE_KEYS.thriftStore);

    if (editId) {
      const entry = entries.find((item) => item.id === editId);
      if (entry) startEditing(entry);
      return;
    }

    if (removeId) {
      if (editingId === removeId) stopEditing();
      saveJson(STORAGE_KEYS.thriftStore, entries.filter((item) => item.id !== removeId));
      render();
    }
  });

  render();
}

function init() {
  const page = document.body.dataset.page;
  compressStoredThriftImages();
  lightenStoredThriftImages();
  updateThriftStoreBudget();
  initBackupExport();

  if (page === "budget") {
    initBudgetPage();
  }

  if (page === "vendors") {
    initVendorsPage();
  }

  if (page === "guests") {
    initGuestsPage();
  }

  if (page === "planning-timeline") {
    initPlanningTimelinePage();
  }

  if (page === "stationary") {
    initStationaryPage();
  }

  if (page === "gifts") {
    initIdeasPage();
  }

  if (page === "thrift-store") {
    initThriftStorePage();
  }

  if (page === "brain-dump") {
    initBrainDumpPage();
  }

  if (page === "dashboard") {
    initDashboardPage();
  }

}

init();
