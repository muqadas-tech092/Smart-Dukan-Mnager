import { t } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, money, fmtDate, pageHead, kpi, emptyState, statusBadge, imgSrc, btn, iconBtn, field, input, select, formValues, setError, openModal, closeModal, confirmDialog, toast, errorMessage, table, paginate, pager, readImageFile, toCSV, parseCSV, downloadFile } from "../ui.js";
import { store } from "../store.js";

const CFG = window.SDM_CONFIG || {}; const UNITS = (CFG.defaults || {}).units || ["pcs"];

export function render(root, app) {
  const st = app.ui.inventory || (app.ui.inventory = { search: "", cat: "", status: "all", sort: "name", page: 1 });
  const inv = store.inventoryValue(); const low = store.lowStock();
  let products = store.getProducts({ search: st.search || "", categoryId: st.cat ? Number(st.cat) : null, status: st.status === "all" ? null : st.status });
  const sorters = { name: (a, b) => a.name.localeCompare(b.name), qty_asc: (a, b) => a.quantity - b.quantity, qty_desc: (a, b) => b.quantity - a.quantity, price_desc: (a, b) => b.selling_price - a.selling_price, price_asc: (a, b) => a.selling_price - b.selling_price, newest: (a, b) => b.created_at.localeCompare(a.created_at) };
  products.sort(sorters[st.sort] || sorters.name);
  const pg = paginate(products, "page", 10, st); const cats = store.categories;
  const statusOpts = [["all", t("common.all")], ["ok", t("inv.in_stock")], ["low", t("inv.low_stock")], ["out", t("inv.out_of_stock")], ["attention", t("inv.need_attention")]];
  const sortOpts = [["name", t("common.name")], ["qty_asc", `${t("inv.quantity")} ↑`], ["qty_desc", `${t("inv.quantity")} ↓`], ["price_desc", `${t("inv.selling_price")} ↓`], ["price_asc", `${t("inv.selling_price")} ↑`], ["newest", t("inv.newest")]];
  root.innerHTML = `${pageHead(t("inv.title"), t("inv.subtitle"), btn(t("inv.add_product"), { cls: "primary", ic: "plus", attrs: 'data-add' }))}
  <div class="grid grid-4">
    ${kpi({ label: t("inv.total_products"), value: String(inv.products), ic: "package", tone: "emerald" })}
    ${kpi({ label: t("inv.stock_value"), value: money(inv.cost), ic: "coins", tone: "navy" })}
    ${kpi({ label: t("inv.retail_value"), value: money(inv.retail), ic: "tag", tone: "blue" })}
    ${kpi({ label: t("inv.need_attention"), value: String(low.length), ic: "triangle-alert", tone: low.length ? "amber" : "emerald", delta: low.length ? `${low.filter((p) => p.status === "out").length} ${t("inv.out_of_stock").toLowerCase()}` : t("dash.all_stocked") })}
  </div>
  <div class="card" style="margin-top:14px">
    <form class="toolbar" id="invFilters" onsubmit="return false">
      ${field(t("common.search"), `<input name="search" type="search" value="${esc(st.search || "")}" placeholder="${esc(t("pos.search"))}"/>`, { cls: "grow" })}
      ${field(t("common.category"), select("cat", [["", t("common.all")], ...cats.map((c) => [c.id, c.name])], st.cat || ""))}
      ${field(t("inv.stock_status"), select("status", statusOpts, st.status))}
      ${field(t("inv.sort"), select("sort", sortOpts, st.sort))}
    </form>
    <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;align-items:center">
      ${btn(t("common.export_csv"), { ic: "download", cls: "sm", attrs: 'data-export' })}
      ${(CFG.features || {}).csvImport !== false ? btn(t("common.import_csv"), { ic: "upload", cls: "sm", attrs: 'data-import' }) : ""}
      <span class="faint" style="margin-inline-start:auto">${products.length} ${esc(t("common.rows"))}</span>
    </div>
    ${products.length ? table({ columns: [{ label: t("inv.product"), cls: "cell-primary" }, { label: t("inv.sku"), cls: "sm-hide" }, { label: t("common.category") }, { label: t("inv.quantity"), cls: "num" }, { label: t("inv.purchase_price"), cls: "num sm-hide" }, { label: t("inv.selling_price"), cls: "num" }, { label: t("inv.stock_status") }, { label: t("common.actions"), cls: "actions-cell" }],
      rows: pg.items.map((p) => ({ cells: [
        `<div class="cell-main"><img class="thumb" src="${imgSrc(p)}" alt="" loading="lazy"/><div class="t"><b>${esc(p.name)}</b><span>${esc(p.name_ur || "")}</span></div></div>`,
        `<div><div class="num">${esc(p.sku)}</div><div class="faint num">${esc(p.barcode || "")}</div></div>`, esc(p.category || "-"),
        `<b class="num" style="color:${p.status === "ok" ? "var(--text)" : p.status === "low" ? "var(--amber)" : "var(--red)"}">${p.quantity}</b> <span class="faint">${esc(p.unit)}</span>`,
        `<span class="num">${money(p.purchase_price)}</span>`, `<b class="num">${money(p.selling_price)}</b>`, statusBadge(p.status),
        `<div class="actions">${iconBtn("pencil", t("common.edit"), `data-edit="${p.id}"`)}${iconBtn("boxes", t("inv.adjust_stock"), `data-adjust="${p.id}"`)}${iconBtn("history", t("inv.history"), `data-history="${p.id}"`)}${iconBtn("trash-2", t("common.delete"), `data-delete="${p.id}"`, "danger")}</div>`] })) }) + pager(pg, "page")
      : emptyState(t("inv.no_products"), t("inv.no_products_hint"))}
  </div>`;
  const form = root.querySelector("#invFilters");
  form.addEventListener("input", (e) => { if (e.target.name === "search") { st.search = e.target.value; st.page = 1; rerenderKeepFocus(root, app); } });
  form.addEventListener("change", (e) => { st[e.target.name] = e.target.value; st.page = 1; render(root, app); });
  root.addEventListener("click", async (e) => {
    const id = (attr) => { const b = e.target.closest(`[${attr}]`); return b ? Number(b.getAttribute(attr)) : null; };
    if (e.target.closest("[data-add]")) return productDialog(null, root, app);
    if (id("data-edit")) return productDialog(store.getProduct(id("data-edit")), root, app);
    if (id("data-adjust")) return adjustDialog(store.getProduct(id("data-adjust")), root, app);
    if (id("data-history")) return historyDialog(store.getProduct(id("data-history")));
    if (id("data-delete")) { const p = store.getProduct(id("data-delete")); if (await confirmDialog({ title: t("common.delete"), body: `${t("inv.delete_confirm")} (${p.name})` })) { store.deleteProduct(p.id); toast(t("common.deleted")); render(root, app); } return; }
    const pg2 = e.target.closest("[data-pager]"); if (pg2) { st.page += Number(pg2.dataset.dir); render(root, app); return; }
    if (e.target.closest("[data-export]")) { downloadFile("products.csv", toCSV(products.map((p) => ({ ...p, category: p.category })), ["name", "name_ur", "sku", "barcode", "category", "purchase_price", "selling_price", "quantity", "low_stock_threshold", "unit"]), "text/csv"); return; }
    if (e.target.closest("[data-import]")) return importDialog(root, app);
  });
}
function rerenderKeepFocus(root, app) { const pos = root.querySelector('input[name="search"]').selectionStart; render(root, app); const inp = root.querySelector('input[name="search"]'); inp.focus(); inp.setSelectionRange(pos, pos); }

