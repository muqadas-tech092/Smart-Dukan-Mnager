import { t, setLang } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, money, pageHead, section, btn, field, input, select, formValues, setError, toast, table, confirmDialog, readImageFile, downloadFile, logoSrc } from "../ui.js";
import { store } from "../store.js";

const CFG = window.SDM_CONFIG || {};
const TABS = ["profile", "prefs", "branding", "categories", "data", "about"];

export function render(root, app) {
  const st = app.ui.settings || (app.ui.settings = { tab: "profile" }); const s = store.settings;
  const labels = { profile: t("set.shop_profile"), prefs: t("set.preferences"), branding: t("set.branding"), categories: t("set.categories"), data: t("set.data"), about: t("set.about") };
  root.innerHTML = `${pageHead(t("set.title"), t("set.subtitle"))}<div class="tabs">${TABS.map((k) => `<button type="button" class="${st.tab === k ? "active" : ""}" data-tab="${k}">${esc(labels[k])}</button>`).join("")}</div><div id="tabBody"></div>`;
  root.querySelector(".tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { st.tab = b.dataset.tab; render(root, app); } });
  const body = root.querySelector("#tabBody");
  ({ profile, prefs, branding, categories, data, about })[st.tab](body, app, s, root);
}

function profile(body, app, s, root) {
  let logoData = s.logo_data; let touched = false;
  body.innerHTML = `<div class="card">${section(t("set.shop_profile"), "store")}<form id="pf" novalidate><div class="grid" style="grid-template-columns:200px 1fr;gap:20px">
    <div><img id="logoPrev" src="${logoSrc()}" alt="" style="width:140px;height:140px;border-radius:18px;object-fit:cover;border:1px solid var(--line)"/><label class="file-drop" style="margin-top:10px"><input type="file" name="logo" accept="image/*"/>${icon("camera", 18)}<span class="muted">${esc(t("set.logo"))}</span></label>${s.logo_data ? `<button type="button" class="btn sm" id="rmLogo" style="margin-top:8px">${icon("x", 14)}<span>${esc(t("set.remove_logo"))}</span></button>` : ""}</div>
    <div class="form-grid">${field(t("set.shop_name"), input("shop_name", s.shop_name, "required"), { cls: "span-2" })}${field(t("set.owner"), input("owner_name", s.owner_name))}${field(t("common.phone"), input("phone", s.phone, 'inputmode="tel"'))}${field(t("common.address"), `<textarea name="address">${esc(s.address)}</textarea>`, { cls: "span-2" })}<div class="span-2">${btn(t("common.save"), { cls: "primary", ic: "save", type: "submit" })}</div></div></div></form></div>`;
  body.querySelector('input[name="logo"]').addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; logoData = await readImageFile(f, 256, 256); touched = true; body.querySelector("#logoPrev").src = logoData; });
  body.querySelector("#rmLogo")?.addEventListener("click", () => { logoData = ""; touched = true; body.querySelector("#logoPrev").src = (CFG.theme || {}).logo || "assets/logo.png"; });
  body.querySelector("#pf").addEventListener("submit", (e) => { e.preventDefault(); const form = e.target; const v = formValues(form); if (!v.shop_name) { setError(form, "shop_name", t("common.required")); return; } const payload = { shop_name: v.shop_name, owner_name: v.owner_name, phone: v.phone, address: v.address }; if (touched) payload.logo_data = logoData; store.setSettings(payload); app.applyTheme(); app.rerenderShell(); toast(t("common.saved")); render(root, app); });
}
function prefs(body, app, s, root) {
  body.innerHTML = `<div class="card">${section(t("set.preferences"), "settings")}<form id="pr" novalidate><div class="form-grid-3">
    ${field(t("set.currency"), input("currency_symbol", s.currency_symbol))}${field(t("set.low_stock_default"), input("low_stock_default", s.low_stock_default, 'type="number" min="0"'))}${field(t("set.invoice_prefix"), input("invoice_prefix", s.invoice_prefix))}
    ${field(t("set.language"), select("language", [["en", "English"], ["ur", "اردو (Urdu)"]], s.language))}${field(t("set.receipt_footer"), input("receipt_footer", s.receipt_footer), { attrs: 'style="grid-column:span 2"' })}
    ${field(t("set.payment_methods"), input("payment_methods", (s.payment_methods || []).join(", ")), { help: t("set.comma_hint"), attrs: 'style="grid-column:1/-1"' })}
    ${field(t("set.expense_categories"), input("expense_categories", (s.expense_categories || []).join(", ")), { help: t("set.comma_hint"), attrs: 'style="grid-column:1/-1"' })}
    <div style="grid-column:1/-1">${btn(t("common.save"), { cls: "primary", ic: "save", type: "submit" })}</div></div></form></div>`;
  body.querySelector("#pr").addEventListener("submit", (e) => { e.preventDefault(); const v = formValues(e.target); const list = (x) => x.split(",").map((y) => y.trim()).filter(Boolean);
    store.setSettings({ currency_symbol: v.currency_symbol || "Rs.", low_stock_default: parseInt(v.low_stock_default) || 10, invoice_prefix: v.invoice_prefix || "INV", language: v.language, receipt_footer: v.receipt_footer, payment_methods: list(v.payment_methods).length ? list(v.payment_methods) : ["Cash"], expense_categories: list(v.expense_categories).length ? list(v.expense_categories) : ["Other"] });
    app.setLanguage(v.language); toast(t("common.saved")); });
}
function branding(body, app, s, root) {
  const cur = s.primary_color || (CFG.theme || {}).primary || "#087F5B";
  const swatches = ["#087F5B", "#1F6FEB", "#C2410C", "#7C3AED", "#0E7490", "#B91C1C", "#374151", "#A16207"];
  body.innerHTML = `<div class="card">${section(t("set.branding"), "palette")}<p class="muted" style="margin:0 0 12px">${esc(t("set.branding_hint"))}</p>
    <div class="field"><label>${esc(t("set.primary_color"))}</label><div class="color-row"><input type="color" id="primary" value="${cur}"/><div class="swatches">${swatches.map((c) => `<span class="swatch" data-color="${c}" style="background:${c}"></span>`).join("")}</div></div></div>
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">${btn(t("common.save"), { cls: "primary", ic: "save", attrs: "data-save" })}${btn(t("common.clear"), { ic: "rotate-ccw", attrs: "data-reset" })}</div></div>`;
  const inp = body.querySelector("#primary");
  body.querySelectorAll("[data-color]").forEach((sw) => sw.addEventListener("click", () => { inp.value = sw.dataset.color; }));
  body.querySelector("[data-save]").addEventListener("click", () => { store.setSettings({ primary_color: inp.value }); app.applyTheme(); toast(t("common.saved")); });
  body.querySelector("[data-reset]").addEventListener("click", () => { store.setSettings({ primary_color: "" }); app.applyTheme(); render(root, app); });
}
function categories(body, app, s, root) {
  const cats = store.categories; const counts = {}; for (const p of store.getProducts()) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
  body.innerHTML = `<div class="card">${section(t("set.categories"), "tag")}<form id="cf" class="toolbar" novalidate>${field(t("common.name"), input("name", "", "required"))}${field(t("inv.urdu_name"), input("name_ur", "", 'dir="rtl"'))}<div class="field" style="flex:0 0 auto">${btn(t("common.add"), { cls: "primary", ic: "plus", type: "submit" })}</div></form><div style="height:12px"></div>
    ${cats.length ? table({ cls: "", columns: [{ label: t("common.name") }, { label: t("inv.urdu_name") }, { label: t("inv.total_products"), cls: "num" }], rows: cats.map((c) => ({ cells: [`<b>${esc(c.name)}</b>`, esc(c.name_ur || ""), `<span class="num">${counts[c.id] || 0}</span>`] })) }) : `<p class="muted">-</p>`}</div>`;
  body.querySelector("#cf").addEventListener("submit", (e) => { e.preventDefault(); const v = formValues(e.target); if (!v.name) { setError(e.target, "name", t("common.required")); return; } store.addCategory(v.name, v.name_ur); toast(t("common.saved")); render(root, app); });
}
function data(body, app, s, root) {
  const inv = store.inventoryValue(); const feat = CFG.features || {};
  body.innerHTML = `<div class="grid grid-2">
    <div class="card">${section(t("set.backup"), "database")}<p class="muted" style="margin:0 0 10px">${esc(t("set.backup_hint"))}</p><div class="kv" style="margin-bottom:12px"><span>${esc(t("inv.total_products"))}</span><b>${inv.products}</b><span>${esc(t("cust.total"))}</span><b>${store.state.customers.length}</b><span>${esc(t("sales.count"))}</span><b>${store.state.sales.length}</b><span>${esc(t("set.storage"))}</span><b>${Math.round(store.exportJSON().length / 1024)} KB</b></div>${feat.backup !== false ? btn(t("set.backup"), { cls: "primary", ic: "download", attrs: "data-backup" }) : ""}</div>
    <div class="card">${section(t("set.restore"), "upload")}<p class="muted" style="margin:0 0 10px">${esc(t("set.restore_hint"))}</p><label class="file-drop"><input type="file" id="restoreFile" accept="application/json,.json"/>${icon("file-text", 18)}<span class="muted">JSON</span></label></div>
    <div class="card">${section(t("set.install"), "smartphone")}<p class="muted" style="margin:0 0 10px">${esc(t("set.install_hint"))}</p>${btn(t("set.install"), { ic: "download", attrs: `data-install ${app.installPrompt ? "" : "disabled"}` })}</div>
    <div class="card">${section(t("set.reset"), "rotate-ccw")}<p class="muted" style="margin:0 0 10px">${esc(t("set.reset_hint"))}</p>${feat.demoData !== false ? `<div style="margin-bottom:12px">${btn(t("set.load_demo"), { ic: "sparkles", attrs: "data-demo" })}<div class="faint" style="margin-top:4px">${esc(t("set.load_demo_hint"))}</div></div>` : ""}<div class="field"><label>${esc(t("set.reset_confirm"))}</label><input id="resetText" placeholder="RESET"/></div><div style="margin-top:10px">${btn(t("set.reset"), { cls: "danger", ic: "trash-2", attrs: "data-reset disabled" })}</div></div>
  </div>`;
  body.querySelector("[data-backup]")?.addEventListener("click", () => downloadFile(`${(s.shop_name || "shop").replace(/\s+/g, "-").toLowerCase()}-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportJSON(), "application/json"));
  body.querySelector("#restoreFile").addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; if (!(await confirmDialog({ title: t("set.restore"), body: t("set.restore_hint") }))) return; try { store.importJSON(await f.text()); setLang(store.settings.language); app.applyTheme(); app.rerenderShell(); toast(t("common.saved")); render(root, app); } catch (err) { toast(err.message, "error"); } });
  body.querySelector("[data-install]").addEventListener("click", async () => { if (app.installPrompt) { app.installPrompt.prompt(); await app.installPrompt.userChoice; app.installPrompt = null; } });
  body.querySelector("[data-demo]")?.addEventListener("click", async () => { if (await confirmDialog({ title: t("set.load_demo"), body: t("set.load_demo_hint"), danger: false })) { store.seedDemo(); app.rerenderShell(); toast(t("common.saved")); render(root, app); } });
  const rt = body.querySelector("#resetText"), rb = body.querySelector("[data-reset]");
  rt.addEventListener("input", () => { rb.disabled = rt.value.trim().toUpperCase() !== "RESET"; });
  rb.addEventListener("click", async () => { await store.reset(); location.hash = "#/dashboard"; location.reload(); });
}
function about(body, app, s) {
  const v = CFG.vendor || {}; const lic = CFG.licence || {};
  body.innerHTML = `<div class="card"><div class="hero" style="margin-bottom:12px"><img src="${logoSrc()}" alt="" style="width:56px;height:56px;border-radius:14px"/><div class="t"><h2>${esc(CFG.productName || "Smart Dukaan Manager")}</h2><p>v${esc(CFG.version || "2.0")} · ${esc(t("set.storage"))} · English / اردو</p></div></div>
    <div class="kv" style="max-width:420px">${lic.plan ? `<span>${esc(t("set.plan"))}</span><b>${esc(lic.plan)}</b>` : ""}${lic.licensedTo ? `<span>${esc(t("set.licensed_to"))}</span><b>${esc(lic.licensedTo)}</b>` : ""}${v.name ? `<span>${esc(t("set.support"))}</span><b>${esc(v.name)}${v.phone ? ` · ${esc(v.phone)}` : ""}</b>` : ""}${v.website ? `<span>Web</span><b><a href="${esc(v.website)}" target="_blank" rel="noopener">${esc(v.website)}</a></b>` : ""}</div>
    <p class="muted" style="margin-top:14px;line-height:1.7">Point of sale, inventory, digital khata, expenses and reports for small retail shops. Icons by <a href="https://lucide.dev" target="_blank" rel="noopener">Lucide</a> (MIT). Typography: Inter and Noto Nastaliq Urdu.</p></div>`;
}
