import { t } from "../i18n.js";
import { esc, money, fmtDate, pageHead, kpi, emptyState, badge, btn, iconBtn, field, input, select, table, paginate, pager, rangeControl, bindRangeControl, rangeFor, invoiceHTML, printHTML, toCSV, downloadFile } from "../ui.js";
import { store } from "../store.js";

export function render(root, app) {
  const st = app.ui.sales || (app.ui.sales = { search: "", method: "All", page: 1, open: null });
  if (app.params && app.params.open) { st.open = Number(app.params.open); app.params = {}; }
  if (st.open) return renderInvoice(root, app, st);
  const [start, end] = rangeFor((st.range || {}).preset || "30d", st.range || {});
  const summary = store.summary(start, end); const sales = store.getSales({ start, end, search: st.search, method: st.method }); const pg = paginate(sales, "page", 12, st);
  root.innerHTML = `${pageHead(t("sales.title"), t("sales.subtitle"))}
  <div class="card"><div class="toolbar"><div class="field grow"><label>${esc(t("common.date"))}</label>${rangeControl("range", st)}</div>${field(t("common.search"), `<input name="search" type="search" value="${esc(st.search)}" placeholder="${esc(t("sales.invoice"))} / ${esc(t("common.customer"))}"/>`)}${field(t("common.payment_method"), select("method", [["All", t("common.all")], ...store.paymentMethods], st.method))}</div></div>
  <div class="grid grid-4" style="margin-top:14px">
    ${kpi({ label: t("sales.revenue"), value: money(summary.revenue), ic: "banknote", tone: "emerald" })}
    ${kpi({ label: t("sales.count"), value: String(summary.orders), ic: "receipt", tone: "navy", delta: `${summary.items_sold} ${t("common.items")}` })}
    ${kpi({ label: t("sales.avg"), value: money(summary.avg_order), ic: "chart-column", tone: "blue" })}
    ${kpi({ label: t("sales.credit"), value: money(summary.credit_given), ic: "book-open", tone: summary.credit_given ? "amber" : "emerald", delta: `${t("sales.discounts")}: ${money(summary.discount)}` })}
  </div>
  <div class="card" style="margin-top:14px">
    ${sales.length ? `<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">${btn(t("common.export_csv"), { ic: "download", cls: "sm", attrs: "data-export" })}<span class="faint" style="margin-inline-start:auto">${sales.length} ${esc(t("common.rows"))}</span></div>` +
      table({ columns: [{ label: t("sales.invoice"), cls: "cell-primary" }, { label: t("common.customer") }, { label: t("sales.items"), cls: "num sm-hide" }, { label: t("common.payment_method"), cls: "sm-hide" }, { label: t("sales.received"), cls: "num sm-hide" }, { label: t("sales.credit"), cls: "num sm-hide" }, { label: t("common.total"), cls: "num" }, { label: t("common.actions"), cls: "actions-cell" }],
        rows: pg.items.map((s) => ({ cells: [`<div class="cell-main"><div class="t"><b class="num">${esc(s.invoice_no)}</b><span>${fmtDate(s.created_at, true)}</span></div></div>`, esc(s.customer_name || t("common.walk_in")), `<span class="num">${s.item_count}</span>`, badge(s.payment_method, s.credit_amount ? "blue" : "neutral"), `<span class="num">${money(s.amount_received)}</span>`, s.credit_amount ? `<span class="num" style="color:var(--amber)">${money(s.credit_amount)}</span>` : `<span class="faint">-</span>`, `<b class="num">${money(s.total)}</b>`, `<div class="actions">${iconBtn("eye", t("sales.view_invoice"), `data-open="${s.id}"`)}</div>`] })) }) + pager(pg, "page")
      : emptyState(t("sales.no_sales"), t("sales.no_sales_hint"), "empty_receipt.png")}
  </div>`;
  bindRangeControl(root, st, () => { st.page = 1; render(root, app); });
  root.querySelector('input[name="search"]').addEventListener("input", (e) => { st.search = e.target.value; st.page = 1; const pos = e.target.selectionStart; render(root, app); const i = root.querySelector('input[name="search"]'); i.focus(); i.setSelectionRange(pos, pos); });
  root.querySelector('select[name="method"]').addEventListener("change", (e) => { st.method = e.target.value; st.page = 1; render(root, app); });
  root.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]"); if (o) { st.open = Number(o.dataset.open); render(root, app); return; }
    const pg2 = e.target.closest("[data-pager]"); if (pg2) { st.page += Number(pg2.dataset.dir); render(root, app); return; }
    if (e.target.closest("[data-export]")) downloadFile("sales.csv", toCSV(sales, ["invoice_no", "created_at", "customer_name", "item_count", "subtotal", "discount", "total", "payment_method", "amount_received", "credit_amount"]), "text/csv");
  });
}
function renderInvoice(root, app, st) {
  const sale = store.getSale(st.open); if (!sale) { st.open = null; return render(root, app); }
  root.innerHTML = `${pageHead(t("sales.title"), t("sales.subtitle"))}<div style="display:flex;gap:8px;margin-bottom:14px">${btn(t("common.back"), { ic: "arrow-left", attrs: "data-back" })}${btn(t("common.print"), { ic: "printer", cls: "primary", attrs: "data-print" })}</div>${invoiceHTML(sale)}`;
  root.querySelector("[data-back]").addEventListener("click", () => { st.open = null; render(root, app); });
  root.querySelector("[data-print]").addEventListener("click", () => printHTML(invoiceHTML(sale)));
}
