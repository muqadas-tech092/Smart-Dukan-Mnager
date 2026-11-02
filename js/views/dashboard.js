import { freshView } from "../ui.js";
import { t } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, money, fmtDate, fmtDay, initials, pageHead, section, kpi, listRow, emptyState, statusBadge, imgSrc, rangeControl, bindRangeControl, rangeFor, btn } from "../ui.js";
import { lineAreaChart, mountCharts } from "../charts.js";
import { store, todayISO, addDays } from "../store.js";

function pct(cur, prev) { if (prev <= 0) return ["", "flat"]; const ch = (cur - prev) / prev * 100; return [`${ch >= 0 ? "+" : ""}${ch.toFixed(0)}% ${t("dash.vs_yesterday")}`, ch >= 0 ? "up" : "down"]; }

export function render(_root, app) {
  const root = freshView();
  const st = app.ui.dashboard || (app.ui.dashboard = {});
  const today = todayISO(); const yday = addDays(today, -1);
  const cur = store.summary(today, today), prev = store.summary(yday, yday); const inv = store.inventoryValue(); const low = store.lowStock();
  const [dS, dDir] = pct(cur.revenue, prev.revenue); const [eS, eDir] = pct(cur.expenses, prev.expenses);
  const margin = cur.revenue ? cur.net_profit / cur.revenue * 100 : 0;
  const [start, end] = rangeFor((st.range || {}).preset || "30d", st.range || {});
  const daily = store.salesByDay(start, end); const tot = store.summary(start, end);
  const hasData = daily.some((d) => d.revenue || d.expenses);
  const tops = store.topProducts(addDays(today, -29), today, 5); const topMax = tops.length ? tops[0].revenue : 1;
  const recent = store.getSales({ limit: 6 }); const due = store.getCustomers().filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 6);

  root.innerHTML = `${pageHead(t("dash.title"), t("dash.subtitle"))}
  <div class="grid grid-4">
    ${kpi({ label: t("dash.today_sales"), value: money(cur.revenue), ic: "banknote", tone: "emerald", delta: dS || `${cur.orders} ${t("dash.orders")}`, dir: dDir })}
    ${kpi({ label: t("dash.today_expenses"), value: money(cur.expenses), ic: "wallet", tone: "amber", delta: eS || t("common.today"), dir: eDir === "up" ? "down" : eDir === "down" ? "up" : "flat" })}
    ${kpi({ label: t("dash.net_profit"), value: money(cur.net_profit), ic: "trending-up", tone: cur.net_profit >= 0 ? "navy" : "red", delta: `${margin.toFixed(0)}% ${t("dash.margin")}`, dir: cur.net_profit >= 0 ? "up" : "down" })}
    ${kpi({ label: t("dash.total_products"), value: String(inv.products), ic: "package", tone: "blue", delta: low.length ? `${low.length} ${t("dash.low_stock_items")}` : t("dash.all_stocked"), dir: low.length ? "down" : "flat" })}
  </div>
  <div class="grid grid-2-1" style="margin-top:14px">
    <div class="card">${section(t("dash.sales_overview"), "chart-column", "", rangeControl("range", st))}
      ${hasData ? lineAreaChart({ labels: daily.map((d) => fmtDay(d.day)), series: [{ label: t("dash.revenue"), values: daily.map((d) => d.revenue) }, { label: t("dash.expenses"), values: daily.map((d) => d.expenses) }], height: 260, fmt: (v) => money(v) })
        + `<div class="legend" style="justify-content:flex-end;margin-top:8px"><span>${esc(t("dash.revenue"))} <b class="num">${money(tot.revenue)}</b></span><span>${esc(t("dash.expenses"))} <b class="num">${money(tot.expenses)}</b></span><span>${esc(t("dash.net_profit"))} <b class="num">${money(tot.net_profit)}</b></span></div>` : emptyState(t("dash.no_sales"), "", "empty_receipt.png")}
    </div>
    <div class="card">${section(t("dash.top_products"), "sparkles", t("common.30d"))}
      ${tops.length ? `<div class="list">${tops.map((p) => listRow({ title: p.name, sub: `${p.qty} ${esc(t("common.items"))}`, value: money(p.revenue), valueSub: `${esc(t("rep.profit"))} ${money(p.profit)}`, bar: p.revenue / topMax })).join("")}</div>` : emptyState(t("dash.no_sales"), "", "empty_cart.png")}
    </div>
  </div>
  <div class="grid grid-3" style="margin-top:14px">
    <div class="card">${section(t("dash.low_stock"), "triangle-alert", low.length ? String(low.length) : "")}
      ${low.length ? `<div class="list">${low.slice(0, 6).map((p) => listRow({ title: p.name, sub: statusBadge(p.status), value: `${p.quantity} ${p.unit}`, valueSub: `${esc(t("inv.threshold"))} ${p.low_stock_threshold}`, thumb: imgSrc(p) })).join("")}</div><div style="margin-top:10px">${btn(t("dash.restock"), { ic: "package-plus", cls: "block", attrs: 'data-go-inventory' })}</div>` : emptyState(t("dash.all_stocked"))}
    </div>
    <div class="card">${section(t("dash.recent"), "receipt")}
      ${recent.length ? `<div class="list">${recent.map((s) => listRow({ title: s.invoice_no, sub: `${esc(s.customer_name || t("common.walk_in"))} · ${esc(s.payment_method)}`, value: money(s.total), valueSub: fmtDate(s.created_at, true), ic: "receipt", tone: s.credit_amount ? "blue" : "emerald" })).join("")}</div><div style="margin-top:10px">${btn(t("dash.view_all"), { ic: "arrow-right", cls: "block", attrs: 'data-nav="sales"' })}</div>` : emptyState(t("dash.no_sales"), "", "empty_receipt.png")}
    </div>
    <div class="card">${section(t("dash.pending"), "hand-coins")}
      ${due.length ? `<div class="list">${due.map((c) => listRow({ title: c.name, sub: `${esc(c.phone || "")} · ${esc(t("khata.last_payment"))}: ${fmtDate(c.last_payment)}`, value: money(c.balance), avatar: initials(c.name), valueClass: "", })).join("")}</div><div style="margin-top:10px">${btn(t("cust.open_khata"), { ic: "book-open", cls: "block", attrs: 'data-nav="khata"' })}</div>` : emptyState(t("dash.no_pending"), "", "empty_users.png")}
    </div>
  </div>`;
  mountCharts(root);
  bindRangeControl(root, st, () => render(root, app));
  root.querySelector("[data-go-inventory]")?.addEventListener("click", () => { app.ui.inventory = { ...(app.ui.inventory || {}), status: "attention" }; app.navigate("inventory"); });
}
