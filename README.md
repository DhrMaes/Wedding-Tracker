# 🌿 Wedding Tracker — *Once Upon A Forever* 💍✨

> *"A love story written in the trees."* 🌲✨

A bespoke, aesthetic, and completely vibe-coded wedding planning dashboard crafted to take the stress out of wedding prep and replace it with calm, organized romance.

---

## ✨ The Vibe

Built with an earthy, warm botanical aesthetic inspired by woodland romance, golden-hour light, and cozy thrift-store adventures.

- 🌿 **Color Palette**: Deep Forest Green (`#2D3930`), Soft Sage (`#C2CCA8`), Warm Apricot (`#F09721`), Soft Blush (`#FDD08D`), and Creamy Linen (`#EFE9D7`).
- ✍️ **Typography**: Classical *Cinzel Decorative*, timeless *Marcellus*, and whimsical *Allura* accents.
- 🧘 **Mood**: Calming, mindful, stress-free, and delightfully organized.

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
| 💾 **Backup & Restore** | 1-click JSON export and import to keep your wedding planning data safe and portable forever. |

---

## 🛠️ Tech Stack & Philosophy

- **100% Vanilla Web**: Pure HTML5, modern CSS3 (Custom Properties, CSS Grid, Glassmorphism, smooth micro-interactions), and vanilla JavaScript.
- **Zero Build Step**: No `npm install`, no bundlers, no framework bloat. Just double-click and plan.
- **Privacy-First & Offline-Ready**: Everything is stored locally in your browser’s `localStorage`. No cloud trackers, no database leaks, no monthly subscription fees.
- **Data Portability**: Full JSON backup and restore with a single click right from the dashboard.

---

## 🚀 Getting Started

### Option 1: Direct in Browser
Simply open [`src/app.html`](src/app.html) directly in any web browser.

### Option 2: Local Static Server (Recommended)
If you prefer running via a lightweight local server:

```bash
# Using npx serve
npx serve src

# Or using Python 3
python -m http.server 8000 --directory src
```
Then navigate to `http://localhost:8000/app.html` or `http://localhost:3000/app.html`.

---

## 📁 Project Structure

```text
Wedding-Tracker/
├── README.md                  # You are here! 🌿
└── src/
    ├── app.html               # Main Dashboard & summary overview
    ├── app.js                 # Complete app state & localStorage logic
    ├── styles.css             # Botanical aesthetic styling & design tokens
    ├── planning-timeline.html # Milestone & planning timeline
    ├── budget.html            # Detailed budget manager & breakdown
    ├── vendors.html           # Vendor selection & quotes
    ├── kringwinkel-koopjes.html # Thrift store & DIY decor tracker
    ├── gasten.html            # Guest list with multi-event RSVP tracking
    ├── stationary.html        # Stationery & invitation tracker
    ├── bedankjes.html         # Wedding favor planning
    ├── brain-dump.html        # Brainstorming & aesthetic notes
    └── checklist.html         # Quick task checklist
```

---

## 🤍 Crafted with Love

> *“Grow old along with me! The best is yet to be.”* — Robert Browning
