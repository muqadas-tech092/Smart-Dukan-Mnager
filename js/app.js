/* App shell: boots the store, applies branding, renders sidebar/top bar and routes to views. */
import { store } from "./store.js";
import { t, setLang, getLang } from "./i18n.js";
import { icon } from "./icons.js";
import { esc, initials, money, logoSrc, toast } from "./ui.js";
import { navigate, onRoute, parseRoute } from "./router.js";
import * as dashboard from "./views/dashboard.js";
import * as pos from "./views/pos.js";
import * as inventory from "./views/inventory.js";
import * as customers from "./views/customers.js";
import * as khata from "./views/khata.js";
import * as sales from "./views/sales.js";
import * as expenses from "./views/expenses.js";
import * as reports from "./views/reports.js";
import * as settings from "./views/settings.js";
import * as onboarding from "./views/onboarding.js";

const CFG = window.SDM_CONFIG || {};
const F = CFG.features || {};
const NAV = [
  ["dashboard", "nav.dashboard", "layout-dashboard", "nav.main", true],
  ["pos", "nav.pos", "shopping-cart", "nav.main", F.pos !== false],
  ["inventory", "nav.inventory", "package", "nav.manage", F.inventory !== false],
  ["customers", "nav.customers", "users", "nav.manage", F.customers !== false],
  ["khata", "nav.khata", "book-open", "nav.manage", F.khata !== false],
  ["sales", "nav.sales", "receipt", "nav.manage", F.sales !== false],
  ["expenses", "nav.expenses", "wallet", "nav.manage", F.expenses !== false],
  ["reports", "nav.reports", "chart-column", "nav.insights", F.reports !== false],
  ["settings", "nav.settings", "settings", "nav.insights", true],
].filter((n) => n[4]);
const VIEWS = { dashboard, pos, inventory, customers, khata, sales, expenses, reports, settings };
const BOTTOM = ["dashboard", "pos", "inventory", "khata"];

export const app = {
  store, t, navigate, icon, money,
  ui: {}, // per-view transient state (filters, pages)
  get page() { return parseRoute().page; },
  refresh() { route(parseRoute()); },
  applyTheme,
  setLanguage(l) { setLang(l); store.setSettings({ language: l }); renderShell(); route(parseRoute()); },
};

