import { freshView } from "../ui.js";
import { t } from "../i18n.js";
import { esc, money, fmtDay, pageHead, kpi, section, emptyState, btn, table, rangeControl, bindRangeControl, rangeFor, toCSV, downloadFile } from "../ui.js";
import { lineAreaChart, donutChart, hbarChart, columnChart, mountCharts } from "../charts.js";
import { store } from "../store.js";

export function render(_root, app) {
  const root = freshView();
  const st = app.ui.reports || (app.ui.reports = {});
  const [start, end] = rangeFor((st.range || {}).preset || "30d", st.range || {});
  const s = store.summary(start, end); const daily = store.salesByDay(start, end); const hasData = daily.some((d) => d.revenue || d.expenses);
  const cats = store.salesByCategory(start, end); const pm = store.salesByMethod(start, end); const hours = store.salesByHour(start, end); const tops = store.topProducts(start, end, 10); const exp = store.expensesByCategory(start, end);
  const margin = s.revenue ? s.gross_profit / s.revenue * 100 : 0;
  root.innerHTML = `${pageHead(t("rep.title"), t("rep.subtitle"), btn(t("rep.export"), { ic: "download", attrs: "data-export" }))}
  <div class="card"><div class="field"><label>${esc(t("common.date"))}</label>${rangeControl("range", st)}</div></div>
  <div class="grid grid-3" style="margin-top:14px">
    ${kpi({ label: t("rep.revenue"), value: money(s.revenue), ic: "banknote", tone: "emerald" })}
    ${kpi({ label: t("rep.gross"), value: money(s.gross_profit), ic: "trending-up", tone: "navy", delta: `${margin.toFixed(0)}% ${t("dash.margin")}` })}
    ${kpi({ label: t("rep.net"), value: money(s.net_profit), ic: "coins", tone: s.net_profit >= 0 ? "emerald" : "red" })}
    ${kpi({ label: t("rep.orders"), value: String(s.orders), ic: "receipt", tone: "blue" })}
    ${kpi({ label: t("rep.avg_order"), value: money(s.avg_order), ic: "shopping-bag", tone: "navy" })}
    ${kpi({ label: t("rep.items_sold"), value: String(s.items_sold), ic: "package", tone: "amber" })}
  </div>
  <div class="grid grid-2-1" style="margin-top:14px">
    <div class="card">${section(t("rep.trend"), "chart-column")}${hasData ? lineAreaChart({ labels: daily.map((d) => fmtDay(d.day)), series: [{ label: t("rep.revenue"), values: daily.map((d) => d.revenue) }, { label: t("dash.expenses"), values: daily.map((d) => d.expenses) }], height: 280, fmt: (v) => money(v) }) : emptyState(t("common.no_data"), "", "empty_receipt.png")}</div>
    <div class="card">${section(t("rep.by_category"), "layers")}${cats.length ? donutChart({ items: cats.map((c) => ({ label: c.category, value: c.revenue })), fmt: (v) => money(v) }) : emptyState(t("common.no_data"))}</div>
  </div>
  <div class="grid grid-2" style="margin-top:14px">
    <div class="card">${section(t("rep.by_method"), "credit-card")}${pm.length ? hbarChart({ items: pm.map((m) => ({ label: m.method, value: m.revenue, sub: `${m.orders} ${t("dash.orders")}` })), fmt: (v) => money(v) }) : emptyState(t("common.no_data"))}</div>
    <div class="card">${section(t("rep.by_hour"), "clock")}${hours.some((h) => h.revenue) ? columnChart({ items: hours.map((h) => ({ label: `${h.hour % 12 || 12}${h.hour < 12 ? "am" : "pm"}`, value: h.revenue })), fmt: (v) => money(v) }) : emptyState(t("common.no_data"))}</div>
  </div>
  <div class="grid grid-3-2" style="margin-top:14px">
    <div class="card">${section(t("rep.top_products"), "sparkles")}${tops.length ? table({ cls: "", columns: [{ label: "#" }, { label: t("inv.product") }, { label: t("common.qty"), cls: "num" }, { label: t("rep.revenue"), cls: "num" }, { label: t("rep.profit"), cls: "num" }], rows: tops.map((p, i) => ({ cells: [`<span class="muted">${i + 1}</span>`, `<b>${esc(p.name)}</b>`, `<span class="num">${p.qty}</span>`, `<span class="num">${money(p.revenue)}</span>`, `<span class="num" style="color:var(--green)">${money(p.profit)}</span>`] })) }) : emptyState(t("common.no_data"), "", "empty_cart.png")}</div>
    <div class="card">${section(t("rep.profit_table"), "file-text")}${table({ cls: "", columns: [{ label: t("rep.summary") }, { label: t("common.amount"), cls: "num" }], rows: [
      { cells: [`<b>${esc(t("rep.revenue"))}</b>`, `<b class="num">${money(s.revenue)}</b>`] }, { cells: [`<span class="muted">${esc(t("sales.discounts"))}</span>`, `<span class="num muted">${money(s.discount)}</span>`] },
      { cells: [`<span class="muted">${esc(t("rep.cogs"))}</span>`, `<span class="num" style="color:var(--red)">- ${money(s.cogs)}</span>`] }, { cells: [`<b>${esc(t("rep.gross"))}</b>`, `<b class="num">${money(s.gross_profit)}</b>`] },
      ...exp.map((e) => ({ cells: [`<span class="muted">&nbsp;&nbsp;${esc(e.category)}</span>`, `<span class="num" style="color:var(--red)">- ${money(e.amount)}</span>`] })),
      { cells: [`<b>${esc(t("rep.net"))}</b>`, `<b class="num" style="color:${s.net_profit >= 0 ? "var(--green)" : "var(--red)"}">${money(s.net_profit)}</b>`] }, { cells: [`<span class="muted">${esc(t("rep.credit_given"))}</span>`, `<span class="num muted">${money(s.credit_given)}</span>`] }] })}</div>
  </div>`;
  mountCharts(root);
  bindRangeControl(root, st, () => render(root, app));
  root.querySelector("[data-export]").addEventListener("click", () => downloadFile(`report-${start}-to-${end}.csv`, toCSV(daily, ["day", "revenue", "orders", "expenses"]), "text/csv"));
}
