import { freshView } from "../ui.js";
import { t } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, money, pageHead, section, emptyState, imgSrc, btn, select, field, toast, errorMessage, openModal, closeModal, invoiceHTML, printHTML, paginate, pager } from "../ui.js";
import { store, CREDIT_METHOD } from "../store.js";

const cart = new Map(); // product_id -> qty
let state = { search: "", cat: null, page: 1, discount: 0, method: "Cash", customer: "", received: null, lastSale: null };

function cartItems() { return [...cart.entries()].map(([id, qty]) => ({ product: store.getProduct(id), qty })).filter((x) => x.product); }
function totals() {
  const sub = cartItems().reduce((s, { product, qty }) => s + product.selling_price * qty, 0);
  const discount = Math.max(0, Math.min(Number(state.discount) || 0, sub)); const total = Math.round((sub - discount) * 100) / 100;
  return { sub, discount, total };
}
function add(p) { const cur = cart.get(p.id) || 0; if (cur + 1 > p.quantity) { toast(t("pos.stock_limit", { n: p.quantity }), "error"); return; } cart.set(p.id, cur + 1); state.received = null; }
function setQty(p, qty) { if (qty <= 0) cart.delete(p.id); else cart.set(p.id, Math.min(qty, p.quantity)); if (qty > p.quantity) toast(t("pos.stock_limit", { n: p.quantity }), "error"); state.received = null; }
function clearCart() { cart.clear(); state.discount = 0; state.received = null; state.customer = ""; }

