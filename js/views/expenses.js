import { t } from "../i18n.js";
import { esc, money, fmtDate, pageHead, kpi, section, emptyState, badge, btn, iconBtn, field, input, select, formValues, setError, openModal, closeModal, confirmDialog, toast, errorMessage, table, paginate, pager, rangeControl, bindRangeControl, rangeFor, toCSV, downloadFile } from "../ui.js";
import { donutChart, hbarChart } from "../charts.js";
import { store, todayISO, addDays } from "../store.js";
import { CREDIT_METHOD } from "../store.js";

export function render(root, app) {
  const st = app.ui.expenses || (app.ui.expenses = { search: "", category: "All", page: 1 });
  const [start, end] = rangeFor((st.range || {}).preset || "30d", st.range || {});
  const expenses = store.getExpenses({ start, end, category: st.category, search: st.search }); const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = store.expensesByCategory(start, end); const days = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
  const pg = paginate(expenses, "page", 10, st);
  root.innerHTML = `${pageHead(t("exp.title"), t("exp.subtitle"), btn(t("exp.add"), { cls: "primary", ic: "plus", attrs: "data-add" }))}
  <div class="card"><div class="toolbar"><div class="field grow"><label>${esc(t("common.date"))}</label>${rangeControl("range", st)}</div>${field(t("common.category"), select("category", [["All", t("common.all")], ...store.expenseCategories], st.category))}${field(t("common.search"), `<input name="search" type="search" value="${esc(st.search)}" placeholder="${esc(t("common.description"))}"/>`)}</div></div>
  <div class="grid grid-4" style="margin-top:14px">
    ${kpi({ label: t("exp.total"), value: money(total), ic: "wallet", tone: "amber" })}
    ${kpi({ label: t("exp.entries"), value: String(expenses.length), ic: "receipt", tone: "navy" })}
    ${kpi({ label: t("exp.daily_avg"), value: money(total / days), ic: "calendar", tone: "blue" })}
    ${kpi({ label: t("exp.largest"), value: byCat[0] ? byCat[0].category : "-", ic: "tag", tone: byCat[0] ? "red" : "emerald", delta: byCat[0] ? money(byCat[0].amount) : "" })}
  </div>
  <div class="grid grid-3-2" style="margin-top:14px">
    <div class="card">${section(t("exp.title"), "wallet", `${expenses.length} ${t("common.rows")}`)}
      ${expenses.length ? table({ columns: [{ label: t("common.date"), cls: "cell-primary" }, { label: t("common.category") }, { label: t("common.description"), cls: "sm-hide" }, { label: t("common.payment_method"), cls: "sm-hide" }, { label: t("common.amount"), cls: "num" }, { label: t("common.actions"), cls: "actions-cell" }],
        rows: pg.items.map((e) => ({ cells: [`<b>${fmtDate(e.expense_date)}</b>`, badge(e.category, "neutral"), esc(e.description || "-"), esc(e.payment_method || "-"), `<b class="num">${money(e.amount)}</b>`, `<div class="actions">${iconBtn("pencil", t("common.edit"), `data-edit="${e.id}"`)}${iconBtn("trash-2", t("common.delete"), `data-delete="${e.id}"`, "danger")}</div>`] })) }) + pager(pg, "page") + `<div style="margin-top:12px">${btn(t("common.export_csv"), { ic: "download", cls: "sm", attrs: "data-export" })}</div>`
        : emptyState(t("exp.no_expenses"), t("exp.no_expenses_hint"), "empty_receipt.png")}
    </div>
    <div class="card">${section(t("exp.by_category"), "chart-column")}${byCat.length ? donutChart({ items: byCat.map((b) => ({ label: b.category, value: b.amount })), fmt: (v) => money(v) }) + `<div style="margin-top:10px">${hbarChart({ items: byCat.map((b) => ({ label: b.category, value: b.amount, sub: `${b.entries} ${t("exp.entries").toLowerCase()}` })), color: "#EB6834", fmt: (v) => money(v) })}</div>` : emptyState(t("common.no_data"), "", "empty_receipt.png")}</div>
  </div>`;
  bindRangeControl(root, st, () => { st.page = 1; render(root, app); });
  root.querySelector('select[name="category"]').addEventListener("change", (e) => { st.category = e.target.value; st.page = 1; render(root, app); });
  root.querySelector('input[name="search"]').addEventListener("input", (e) => { st.search = e.target.value; st.page = 1; const pos = e.target.selectionStart; render(root, app); const i = root.querySelector('input[name="search"]'); i.focus(); i.setSelectionRange(pos, pos); });
  root.addEventListener("click", async (e) => {
    const id = (a) => { const b = e.target.closest(`[${a}]`); return b ? Number(b.getAttribute(a)) : null; };
    if (e.target.closest("[data-add]")) return expenseDialog(null, root, app);
    if (id("data-edit")) return expenseDialog(store.state.expenses.find((x) => x.id === id("data-edit")), root, app);
    if (id("data-delete")) { const ex = store.state.expenses.find((x) => x.id === id("data-delete")); if (await confirmDialog({ title: t("common.delete"), body: `${ex.category} · ${money(ex.amount)}` })) { store.deleteExpense(ex.id); toast(t("common.deleted")); render(root, app); } return; }
    const pg2 = e.target.closest("[data-pager]"); if (pg2) { st.page += Number(pg2.dataset.dir); render(root, app); return; }
    if (e.target.closest("[data-export]")) downloadFile("expenses.csv", toCSV(expenses, ["expense_date", "category", "description", "payment_method", "amount"]), "text/csv");
  });
}
function expenseDialog(existing, root, app) {
  const e = existing || {}; const methods = store.paymentMethods.filter((m) => m !== CREDIT_METHOD);
  openModal({ title: existing ? t("exp.edit") : t("exp.add"), ic: "wallet", body: `<form id="ef" novalidate><div class="form-grid">${field(t("common.category"), select("category", store.expenseCategories, e.category || store.expenseCategories[0]))}${field(t("common.amount"), input("amount", e.amount ?? "", 'type="number" min="1" step="1" inputmode="decimal" required'))}${field(t("common.date"), input("expense_date", e.expense_date || todayISO(), `type="date" max="${todayISO()}"`))}${field(t("common.payment_method"), select("payment_method", methods, e.payment_method || methods[0]))}${field(t("common.description"), input("description", e.description || ""), { cls: "span-2", optional: true })}</div></form>`,
    footer: btn(t("common.cancel"), { attrs: "data-close" }) + btn(t("common.save"), { cls: "primary", ic: "save", attrs: "data-save" }), onMount: (m) => {
      const save = () => { const form = m.querySelector("#ef"); const v = formValues(form); if (!(Number(v.amount) > 0)) { setError(form, "amount", t("err.amount_positive")); return; } try { if (existing) store.updateExpense(existing.id, v); else store.addExpense(v); closeModal(); toast(t("common.saved")); render(root, app); } catch (err) { toast(errorMessage(err), "error"); } };
      m.querySelector("[data-save]").addEventListener("click", save); m.querySelector("#ef").addEventListener("submit", (ev) => { ev.preventDefault(); save(); });
    } });
}
