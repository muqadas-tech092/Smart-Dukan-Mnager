import { freshView } from "../ui.js";
import { t } from "../i18n.js";
import { esc, money, fmtDate, initials, pageHead, kpi, emptyState, badge, btn, iconBtn, field, input, formValues, setError, openModal, closeModal, confirmDialog, toast, table, paginate, pager } from "../ui.js";
import { store } from "../store.js";

export function render(_root, app) {
  const root = freshView();
  const st = app.ui.customers || (app.ui.customers = { search: "", page: 1 });
  const summary = store.khataSummary(); const customers = store.getCustomers(st.search); const pg = paginate(customers, "page", 10, st);
  root.innerHTML = `${pageHead(t("cust.title"), t("cust.subtitle"), btn(t("cust.add"), { cls: "primary", ic: "user-plus", attrs: "data-add" }))}
  <div class="grid grid-3">
    ${kpi({ label: t("cust.total"), value: String(summary.customers), ic: "users", tone: "emerald" })}
    ${kpi({ label: t("cust.with_balance"), value: String(summary.with_balance), ic: "hand-coins", tone: summary.with_balance ? "amber" : "emerald" })}
    ${kpi({ label: t("cust.balance"), value: money(summary.outstanding), ic: "book-open", tone: summary.outstanding ? "red" : "emerald" })}
  </div>
  <div class="card" style="margin-top:14px">
    <div class="toolbar">${field(t("common.search"), `<input name="search" type="search" value="${esc(st.search)}" placeholder="${esc(t("common.name"))} / ${esc(t("common.phone"))}"/>`, { cls: "grow" })}</div>
    <div style="height:12px"></div>
    ${customers.length ? table({ columns: [{ label: t("common.customer"), cls: "cell-primary" }, { label: t("common.phone") }, { label: t("common.address"), cls: "sm-hide" }, { label: t("cust.purchases"), cls: "num sm-hide" }, { label: t("khata.total_credit"), cls: "num sm-hide" }, { label: t("khata.total_paid"), cls: "num sm-hide" }, { label: t("cust.balance"), cls: "num" }, { label: t("common.actions"), cls: "actions-cell" }],
      rows: pg.items.map((c) => ({ cells: [`<div class="cell-main"><span class="avatar soft">${esc(initials(c.name))}</span><div class="t"><b>${esc(c.name)}</b><span>${esc(t("cust.member_since"))} ${fmtDate(c.created_at)}</span></div></div>`, esc(c.phone || "-"), esc(c.address || "-"), `<span class="num">${c.purchases}</span>`, `<span class="num">${money(c.total_credit)}</span>`, `<span class="num">${money(c.total_paid)}</span>`, badge(money(c.balance), c.balance > 0 ? "out" : "ok"),
        `<div class="actions">${iconBtn("book-open", t("cust.open_khata"), `data-khata="${c.id}"`)}${iconBtn("pencil", t("common.edit"), `data-edit="${c.id}"`)}${iconBtn("trash-2", t("common.delete"), `data-delete="${c.id}"`, "danger")}</div>`] })) }) + pager(pg, "page")
      : emptyState(t("cust.no_customers"), t("cust.no_customers_hint"), "empty_users.png")}
  </div>`;
  root.querySelector('input[name="search"]').addEventListener("input", (e) => { st.search = e.target.value; st.page = 1; const pos = e.target.selectionStart; render(root, app); const i = root.querySelector('input[name="search"]'); i.focus(); i.setSelectionRange(pos, pos); });
  root.addEventListener("click", async (e) => {
    const id = (a) => { const b = e.target.closest(`[${a}]`); return b ? Number(b.getAttribute(a)) : null; };
    if (e.target.closest("[data-add]")) return customerDialog(null, root, app);
    if (id("data-edit")) return customerDialog(store.getCustomer(id("data-edit")), root, app);
    if (id("data-khata")) return app.navigate("khata", { customer: id("data-khata") });
    if (id("data-delete")) { const c = store.getCustomer(id("data-delete")); if (await confirmDialog({ title: t("common.delete"), body: `${t("common.delete")}: ${c.name}` })) { if (store.deleteCustomer(c.id)) { toast(t("common.deleted")); render(root, app); } else toast(t("cust.delete_blocked"), "error"); } return; }
    const pg2 = e.target.closest("[data-pager]"); if (pg2) { st.page += Number(pg2.dataset.dir); render(root, app); }
  });
}
export function customerDialog(existing, root, app, onSaved) {
  const e = existing || {};
  openModal({ title: existing ? t("cust.edit") : t("cust.add"), ic: "user", body: `<form id="cf" novalidate><div class="form-grid">${field(t("common.name"), input("name", e.name || "", "required"), { cls: "span-2" })}${field(t("common.phone"), input("phone", e.phone || "", 'placeholder="03xx-xxxxxxx" inputmode="tel"'))}${field(t("common.address"), input("address", e.address || ""))}${field(t("common.notes"), `<textarea name="notes">${esc(e.notes || "")}</textarea>`, { cls: "span-2", optional: true })}</div></form>`,
    footer: btn(t("common.cancel"), { attrs: "data-close" }) + btn(t("common.save"), { cls: "primary", ic: "save", attrs: "data-save" }), onMount: (m) => {
      const save = () => { const form = m.querySelector("#cf"); const v = formValues(form); if (!v.name) { setError(form, "name", t("common.required")); return; } const id = existing ? (store.updateCustomer(existing.id, v), existing.id) : store.addCustomer(v); closeModal(); toast(t("common.saved")); if (onSaved) onSaved(id); else render(root, app); };
      m.querySelector("[data-save]").addEventListener("click", save); m.querySelector("#cf").addEventListener("submit", (ev) => { ev.preventDefault(); save(); });
    } });
}