// ------------------------------------------------------------ theme
function hexToRgb(hex) { const m = hex.replace("#", "").match(/.{2}/g); return m ? m.map((h) => parseInt(h, 16)) : [8, 127, 91]; }
function mix(hex, amt) { const [r, g, b] = hexToRgb(hex); const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function applyTheme() {
  const th = CFG.theme || {}; const s = store.settings; const root = document.documentElement.style;
  const primary = s.primary_color || th.primary || "#087F5B";
  root.setProperty("--primary", primary); root.setProperty("--primary-dark", mix(primary, -0.18)); root.setProperty("--primary-soft", mix(primary, 0.88)); root.setProperty("--primary-softer", mix(primary, 0.94));
  root.setProperty("--green", primary); root.setProperty("--green-soft", mix(primary, 0.88));
  if (th.text) root.setProperty("--text", th.text); if (th.background) root.setProperty("--bg", th.background); if (th.radius) root.setProperty("--radius", th.radius);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", primary);
  document.title = s.shop_name ? `${s.shop_name} · ${CFG.productName || "Smart Dukaan Manager"}` : (CFG.productName || "Smart Dukaan Manager");
}

// ------------------------------------------------------------ shell
function renderShell() {
  const s = store.settings; const page = parseRoute().page;
  document.getElementById("brand").innerHTML = `<img src="${logoSrc()}" alt=""/><div><div class="name">${esc(s.shop_name || CFG.productName)}</div><div class="sub">${esc(CFG.productName || "")}</div></div>`;
  let sect = ""; let html = "";
  for (const [key, label, ic, section] of NAV) {
    if (section !== sect) { sect = section; html += `<div class="nav-section">${esc(t(section))}</div>`; }
    html += `<button type="button" class="nav-item ${page === key ? "active" : ""}" data-nav="${key}">${icon(ic, 18)}<span>${esc(t(label))}</span></button>`;
  }
  document.getElementById("nav").innerHTML = html;
  document.getElementById("sidebarFoot").innerHTML = `<b>${esc(s.owner_name || "")}</b>${esc(s.phone || "")}<br/><span class="faint">${esc(s.address || "")}</span>`;
  document.getElementById("collapseBtn").innerHTML = icon("chevrons-left", 16);
  document.getElementById("menuBtn").innerHTML = icon("menu", 18);
  document.getElementById("searchIcon").innerHTML = icon("search", 17);
  document.getElementById("globalSearch").placeholder = t("top.search");
  const today = new Date(); const dateStr = today.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  document.getElementById("topMeta").innerHTML = `${icon("store", 15)}<span class="shop">${esc(s.shop_name)}</span><span class="dot"></span>${icon("calendar", 15)}<span>${esc(dateStr)}</span>`;
  document.getElementById("profile").innerHTML = `<div class="who"><b>${esc(s.owner_name || "")}</b><span>${esc(t("top.owner"))}</span></div><div class="avatar">${esc(initials(s.owner_name || s.shop_name))}</div>`;
  document.querySelectorAll("#langSwitch button").forEach((b) => b.classList.toggle("active", b.dataset.lang === getLang()));
  document.getElementById("langSwitch").hidden = F.urdu === false;
  document.getElementById("bottomNav").innerHTML = BOTTOM.filter((k) => NAV.some((n) => n[0] === k)).map((k) => { const n = NAV.find((x) => x[0] === k); return `<button type="button" data-nav="${k}" class="${page === k ? "active" : ""}">${icon(n[2], 20)}<span>${esc(t(n[1]).split(" ")[0])}</span></button>`; }).join("") + `<button type="button" data-menu class="">${icon("menu", 20)}<span>${esc(t("nav.more"))}</span></button>`;
  renderNotifications();
}
function renderNotifications() {
  const notes = store.notifications(); const btn = document.getElementById("notifBtn");
  btn.innerHTML = `${icon("bell", 18)}${notes.length ? `<span class="count">${notes.length}</span>` : ""}`;
  const pop = document.getElementById("notifPop");
  pop.innerHTML = `<h4>${esc(t("top.notifications"))}</h4>` + (notes.length ? notes.map((n) => { const ic = n.kind === "low" ? "triangle-alert" : n.kind === "out" ? "circle-alert" : "hand-coins"; const text = n.kind === "credit" ? `${esc(t("cust.balance"))} ${money(n.amount)}` : n.kind === "out" ? esc(t("pos.out_of_stock")) : `${esc(t("inv.quantity"))}: ${esc(n.text)}`; return `<div class="notif" data-nav="${n.page}"><span class="ic-wrap tone-${n.kind}">${icon(ic, 16)}</span><div><b>${esc(n.title)}</b><span>${text}</span></div></div>`; }).join("") : `<div class="muted">${esc(t("top.no_notifications"))}</div>`);
}
function setActiveNav(page) { document.querySelectorAll("[data-nav]").forEach((b) => { if (b.classList.contains("nav-item") || b.closest("#bottomNav")) b.classList.toggle("active", b.dataset.nav === page); }); }

// ------------------------------------------------------------ routing
function route(r) {
  const view = document.getElementById("view");
  if (!store.state.setupDone) { onboarding.render(view, app); return; }
  const mod = VIEWS[r.page] && NAV.some((n) => n[0] === r.page) ? VIEWS[r.page] : dashboard;
  app.params = r.params; view.innerHTML = "";
  try { mod.render(view, app); } catch (e) { console.error(e); view.innerHTML = `<div class="card"><div class="alert error">${icon("circle-alert", 16)}<span>${esc(e.message || e)}</span></div></div>`; }
  setActiveNav(r.page); closeMenu();
  window.scrollTo({ top: 0 });
}
function closeMenu() { document.getElementById("app").classList.remove("menu-open"); }

// ------------------------------------------------------------ events
function bindShell() {
  const appEl = document.getElementById("app");
  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]"); if (nav) { navigate(nav.dataset.nav); document.getElementById("notifPop").hidden = true; return; }
    if (e.target.closest("[data-menu]") || e.target.closest("#menuBtn")) { appEl.classList.toggle("menu-open"); return; }
    if (e.target.closest("#backdrop")) { closeMenu(); return; }
    if (e.target.closest("#notifBtn")) { const p = document.getElementById("notifPop"); p.hidden = !p.hidden; return; }
    if (!e.target.closest(".notif-wrap")) document.getElementById("notifPop").hidden = true;
    if (!e.target.closest("#searchWrap")) document.getElementById("searchResults").hidden = true;
  });
  document.getElementById("collapseBtn").addEventListener("click", () => { appEl.classList.toggle("sidebar-collapsed"); try { localStorage.setItem("sdm:collapsed", appEl.classList.contains("sidebar-collapsed") ? "1" : "0"); } catch { /* ignore */ } });
  document.querySelectorAll("#langSwitch button").forEach((b) => b.addEventListener("click", () => app.setLanguage(b.dataset.lang)));
  const search = document.getElementById("globalSearch"); const results = document.getElementById("searchResults");
  search.addEventListener("input", () => {
    const q = search.value.trim(); if (!q) { results.hidden = true; return; }
    const r = store.globalSearch(q);
    const col = (title, items, fn) => `<div><h4>${esc(title)}</h4>${items.length ? items.map(fn).join("") : `<div class="faint">-</div>`}</div>`;
    results.innerHTML = (r.products.length || r.customers.length || r.sales.length) ?
      col(t("inv.product"), r.products, (p) => `<button type="button" data-go="inventory" data-q="${esc(p.name)}">${esc(p.name)} <span class="faint num">${money(p.selling_price)}</span></button>`) +
      col(t("common.customer"), r.customers, (c) => `<button type="button" data-go="khata" data-id="${c.id}">${esc(c.name)} <span class="faint">${esc(c.phone || "")}</span></button>`) +
      col(t("common.invoice"), r.sales, (s) => `<button type="button" data-go="sales" data-id="${s.id}">${esc(s.invoice_no)} <span class="faint num">${money(s.total)}</span></button>`)
      : `<div class="empty-msg empty">${esc(t("top.no_results"))}</div>`;
    results.hidden = false;
  });
  search.addEventListener("focus", () => { if (search.value.trim()) results.hidden = false; });
  results.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]"); if (!b) return;
    results.hidden = true; search.value = "";
    if (b.dataset.go === "inventory") { app.ui.inventory = { ...(app.ui.inventory || {}), search: b.dataset.q }; navigate("inventory"); }
    else if (b.dataset.go === "khata") navigate("khata", { customer: b.dataset.id });
    else navigate("sales", { open: b.dataset.id });
  });
  store.subscribe(() => { renderNotifications(); if (document.getElementById("app").hidden === false) { const s = store.settings; document.querySelector("#brand .name").textContent = s.shop_name || CFG.productName; } });
}

// ------------------------------------------------------------ boot
async function boot() {
  await store.load();
  setLang(store.settings.language || (CFG.defaults || {}).language || "en");
  applyTheme();
  bindShell();
  try { if (localStorage.getItem("sdm:collapsed") === "1") document.getElementById("app").classList.add("sidebar-collapsed"); } catch { /* ignore */ }
  renderShell();
  onRoute(route);
  document.getElementById("loading").remove();
  document.getElementById("app").hidden = false;
  route(parseRoute());
  // Offline cache only on a real host; on localhost (development) make sure no stale worker is active.
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    const dev = ["localhost", "127.0.0.1"].includes(location.hostname);
    if (dev) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    else navigator.serviceWorker.register("sw.js").catch(() => { /* offline support unavailable */ });
  }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); app.installPrompt = e; });
}
app.finishSetup = () => { renderShell(); route(parseRoute()); toast(t("common.saved")); };
app.rerenderShell = renderShell;
boot();