export function render(_root, app) {
  const root = freshView();
  if (state.lastSale) return renderSuccess(root, app);
  const products = store.getProducts({ search: state.search, categoryId: state.cat });
  const pg = paginate(products, "page", 24, state); const cats = store.categories;
  root.innerHTML = `${pageHead(t("pos.title"), t("pos.subtitle"))}
  <div class="grid grid-7-5">
    <div class="card">
      <div class="search" style="max-width:none"><span class="search-icon">${icon("search", 17)}</span><input id="posSearch" type="search" placeholder="${esc(t("pos.search"))}" value="${esc(state.search)}" autocomplete="off"/></div>
      <div class="pills" id="posCats" style="margin:12px 0"><button type="button" class="pill ${state.cat === null ? "active" : ""}" data-cat="">${esc(t("common.all"))}</button>${cats.map((c) => `<button type="button" class="pill ${state.cat === c.id ? "active" : ""}" data-cat="${c.id}">${esc(c.name)}</button>`).join("")}</div>
      ${pg.items.length ? `<div class="pos-grid" id="posGrid">${pg.items.map((p) => productCard(p)).join("")}</div>${pager(pg, "page")}` : emptyState(t("pos.no_products"))}
    </div>
    <div class="card cart" id="cartCard">${cartHTML()}</div>
  </div>
  <button type="button" class="btn primary cart-fab" id="cartFab">${icon("shopping-cart", 16)}<span>${esc(t("pos.view_cart"))} (${[...cart.values()].reduce((a, b) => a + b, 0)})</span></button>`;
  bind(root, app);
}
function productCard(p) {
  const inCart = cart.get(p.id) || 0; const out = p.quantity <= 0;
  const stock = out ? t("pos.out_of_stock") : `${p.quantity} ${t("pos.in_stock")}`;
  return `<button type="button" class="product ${out ? "out" : ""}" data-add="${p.id}" ${out ? "disabled" : ""}><img src="${imgSrc(p)}" alt="" loading="lazy"/>${inCart ? `<span class="in-cart">${inCart}</span>` : ""}<div class="meta"><div class="name">${esc(p.name)}</div><div class="price num">${money(p.selling_price)}</div><div class="stock ${p.status}">${esc(stock)}</div></div></button>`;
}
function cartHTML(inModal = false) {
  const items = cartItems(); const n = items.reduce((s, i) => s + i.qty, 0);
  const head = inModal ? "" : section(t("pos.cart"), "shopping-cart", items.length ? `${n} ${t("common.items")}` : "");
  if (!items.length) return `${head}${emptyState(t("pos.empty_cart"), t("pos.empty_cart_hint"), "empty_cart.png")}`;
  const { sub, discount, total } = totals(); const isCredit = state.method === CREDIT_METHOD;
  if (state.received === null) state.received = isCredit ? 0 : total;
  const received = Number(state.received) || 0; const change = received - total;
  const customers = store.getCustomers();
  const changeBox = isCredit && change < 0 ? `<div class="change credit"><span>${esc(t("pos.credit_due"))}</span><span class="num">${money(-change)}</span></div>` : change < 0 ? `<div class="change warn"><span>${esc(t("pos.short"))}</span><span class="num">${money(received)} / ${money(total)}</span></div>` : `<div class="change"><span>${esc(t("pos.change"))}</span><span class="num">${money(change)}</span></div>`;
  const canCheckout = isCredit ? !!state.customer : received + 0.001 >= total;
  return `${head}
  <div class="cart-lines">${items.map(({ product: p, qty }) => `<div class="cart-line"><div><div class="n">${esc(p.name)}</div><div class="p num">${money(p.selling_price)} × ${qty}</div></div><div class="qty"><button type="button" data-dec="${p.id}" aria-label="-">${icon("minus", 14)}</button><span class="num">${qty}</span><button type="button" data-inc="${p.id}" aria-label="+">${icon("plus", 14)}</button></div><div class="lt num">${money(p.selling_price * qty)}</div><button type="button" class="btn-icon danger" data-rm="${p.id}" aria-label="${esc(t("common.delete"))}">${icon("x", 14)}</button></div>`).join("")}</div>
  <div class="form-grid" style="margin-top:12px">
    ${field(t("pos.discount"), `<input type="number" min="0" max="${sub}" step="1" name="discount" value="${discount}" inputmode="decimal"/>`)}
    ${field(t("common.payment_method"), select("method", store.paymentMethods, state.method))}
    ${field(t("common.customer"), select("customer", [["", t("common.walk_in")], ...customers.map((c) => [c.id, `${c.name} · ${c.phone || ""}`])], state.customer), { cls: "span-2" })}
    ${isCredit ? `<div class="alert info span-2">${icon("info", 14)}<span>${esc(t("pos.credit_hint"))}</span></div>` : ""}
    <div class="field"><label>${esc(t("pos.received"))}</label><div style="display:flex;gap:8px"><input type="number" min="0" step="1" name="received" value="${received}" inputmode="decimal" style="flex:1"/><button type="button" class="btn sm" data-exact>${esc(t("pos.exact"))}</button></div></div>
  </div>
  <div class="totals"><div class="l"><span>${esc(t("pos.subtotal"))}</span><b class="num">${money(sub)}</b></div><div class="l"><span>${esc(t("pos.discount"))}</span><b class="num">- ${money(discount)}</b></div><div class="grand"><span>${esc(t("pos.total"))}</span><b class="num">${money(total)}</b></div></div>
  ${changeBox}
  <div style="display:flex;gap:8px;margin-top:12px">${btn(t("pos.checkout"), { cls: "primary lg", ic: "check", attrs: `data-checkout style="flex:2.4" ${canCheckout ? "" : "disabled"}` })}${btn(t("common.clear"), { ic: "trash-2", attrs: 'data-clear style="flex:1"' })}</div>`;
}
function refreshCart(root) {
  // Listeners live on the container elements, so only the inner markup is replaced here.
  const card = root.querySelector("#cartCard"); if (card) card.innerHTML = cartHTML();
  const modalBody = document.querySelector("#modalRoot .modal-body #cartModal"); if (modalBody) modalBody.innerHTML = cartHTML(true);
  const fab = root.querySelector("#cartFab span"); if (fab) fab.textContent = `${t("pos.view_cart")} (${[...cart.values()].reduce((a, b) => a + b, 0)})`;
  root.querySelectorAll("[data-add]").forEach((b) => { const id = Number(b.dataset.add); const q = cart.get(id); let badge = b.querySelector(".in-cart"); if (q) { if (!badge) { badge = document.createElement("span"); badge.className = "in-cart"; b.appendChild(badge); } badge.textContent = q; } else if (badge) badge.remove(); });
}
function bindCart(el, root) {
  el.addEventListener("click", (e) => {
    const dec = e.target.closest("[data-dec]"), inc = e.target.closest("[data-inc]"), rm = e.target.closest("[data-rm]");
    if (dec) { const p = store.getProduct(Number(dec.dataset.dec)); setQty(p, (cart.get(p.id) || 0) - 1); refreshCart(root); }
    else if (inc) { const p = store.getProduct(Number(inc.dataset.inc)); setQty(p, (cart.get(p.id) || 0) + 1); refreshCart(root); }
    else if (rm) { const p = store.getProduct(Number(rm.dataset.rm)); setQty(p, 0); refreshCart(root); }
    else if (e.target.closest("[data-exact]")) { state.received = totals().total; refreshCart(root); }
    else if (e.target.closest("[data-clear]")) { clearCart(); refreshCart(root); }
    else if (e.target.closest("[data-checkout]")) checkout(root);
  });
  el.addEventListener("change", (e) => {
    const n = e.target.name; if (!n) return;
    if (n === "discount") { state.discount = Number(e.target.value) || 0; state.received = null; }
    else if (n === "method") { state.method = e.target.value; state.received = null; }
    else if (n === "customer") state.customer = e.target.value;
    else if (n === "received") state.received = Number(e.target.value) || 0;
    refreshCart(root);
  });
  el.addEventListener("input", (e) => { if (e.target.name === "received") { state.received = Number(e.target.value) || 0; const { total } = totals(); const btnEl = el.querySelector("[data-checkout]"); if (btnEl && state.method !== CREDIT_METHOD) btnEl.disabled = state.received + 0.001 < total; } });
}
function bind(root, app) {
  root.querySelector("#posSearch").addEventListener("input", (e) => { state.search = e.target.value; state.page = 1; const grid = root.querySelector("#posGrid"); render(root, app); const inp = root.querySelector("#posSearch"); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); });
  root.querySelector("#posCats").addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (!b) return; state.cat = b.dataset.cat ? Number(b.dataset.cat) : null; state.page = 1; render(root, app); });
  root.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-add]"); if (addBtn) { const p = store.getProduct(Number(addBtn.dataset.add)); add(p); refreshCart(root); return; }
    const pg = e.target.closest("[data-pager]"); if (pg) { state.page += Number(pg.dataset.dir); render(root, app); return; }
    if (e.target.closest("#cartFab")) { openModal({ title: t("pos.cart"), ic: "shopping-cart", body: `<div id="cartModal">${cartHTML(true)}</div>`, onMount: (m) => bindCart(m.querySelector("#cartModal"), root) }); }
  });
  bindCart(root.querySelector("#cartCard"), root);
}
function checkout(root) {
  try {
    const result = store.createSale({ items: cartItems().map(({ product, qty }) => ({ product_id: product.id, qty, unit_price: product.selling_price })), discount: state.discount, payment_method: state.method, amount_received: state.received, customer_id: state.customer ? Number(state.customer) : null });
    clearCart(); closeModal(); state.lastSale = result.id; renderSuccess(root);
  } catch (e) { toast(errorMessage(e), "error"); }
}
function renderSuccess(root) {
  const sale = store.getSale(state.lastSale); if (!sale) { state.lastSale = null; return; }
  const sub = sale.credit_amount ? `${t("pos.credit_due")}: ${money(sale.credit_amount)}` : `${t("pos.change")}: ${money(sale.change_due)}`;
  root.innerHTML = `${pageHead(t("pos.title"), t("pos.subtitle"))}<div class="grid grid-2" style="grid-template-columns:1fr 1.4fr">
    <div class="stack"><div class="card success"><div class="ring">${icon("check", 26)}</div><h3>${esc(t("pos.sale_done"))}</h3><p class="muted">${esc(sale.invoice_no)} · ${esc(sale.payment_method)}</p><div class="big num">${money(sale.total)}</div><p class="muted">${esc(sub)}</p></div>
    ${btn(t("pos.new_sale"), { cls: "primary block lg", ic: "shopping-cart", attrs: 'data-new' })}${btn(`${t("common.print")} ${t("pos.receipt")}`, { cls: "block", ic: "printer", attrs: 'data-print' })}</div>
    <div>${invoiceHTML(sale)}</div></div>`;
  root.querySelector("[data-new]").addEventListener("click", () => { state.lastSale = null; render(root); });
  root.querySelector("[data-print]").addEventListener("click", () => printHTML(invoiceHTML(sale)));
}
