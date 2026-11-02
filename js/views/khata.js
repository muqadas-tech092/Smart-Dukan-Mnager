import { freshView } from "../ui.js";
import { t } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, money, fmtDate, initials, pageHead, kpi, section, emptyState, badge, btn, iconBtn, field, input, select, formValues, openModal, closeModal, toast, errorMessage, table, paginate, pager, statementHTML, printHTML, copyText } from "../ui.js";
import { store, CREDIT_METHOD } from "../store.js";

export function render(_root, app) {
  const root = freshView();
  const st = app.ui.khata || (app.ui.khata = { search: "", onlyDue: true, page: 1, customer: null });
  if (app.params && app.params.customer) { st.customer = Number(app.params.customer); app.params = {}; }
  const summary = store.khataSummary(); const customers = store.getCustomers();
  const selected = st.customer ? store.getCustomer(st.customer) : null;
  let rows = customers.filter((c) => (!st.onlyDue || c.balance > 0) && (!st.search || c.name.toLowerCase().includes(st.search.toLowerCase()) || (c.phone || "").includes(st.search))).sort((a, b) => b.balance - a.balance);
  const pg = paginate(rows, "page", 10, st);
  root.innerHTML = `${pageHead(t("khata.title"), t("khata.subtitle"))}
  <div class="grid grid-4">
    ${kpi({ label: t("khata.outstanding"), value: money(summary.outstanding), ic: "book-open", tone: summary.outstanding ? "red" : "emerald" })}
    ${kpi({ label: t("khata.total_credit"), value: money(summary.total_credit), ic: "arrow-up-right", tone: "amber" })}
    ${kpi({ label: t("khata.total_paid"), value: money(summary.total_paid), ic: "arrow-down-right", tone: "emerald" })}
    ${kpi({ label: t("khata.customers_due"), value: String(summary.with_balance), ic: "users", tone: "navy" })}
  </div>
  <div class="card" style="margin-top:14px">
    <div class="toolbar">
      ${field(t("common.search"), `<input name="search" type="search" value="${esc(st.search)}" placeholder="${esc(t("common.name"))} / ${esc(t("common.phone"))}"/>`, { cls: "grow" })}
      ${field(t("common.customer"), select("customer", [["", t("khata.select_customer")], ...customers.map((c) => [c.id, `${c.name} · ${money(c.balance)}`])], st.customer || ""), { cls: "grow" })}
      <label class="switch" style="padding-bottom:10px"><input type="checkbox" name="onlyDue" ${st.onlyDue ? "checked" : ""}/><span>${esc(t("khata.filter_due"))}</span></label>
    </div>
    ${selected ? `<div id="khataDetail" style="margin-top:14px">${detailHTML(selected)}</div><hr style="border:none;border-top:1px solid var(--line);margin:16px 0"/>` : ""}
    <div style="height:12px"></div>
    ${rows.length ? table({ columns: [{ label: t("common.customer"), cls: "cell-primary" }, { label: t("common.phone"), cls: "sm-hide" }, { label: t("khata.total_credit"), cls: "num sm-hide" }, { label: t("khata.total_paid"), cls: "num sm-hide" }, { label: t("cust.balance"), cls: "num" }, { label: t("khata.last_payment"), cls: "sm-hide" }, { label: t("common.actions"), cls: "actions-cell" }],
      rows: pg.items.map((c) => ({ cells: [`<div class="cell-main"><span class="avatar soft">${esc(initials(c.name))}</span><div class="t"><b>${esc(c.name)}</b><span>${esc(c.address || "")}</span></div></div>`, esc(c.phone || "-"), `<span class="num">${money(c.total_credit)}</span>`, `<span class="num">${money(c.total_paid)}</span>`, badge(money(c.balance), c.balance > 0 ? "out" : "ok"), `<span class="muted">${fmtDate(c.last_payment)}</span>`,
        `<div class="actions">${iconBtn("hand-coins", t("khata.record_payment"), `data-pay="${c.id}"`)}${iconBtn("arrow-right", t("cust.open_khata"), `data-open="${c.id}"`)}</div>`] })) }) + pager(pg, "page")
      : emptyState(t("khata.no_customers"), t("khata.no_customers_hint"), "empty_users.png")}
  </div>`;
  const tb = root.querySelector(".toolbar");
  tb.querySelector('input[name="search"]').addEventListener("input", (e) => { st.search = e.target.value; st.page = 1; const pos = e.target.selectionStart; render(root, app); const i = root.querySelector('input[name="search"]'); i.focus(); i.setSelectionRange(pos, pos); });
  tb.querySelector('select[name="customer"]').addEventListener("change", (e) => { st.customer = e.target.value ? Number(e.target.value) : null; render(root, app); });
  tb.querySelector('input[name="onlyDue"]').addEventListener("change", (e) => { st.onlyDue = e.target.checked; st.page = 1; render(root, app); });
  root.addEventListener("click", (e) => {
    const id = (a) => { const b = e.target.closest(`[${a}]`); return b ? Number(b.getAttribute(a)) : null; };
    if (id("data-pay")) return paymentDialog(store.getCustomer(id("data-pay")), () => render(root, app));
    if (id("data-open")) { st.customer = id("data-open"); render(root, app); return; }
    if (e.target.closest("[data-detail-pay]")) return paymentDialog(selected, () => render(root, app));
    if (e.target.closest("[data-detail-credit]")) return creditDialog(selected, () => render(root, app));
    if (e.target.closest("[data-detail-stmt]")) return statementDialog(selected);
    if (e.target.closest("[data-detail-remind]")) return reminderDialog(selected);
    const pg2 = e.target.closest("[data-pager]"); if (pg2) { st.page += Number(pg2.dataset.dir); render(root, app); }
  });
}
function detailHTML(c) {
  const ledger = store.getLedger(c.id).slice(-40).reverse();
  return `<div class="hero"><span class="avatar soft" style="width:48px;height:48px;font-size:1rem">${esc(initials(c.name))}</span><div class="t"><h2>${esc(c.name)}</h2><p><span>${icon("phone", 13)} ${esc(c.phone || "-")}</span><span>${icon("map-pin", 13)} ${esc(c.address || "-")}</span><span>${icon("clock", 13)} ${esc(t("khata.last_payment"))}: ${fmtDate(c.last_payment)}</span></p></div>
    <div class="stat"><b class="num" style="color:${c.balance > 0 ? "var(--red)" : "var(--green)"}">${money(c.balance)}</b><span>${esc(t("cust.balance"))}</span></div><div class="stat"><b class="plain num">${money(c.total_credit)}</b><span>${esc(t("khata.total_credit"))}</span></div><div class="stat"><b class="plain num">${money(c.total_paid)}</b><span>${esc(t("khata.total_paid"))}</span></div></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px">${btn(t("khata.record_payment"), { cls: "primary", ic: "hand-coins", attrs: `data-detail-pay ${c.balance <= 0 ? "disabled" : ""}` })}${btn(t("khata.add_credit"), { ic: "plus", attrs: "data-detail-credit" })}${btn(t("khata.view_statement"), { ic: "file-text", attrs: "data-detail-stmt" })}${btn(t("khata.send_reminder"), { ic: "mail", attrs: "data-detail-remind" })}</div>
  ${section(t("khata.history"), "history")}
  ${ledger.length ? table({ cls: "", columns: [{ label: t("common.date") }, { label: "" }, { label: t("common.description") }, { label: t("common.amount"), cls: "num" }, { label: t("khata.running"), cls: "num" }], rows: ledger.map((r) => { const cr = r.type === "credit"; return { cells: [`<span class="muted">${fmtDate(r.created_at, true)}</span>`, badge(cr ? t("khata.credit") : t("khata.payment"), cr ? "low" : "ok", cr ? "arrow-up-right" : "arrow-down-right"), `${esc(r.note || r.invoice_no || "")}${r.payment_method ? ` · ${esc(r.payment_method)}` : ""}`, `<b class="num" style="color:${cr ? "var(--amber)" : "var(--green)"}">${cr ? "+" : "-"} ${money(r.amount)}</b>`, `<span class="num">${money(r.running_balance)}</span>`] }; }) }) : emptyState(t("khata.no_customers"), t("khata.no_customers_hint"), "empty_receipt.png")}`;
}
export function paymentDialog(c, done) {
  const methods = store.paymentMethods.filter((m) => m !== CREDIT_METHOD);
  openModal({ title: t("khata.record_payment"), ic: "hand-coins", body: `<p class="muted" style="margin:0 0 10px">${esc(c.name)} · ${esc(t("cust.balance"))}: <b class="num">${money(c.balance)}</b></p><form id="pay" novalidate><div class="form-grid">${field(t("common.amount"), input("amount", Math.max(c.balance, 0), 'type="number" min="1" step="1" inputmode="decimal" required'))}${field(t("common.payment_method"), select("method", methods, methods[0]))}${field(t("common.notes"), input("note", ""), { cls: "span-2", optional: true })}</div><div id="payHint" style="margin-top:10px"></div></form>`,
    footer: btn(t("common.cancel"), { attrs: "data-close" }) + btn(t("common.save"), { cls: "primary", ic: "save", attrs: "data-save" }), onMount: (m) => {
      const form = m.querySelector("#pay"); const hint = m.querySelector("#payHint");
      const upd = () => { const a = Number(form.amount.value) || 0; const rem = c.balance - a; hint.innerHTML = a > 0 ? (rem <= 0 ? `<div class="change">${esc(t("khata.clear_balance"))}</div>` : `<div class="change warn"><span>${esc(t("khata.remaining"))}</span><span class="num">${money(rem)}</span></div>`) : ""; };
      form.addEventListener("input", upd); upd();
      const save = () => { try { const v = formValues(form); store.recordPayment(c.id, Number(v.amount), v.method, v.note); closeModal(); toast(t("khata.payment_recorded")); done(); } catch (e) { toast(errorMessage(e), "error"); } };
      m.querySelector("[data-save]").addEventListener("click", save); form.addEventListener("submit", (e) => { e.preventDefault(); save(); });
    } });
}
function creditDialog(c, done) {
  openModal({ title: t("khata.add_credit"), ic: "plus", body: `<p class="muted" style="margin:0 0 10px">${esc(c.name)}</p><form id="cr" novalidate><div class="form-grid">${field(t("common.amount"), input("amount", "", 'type="number" min="1" step="1" inputmode="decimal" required'))}${field(t("common.notes"), input("note", ""), { optional: true })}</div></form>`,
    footer: btn(t("common.cancel"), { attrs: "data-close" }) + btn(t("common.save"), { cls: "primary", ic: "save", attrs: "data-save" }), onMount: (m) => {
      const save = () => { try { const v = formValues(m.querySelector("#cr")); store.addCredit(c.id, Number(v.amount), v.note); closeModal(); toast(t("khata.credit_recorded")); done(); } catch (e) { toast(errorMessage(e), "error"); } };
      m.querySelector("[data-save]").addEventListener("click", save); m.querySelector("#cr").addEventListener("submit", (e) => { e.preventDefault(); save(); });
    } });
}
function statementDialog(c) {
  const html = statementHTML(c, store.getLedger(c.id));
  openModal({ title: t("khata.statement"), ic: "file-text", size: "lg", body: html, footer: btn(t("common.close"), { attrs: "data-close" }) + btn(t("common.print"), { cls: "primary", ic: "printer", attrs: "data-print" }), onMount: (m) => m.querySelector("[data-print]").addEventListener("click", () => printHTML(html)) });
}
function reminderDialog(c) {
  const text = t("khata.reminder_text", { name: c.name, shop: store.settings.shop_name, amount: (c.balance || 0).toLocaleString("en-US") });
  const phone = (c.phone || "").replace(/\D/g, "").replace(/^0/, "92");
  openModal({ title: t("khata.send_reminder"), ic: "mail", body: `<textarea class="input" rows="4" readonly style="width:100%">${esc(text)}</textarea>`, footer: btn(t("common.copy"), { ic: "copy", attrs: "data-copy" }) + (phone ? `<a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent(text)}">${icon("smartphone", 16)}<span>${esc(t("khata.whatsapp"))}</span></a>` : ""), onMount: (m) => m.querySelector("[data-copy]").addEventListener("click", () => copyText(text)) });
}