function productDialog(existing, root, app) {
  const e = existing || {}; const cats = store.categories; const thr = store.settings.low_stock_default;
  let imageData = e.image_data || ""; let imageTouched = false;
  const body = `<form id="pf" novalidate><div class="form-grid">
    ${field(t("common.name"), input("name", e.name || "", "required"))}${field(t("inv.urdu_name"), input("name_ur", e.name_ur || "", 'dir="rtl"'), { optional: true })}
    ${field("SKU", input("sku", e.sku || "", 'placeholder="auto"'), { optional: true })}${field("Barcode", input("barcode", e.barcode || "", 'inputmode="numeric"'), { optional: true })}
    ${field(t("common.category"), select("category_id", [["", "-"], ...cats.map((c) => [c.id, c.name])], e.category_id || ""))}${field(t("inv.new_category"), input("new_cat", ""), { optional: true })}
    ${field(t("inv.purchase_price"), input("purchase_price", e.purchase_price ?? 0, 'type="number" min="0" step="1" inputmode="decimal"'))}${field(t("inv.selling_price"), input("selling_price", e.selling_price ?? 0, 'type="number" min="0" step="1" inputmode="decimal"'))}
    ${field(t("inv.quantity"), input("quantity", e.quantity ?? 0, 'type="number" min="0" step="1" inputmode="numeric"'))}${field(t("inv.threshold"), input("low_stock_threshold", e.low_stock_threshold ?? thr, 'type="number" min="0" step="1" inputmode="numeric"'))}
    ${field(t("inv.unit"), select("unit", UNITS, e.unit || "pcs"))}
    <div class="field"><label>${esc(t("inv.photo"))}</label><label class="file-drop"><input type="file" name="photo" accept="image/*"/><img id="pfPreview" src="${imgSrc(e)}" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"/><span class="muted">${esc(t("inv.photo_hint"))}</span></label>${e.image_data ? `<button type="button" class="btn sm" id="pfRemovePhoto" style="margin-top:6px;align-self:flex-start">${icon("x", 14)}<span>${esc(t("inv.remove_photo"))}</span></button>` : ""}</div>
    <div class="alert warn span-2" id="pfWarn" hidden>${icon("triangle-alert", 14)}<span>${esc(t("inv.price_warning"))}</span></div>
  </div></form>`;
  openModal({ title: existing ? t("inv.edit_product") : t("inv.add_product"), ic: "package", size: "lg", body, footer: btn(t("common.cancel"), { attrs: "data-close" }) + btn(t("common.save"), { cls: "primary", ic: "save", attrs: 'data-save' }),
    onMount: (m) => {
      const form = m.querySelector("#pf"); const warn = m.querySelector("#pfWarn");
      const check = () => { const v = formValues(form); warn.hidden = !(Number(v.selling_price) && Number(v.purchase_price) && Number(v.selling_price) < Number(v.purchase_price)); };
      form.addEventListener("input", check); check();
      form.querySelector('input[name="photo"]').addEventListener("change", async (ev) => { const f = ev.target.files[0]; if (!f) return; try { imageData = await readImageFile(f); imageTouched = true; m.querySelector("#pfPreview").src = imageData; } catch { toast("Invalid image", "error"); } });
      m.querySelector("#pfRemovePhoto")?.addEventListener("click", () => { imageData = ""; imageTouched = true; m.querySelector("#pfPreview").src = "assets/placeholder.png"; });
      m.querySelector("[data-save]").addEventListener("click", () => {
        const v = formValues(form); if (!v.name) { setError(form, "name", t("common.required")); return; }
        let catId = v.category_id ? Number(v.category_id) : null; if (v.new_cat) catId = store.addCategory(v.new_cat);
        const payload = { ...v, category_id: catId }; if (imageTouched || !existing) payload.image_data = imageData;
        try { if (existing) store.updateProduct(existing.id, payload); else store.addProduct(payload); closeModal(); toast(t("common.saved")); render(root, app); } catch (err) { setError(form, "sku", errorMessage(err)); }
      });
      form.addEventListener("submit", (ev) => { ev.preventDefault(); m.querySelector("[data-save]").click(); });
    } });
}
function adjustDialog(p, root, app) {
  const body = `<p class="muted" style="margin:0 0 10px">${esc(p.name)} · ${esc(t("inv.quantity"))}: <b class="num">${p.quantity} ${esc(p.unit)}</b></p><form id="af" novalidate>
    <div class="segmented" style="margin-bottom:12px"><button type="button" class="active" data-mode="add">${esc(t("inv.add_stock"))}</button><button type="button" data-mode="remove">${esc(t("inv.remove_stock"))}</button></div>
    <div class="form-grid">${field(t("common.qty"), input("qty", 1, 'type="number" min="1" step="1" inputmode="numeric"'))}${field(t("inv.adjust_reason"), select("reason", ["purchase", "return", "damage", "correction", "other"], "purchase"))}${field(t("common.notes"), input("note", ""), { cls: "span-2", optional: true })}</div></form>`;
  let mode = "add";
  openModal({ title: t("inv.adjust_stock"), ic: "boxes", body, footer: btn(t("common.cancel"), { attrs: "data-close" }) + btn(t("common.save"), { cls: "primary", ic: "save", attrs: "data-save" }), onMount: (m) => {
    m.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { mode = b.dataset.mode; m.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("active", x === b)); }));
    const save = () => { const v = formValues(m.querySelector("#af")); const q = parseInt(v.qty) || 0; if (q <= 0) return; store.adjustStock(p.id, mode === "add" ? q : -q, v.reason, v.note); closeModal(); toast(t("common.saved")); render(root, app); };
    m.querySelector("[data-save]").addEventListener("click", save); m.querySelector("#af").addEventListener("submit", (e) => { e.preventDefault(); save(); });
  } });
}
function historyDialog(p) {
  const moves = store.getMovements(p.id, 25);
  const body = moves.length ? table({ cls: "", columns: [{ label: t("common.date") }, { label: t("inv.adjust_reason") }, { label: t("inv.ref") }, { label: t("common.qty"), cls: "num" }], rows: moves.map((m) => ({ cells: [`<span class="muted">${fmtDate(m.created_at, true)}</span>`, esc(m.reason), `<span class="muted">${esc(m.reference || "")}</span>`, `<b class="num" style="color:${m.change > 0 ? "var(--green)" : "var(--red)"}">${m.change > 0 ? "+" : ""}${m.change}</b>`] })) }) : emptyState(t("common.no_data"));
  openModal({ title: `${t("inv.history")} · ${p.name}`, ic: "history", size: "lg", body });
}
function importDialog(root, app) {
  openModal({ title: t("common.import_csv"), ic: "upload", body: `<p class="faint">${esc(t("inv.import_hint"))}</p><label class="file-drop"><input type="file" id="csvFile" accept=".csv,text/csv"/>${icon("file-spreadsheet", 20)}<span class="muted">CSV</span></label><div id="csvMsg" class="muted" style="margin-top:10px"></div>`,
    footer: btn(t("common.cancel"), { attrs: "data-close" }) + btn(t("common.import_csv"), { cls: "primary", ic: "upload", attrs: "data-go disabled" }), onMount: (m) => {
      let rows = [];
      m.querySelector("#csvFile").addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; rows = parseCSV(await f.text()); m.querySelector("#csvMsg").textContent = `${rows.length} ${t("common.rows")}`; m.querySelector("[data-go]").disabled = !rows.length; });
      m.querySelector("[data-go]").addEventListener("click", () => { const r = store.importProducts(rows); closeModal(); toast(t("inv.import_done", { a: r.inserted, b: r.updated })); render(root, app); });
    } });
}
