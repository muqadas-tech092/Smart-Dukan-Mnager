# Smart Dukaan Manager (web)

A fast, installable retail management app for small shops: point of sale, inventory,
customers, digital khata (credit ledger), expenses, reports and settings. English and
Urdu (right-to-left). Plain HTML, CSS and JavaScript, no build step, no server: it runs
entirely in the browser and keeps each shop's data on that shop's own device.

## Try it locally

Any static file server works. With Python installed:

```bash
python -m http.server 8080 --directory web
```

Then open http://localhost:8080. The first visit shows a one-minute setup wizard with an
option to load sample data.

## Deploy on GitHub Pages (free hosting)

1. Create a new repository on GitHub (for example `dukaan-app`).
2. Copy the contents of the `web/` folder into the repository root and push:

```bash
cd web
git init
git add .
git commit -m "Smart Dukaan Manager"
git branch -M main
git remote add origin https://github.com/<your-user>/dukaan-app.git
git push -u origin main
```

3. On GitHub open **Settings > Pages**, choose **Deploy from a branch**, branch `main`,
   folder `/ (root)`, and save.
4. After a minute the app is live at `https://<your-user>.github.io/dukaan-app/`.

Every later change is just `git add . && git commit -m "update" && git push`. Bump
`CACHE_VERSION` in `sw.js` and `version` in `config.js` with each release so installed
copies refresh their offline cache.

## Selling it to many shopkeepers

The app is white-label. There are two ways to hand it to a customer:

**One deployment, many shops.** Give every shopkeeper the same URL. Each of them runs
the setup wizard on their own phone or computer, and their products, sales and khata
stay in their own browser storage. Nothing is shared between devices or shops.

**One deployment per customer.** Fork or copy the repository for each customer and edit
`config.js` before pushing. This lets you set the product name, your company details,
the default theme colour and logo, currency, language, payment methods, expense
categories, enabled modules and the licence notice shown in Settings > About. Change
`storageKey` when two customers might open their apps on the same device.

Everything in `config.js` is documented inline. Shop owners can still change their shop
name, logo, primary colour, currency and language from **Settings** inside the app.

## Install as an app

The site ships a web app manifest and a service worker, so Chrome on Android and desktop
offers **Install app** (also available under Settings > Data & backup). Installed copies
open instantly and work offline; sales made offline are saved on the device.

## Data, backup and restore

Data is stored in the browser's IndexedDB (with a localStorage fallback) under the
configured `storageKey`. **Settings > Data & backup** downloads a JSON backup, restores
one, loads demo data or resets the device. Advise customers to download a backup
regularly, because clearing browser data or losing the device also clears the shop data.
A hosted database with login and multi-device sync is the natural next step if you want
to offer a premium plan; the store layer in `js/store.js` is the only file that would
need a remote backend.

## Project layout

| Path | Purpose |
|---|---|
| `index.html` | App shell: sidebar, top bar, view container, modal and toast roots |
| `config.js` | White-label configuration (edit per customer) |
| `css/app.css` | Design tokens, components, responsive and RTL rules |
| `js/store.js` | Data model, business rules (stock, khata, invoices, reports), persistence, demo seed |
| `js/ui.js` | Shared building blocks: formatting, modals, toasts, tables, CSV, invoices, printing |
| `js/charts.js` | Dependency-free SVG charts with hover tooltips |
| `js/i18n.js` | English and Urdu strings |
| `js/icons.js` | Embedded Lucide icon set (MIT) |
| `js/router.js` | Hash router (GitHub Pages friendly) |
| `js/views/*.js` | One module per screen, plus the onboarding wizard |
| `sw.js`, `manifest.webmanifest` | Offline cache and installability |
| `assets/` | Logo, product placeholder and empty-state illustrations |

## Customising further

- Colours: change `--primary` and friends at the top of `css/app.css`, or set
  `theme.primary` in `config.js`.
- Text: edit `js/i18n.js`; every string has an English and an Urdu entry.
- Modules: switch `features.*` off in `config.js` to hide a module for a cheaper plan.
- Receipts: `invoiceHTML` and `statementHTML` in `js/ui.js` render the printable documents.
