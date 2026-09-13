# 🌿 Wedding Tracker — *Once Upon A Forever* 💍✨

> *"A love story written in the trees."* 🌲✨

A bespoke, aesthetic, and completely vibe-coded wedding planning dashboard crafted to take the stress out of wedding prep and replace it with calm, organized romance.

---

## ✨ The Vibe & Architecture

Built with an earthy, warm botanical aesthetic inspired by woodland romance, golden-hour light, and cozy thrift-store adventures.

- 🌿 **Color Palette**: Deep Forest Green (`#2D3930`), Soft Sage (`#C2CCA8`), Warm Apricot (`#F09721`), Soft Blush (`#FDD08D`), and Creamy Linen (`#EFE9D7`).
- ✍️ **Typography**: Classical *Cinzel Decorative*, timeless *Marcellus*, and whimsical *Allura* accents.
- 🧘 **Mood**: Calming, mindful, stress-free, and delightfully organized.
- ⚡ **Clean Separation**: 
  - **`src/WeddingTracker.App`**: Pure HTML/CSS/JS where your partner can vibe-code the frontend effortlessly.
  - **`src/WeddingTracker.Server`**: Fast, lightweight C# ASP.NET Core (.NET 10) backend for self-hosting static assets and image uploads.
  - **🔥 Firebase Firestore**: Real-time cross-device data synchronization with **explicit connection/error notifications** (no silent, desynchronized fallbacks).

---

## 🌸 Key Features

| Module | Description |
| :--- | :--- |
| 📊 **Dashboard & Countdown** | Live countdown timer to the big day, quick stats, target budget progress bar, interactive SVG donut chart for category spending, and upcoming milestones. |
| 💰 **Budget & Expenses** | Track projected vs. actual expenses, paid amounts, pending balances, and category breakdowns. Auto-syncs with thrift finds. |
| 🏺 **Kringwinkel Koopjes** | Dedicated tracker for thrift store decor, vintage glassware, secondhand treasures, and DIY gems. Purchases automatically roll up into the wedding budget! |
| 👥 **Gastenlijst (Guest Manager)** | Granular attendance tracking across all day parts (*Gemeentehuis*, *Ceremonie*, *Receptie*, *Catering*, *Dansfeest*), RSVP status, dietary notes, and plus-ones. |
| 🤝 **Leveranciers (Vendors)** | Vendor shortlists, contact cards, status tracking (contacted, quoted, booked), deposit records, and notes for all essential categories. |
| 🗓️ **Planning & Timeline** | Month-by-month milestone checklist with countdowns to keep planning smooth and on schedule. |
| 💌 **Stationary & Drukwerk** | Track save-the-dates, official invitations, place cards, signage, and printing statuses. |
| 🎁 **Bedankjes (Favors)** | Plan guest favors, sample ideas, quantity requirements, and packaging notes. |
| 💡 **Brain Dump** | A freeform creative whiteboard for sudden 2 AM inspirations, aesthetic mood notes, and reminders. |
| 🖼️ **Self-Hosted Image Uploads** | High-resolution image uploads hosted directly on your server via `POST /api/upload`. |
| 💾 **Backup & Restore** | 1-click JSON export and import to keep your wedding planning data safe and portable forever. |

---

## 🛠️ Tech Stack & Philosophy

- **Frontend**: Pure HTML5, modern CSS3 (Custom Properties, CSS Grid, Glassmorphism, smooth micro-interactions), and vanilla JavaScript.
- **Backend Service**: C# (.NET 10 / ASP.NET Core) serving static assets and handling secure multipart image uploads into a persistent volume.
- **Data Layer**: Cloud Firestore for seamless real-time syncing between devices, paired with an explicit visual connection/error banner.
- **Deployment**: Automated via GitHub Actions building to GitHub Container Registry (`ghcr.io`) and deploying to Portainer over WireGuard VPN.

---

## 🚀 Getting Started & Local Development

### 1. Configure Firebase (Optional for Local Offline Mode)
Open [`src/WeddingTracker.App/firebase-config.js`](src/WeddingTracker.App/firebase-config.js) and fill in your Firebase project credentials. If left empty, the app runs in local offline mode.

### 2. Run the .NET Server
```bash
# From the repository root
dotnet run --project src/WeddingTracker.Server
```
Open `http://localhost:8095/app.html` in your browser.

### 3. Run with Docker Compose
```bash
docker compose up --build
```

---

## 📁 Project Structure

```text
Wedding-Tracker/
├── .github/
│   └── workflows/
│       └── docker.yml               # GitHub Actions: build & Portainer deploy via WireGuard
├── Dockerfile                        # Multi-stage .NET 10 Alpine build & runtime
├── docker-compose.yml                # Docker Compose with persistent uploads volume
├── WeddingTracker.slnx               # .NET Solution
├── README.md                         # Project documentation
└── src/
    ├── WeddingTracker.App/          # 🌸 Girlfriend's Vibe-Coding Workspace
    │   ├── app.html                 # Main Dashboard & summary overview
    │   ├── app.js                   # Complete app state & UI logic
    │   ├── firebase-config.js       # Firebase credentials configuration
    │   ├── sync-service.js          # Firestore live sync & explicit error banners
    │   ├── styles.css               # Botanical aesthetic styling & design tokens
    │   ├── planning-timeline.html   # Milestone & planning timeline
    │   ├── budget.html              # Detailed budget manager & breakdown
    │   ├── vendors.html             # Vendor selection & quotes
    │   ├── kringwinkel-koopjes.html # Thrift store & DIY decor tracker
    │   ├── gasten.html              # Guest list with multi-event RSVP tracking
    │   ├── stationary.html          # Stationery & invitation tracker
    │   ├── bedankjes.html           # Wedding favor planning
    │   ├── brain-dump.html          # Brainstorming & aesthetic notes
    │   └── checklist.html           # Quick task checklist
    │
    └── WeddingTracker.Server/       # ⚡ C# ASP.NET Core Backend
        ├── Program.cs               # Static file server, /api/upload & /health
        ├── appsettings.json         # Server & uploads directory configuration
        └── WeddingTracker.Server.csproj # .NET 10 Web Project
```

---

## 🤍 Crafted with Love

> *“Grow old along with me! The best is yet to be.”* — Robert Browning
