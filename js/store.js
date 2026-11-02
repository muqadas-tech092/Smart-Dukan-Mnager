/* Data store: all business rules live here. State is a plain object persisted to IndexedDB
   (with a localStorage fallback) under the configured storage key, so every shop's data stays
   on its own device. */
const CFG = window.SDM_CONFIG || {};
const DEF = CFG.defaults || {};
export const CREDIT_METHOD = DEF.creditMethod || "Credit (Udhaar)";
const KEY = `${CFG.storageKey || "sdm"}:state`;

// ---------------------------------------------------------------- persistence
function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return resolve(null);
    const req = indexedDB.open(`${CFG.storageKey || "sdm"}-db`, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}
async function idbGet(db, key) {
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction("kv", "readonly"); const req = tx.objectStore("kv").get(key);
    req.onsuccess = () => resolve(req.result ?? null); req.onerror = () => resolve(null);
  });
}
async function idbSet(db, key, value) {
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, key);
    tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false);
  });
}

// ---------------------------------------------------------------- helpers
export const nowISO = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
export const todayISO = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return todayISO(d); };
const p2 = (n) => String(n).padStart(2, "0");
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inRange = (ts, start, end) => ts.slice(0, 10) >= start && ts.slice(0, 10) <= end;

function emptyState() {
  return {
    version: 1,
    setupDone: false,
    settings: {
      shop_name: "", owner_name: "", phone: "", address: "", currency_symbol: DEF.currencySymbol || "Rs.",
      low_stock_default: DEF.lowStockThreshold || 10, language: DEF.language || "en", invoice_prefix: DEF.invoicePrefix || "INV",
      receipt_footer: DEF.receiptFooter || "", logo_data: "", primary_color: "",
      payment_methods: (DEF.paymentMethods || ["Cash"]).slice(), expense_categories: (DEF.expenseCategories || ["Other"]).slice(),
    },
    seq: { product: 0, customer: 0, sale: 0, khata: 0, expense: 0, movement: 0, category: 0 },
    categories: [], products: [], customers: [], sales: [], khata: [], expenses: [], movements: [],
  };
}

// ---------------------------------------------------------------- store
class Store {
  constructor() { this.state = emptyState(); this.db = null; this.listeners = new Set(); this._saveTimer = null; }

  async load() {
    this.db = await openDB();
    let raw = await idbGet(this.db, KEY);
    if (!raw) { try { raw = localStorage.getItem(KEY); } catch { raw = null; } }
    if (raw) {
      try { const parsed = typeof raw === "string" ? JSON.parse(raw) : raw; this.state = { ...emptyState(), ...parsed }; this.state.settings = { ...emptyState().settings, ...(parsed.settings || {}) }; } catch { /* corrupt: start fresh */ }
    }
    return this.state;
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  commit() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.persist(), 150);
    for (const fn of this.listeners) fn(this.state);
  }
  async persist() {
    const json = JSON.stringify(this.state);
    const ok = await idbSet(this.db, KEY, json);
    if (!ok) { try { localStorage.setItem(KEY, json); } catch { /* storage full */ } }
  }
  exportJSON() { return JSON.stringify(this.state, null, 2); }
  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.products)) throw new Error("Not a valid backup file");
    this.state = { ...emptyState(), ...parsed }; this.state.setupDone = true; this.commit();
  }
  async reset() {
    this.state = emptyState();
    await idbSet(this.db, KEY, JSON.stringify(this.state));
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    for (const fn of this.listeners) fn(this.state);
  }
  nextId(kind) { this.state.seq[kind] = (this.state.seq[kind] || 0) + 1; return this.state.seq[kind]; }

  // ------------------------------------------------------------ settings
  get settings() { return this.state.settings; }
  setSettings(values) { Object.assign(this.state.settings, values); this.commit(); }
  get paymentMethods() { return [...(this.settings.payment_methods || []), CREDIT_METHOD]; }
  get expenseCategories() { return this.settings.expense_categories || []; }

  // ------------------------------------------------------------ categories
  get categories() { return [...this.state.categories].sort((a, b) => a.name.localeCompare(b.name)); }
  addCategory(name, name_ur = "") {
    const clean = String(name || "").trim(); if (!clean) return null;
    const existing = this.state.categories.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing.id;
    const id = this.nextId("category"); this.state.categories.push({ id, name: clean, name_ur }); this.commit(); return id;
  }
  categoryName(id) { const c = this.state.categories.find((x) => x.id === id); return c ? c.name : ""; }

  // ------------------------------------------------------------ products
  stockStatus(p) { return p.quantity <= 0 ? "out" : p.quantity <= p.low_stock_threshold ? "low" : "ok"; }
  decorate(p) { return { ...p, status: this.stockStatus(p), category: this.categoryName(p.category_id) }; }
  getProducts({ search = "", categoryId = null, status = null, includeInactive = false } = {}) {
    const q = search.trim().toLowerCase();
    let list = this.state.products.filter((p) => includeInactive || p.is_active);
    if (q) list = list.filter((p) => [p.name, p.sku, p.barcode, p.name_ur].some((v) => (v || "").toLowerCase().includes(q)));
    if (categoryId) list = list.filter((p) => p.category_id === categoryId);
    list = list.map((p) => this.decorate(p));
    if (status === "attention") list = list.filter((p) => p.status !== "ok");
    else if (status) list = list.filter((p) => p.status === status);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }
  getProduct(id) { const p = this.state.products.find((x) => x.id === id); return p ? this.decorate(p) : null; }
  nextSku() { let n = this.state.products.length + 1; while (this.state.products.some((p) => p.sku === `SKU-${String(n).padStart(4, "0")}`)) n++; return `SKU-${String(n).padStart(4, "0")}`; }
  addProduct(data) {
    const sku = (data.sku || "").trim() || this.nextSku();
    if (this.state.products.some((p) => p.sku === sku)) throw new Error("err.sku_exists");
    const id = this.nextId("product");
    const p = { id, name: data.name.trim(), name_ur: data.name_ur || "", sku, barcode: data.barcode || "", category_id: data.category_id || null,
      purchase_price: Number(data.purchase_price) || 0, selling_price: Number(data.selling_price) || 0, quantity: parseInt(data.quantity) || 0,
      low_stock_threshold: parseInt(data.low_stock_threshold) || 0, unit: data.unit || "pcs", image_data: data.image_data || "", is_active: true, created_at: nowISO() };
    this.state.products.push(p);
    if (p.quantity) this._movement(id, p.quantity, "opening", "");
    this.commit(); return id;
  }
  updateProduct(id, data) {
    const p = this.state.products.find((x) => x.id === id); if (!p) return;
    const sku = (data.sku || "").trim() || p.sku;
    if (this.state.products.some((x) => x.sku === sku && x.id !== id)) throw new Error("err.sku_exists");
    const newQty = parseInt(data.quantity); const oldQty = p.quantity;
    Object.assign(p, { name: data.name.trim(), name_ur: data.name_ur || "", sku, barcode: data.barcode || "", category_id: data.category_id || null,
      purchase_price: Number(data.purchase_price) || 0, selling_price: Number(data.selling_price) || 0, quantity: isNaN(newQty) ? oldQty : newQty,
      low_stock_threshold: parseInt(data.low_stock_threshold) || 0, unit: data.unit || "pcs" });
    if (data.image_data !== undefined) p.image_data = data.image_data;
    if (!isNaN(newQty) && newQty !== oldQty) this._movement(id, newQty - oldQty, "adjustment", "edit");
    this.commit();
  }
  setProductImage(id, dataUrl) { const p = this.state.products.find((x) => x.id === id); if (p) { p.image_data = dataUrl || ""; this.commit(); } }
  adjustStock(id, change, reason = "adjustment", reference = "") {
    const p = this.state.products.find((x) => x.id === id); if (!p) return;
    p.quantity = Math.max(0, p.quantity + change); this._movement(id, change, reason, reference); this.commit();
  }
  deleteProduct(id) { const p = this.state.products.find((x) => x.id === id); if (p) { p.is_active = false; this.commit(); } }
  _movement(product_id, change, reason, reference, ts) { this.state.movements.push({ id: this.nextId("movement"), product_id, change, reason, reference, created_at: ts || nowISO() }); }
  getMovements(product_id, limit = 25) { return this.state.movements.filter((m) => m.product_id === product_id).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).slice(0, limit); }
  importProducts(records) {
    let inserted = 0, updated = 0;
    for (const r of records) {
      const name = String(r.name || "").trim(); if (!name) continue;
      const catName = String(r.category || "").trim();
      const payload = { name, name_ur: r.name_ur || "", sku: String(r.sku || "").trim(), barcode: String(r.barcode || ""), category_id: catName ? this.addCategory(catName) : null,
        purchase_price: Number(r.purchase_price) || 0, selling_price: Number(r.selling_price) || 0, quantity: parseInt(r.quantity) || 0,
        low_stock_threshold: parseInt(r.low_stock_threshold) || this.settings.low_stock_default, unit: r.unit || "pcs" };
      const existing = payload.sku ? this.state.products.find((p) => p.sku === payload.sku) : null;
      if (existing) { this.updateProduct(existing.id, payload); updated++; } else { this.addProduct(payload); inserted++; }
    }
    this.commit(); return { inserted, updated };
  }
  lowStock(limit) { const items = this.getProducts().filter((p) => p.status !== "ok").sort((a, b) => (a.status === "out" ? 0 : 1) - (b.status === "out" ? 0 : 1) || a.quantity - b.quantity); return limit ? items.slice(0, limit) : items; }
  inventoryValue() { const act = this.state.products.filter((p) => p.is_active); return { products: act.length, cost: round2(act.reduce((s, p) => s + p.quantity * p.purchase_price, 0)), retail: round2(act.reduce((s, p) => s + p.quantity * p.selling_price, 0)) }; }

  // ------------------------------------------------------------ customers & khata
  getCustomers(search = "") {
    const q = search.trim().toLowerCase();
    return this.state.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone || "").includes(q))
      .map((c) => this.decorateCustomer(c)).sort((a, b) => a.name.localeCompare(b.name));
  }
  decorateCustomer(c) {
    let credit = 0, paid = 0, last_payment = null, last_activity = null;
    for (const k of this.state.khata) if (k.customer_id === c.id) {
      if (k.type === "credit") credit += k.amount; else { paid += k.amount; if (!last_payment || k.created_at > last_payment) last_payment = k.created_at; }
      if (!last_activity || k.created_at > last_activity) last_activity = k.created_at;
    }
    const purchases = this.state.sales.filter((s) => s.customer_id === c.id).length;
    return { ...c, total_credit: round2(credit), total_paid: round2(paid), balance: round2(credit - paid), last_payment, last_activity, purchases };
  }
  getCustomer(id) { const c = this.state.customers.find((x) => x.id === id); return c ? this.decorateCustomer(c) : null; }
  addCustomer(data) { const id = this.nextId("customer"); this.state.customers.push({ id, name: data.name.trim(), phone: (data.phone || "").trim(), address: (data.address || "").trim(), notes: (data.notes || "").trim(), created_at: nowISO() }); this.commit(); return id; }
  updateCustomer(id, data) { const c = this.state.customers.find((x) => x.id === id); if (c) { Object.assign(c, { name: data.name.trim(), phone: (data.phone || "").trim(), address: (data.address || "").trim(), notes: (data.notes || "").trim() }); this.commit(); } }
  deleteCustomer(id) {
    if (this.state.khata.some((k) => k.customer_id === id) || this.state.sales.some((s) => s.customer_id === id)) return false;
    this.state.customers = this.state.customers.filter((c) => c.id !== id); this.commit(); return true;
  }
  getLedger(customer_id) {
    let bal = 0;
    return this.state.khata.filter((k) => k.customer_id === customer_id).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
      .map((k) => { bal += k.type === "credit" ? k.amount : -k.amount; const sale = k.sale_id ? this.state.sales.find((s) => s.id === k.sale_id) : null; return { ...k, running_balance: round2(bal), invoice_no: sale ? sale.invoice_no : "" }; });
  }
  recordPayment(customer_id, amount, method = "Cash", note = "") {
    if (!(amount > 0)) throw new Error("err.amount_positive");
    this.state.khata.push({ id: this.nextId("khata"), customer_id, type: "payment", amount: round2(amount), sale_id: null, payment_method: method, note, created_at: nowISO() }); this.commit();
  }
  addCredit(customer_id, amount, note = "") {
    if (!(amount > 0)) throw new Error("err.amount_positive");
    this.state.khata.push({ id: this.nextId("khata"), customer_id, type: "credit", amount: round2(amount), sale_id: null, payment_method: null, note, created_at: nowISO() }); this.commit();
  }
  khataSummary() {
    const cs = this.getCustomers();
    return { customers: cs.length, with_balance: cs.filter((c) => c.balance > 0).length, outstanding: round2(cs.reduce((s, c) => s + Math.max(0, c.balance), 0)),
      total_credit: round2(cs.reduce((s, c) => s + c.total_credit, 0)), total_paid: round2(cs.reduce((s, c) => s + c.total_paid, 0)) };
  }

  // ------------------------------------------------------------ sales
  _invoiceNo(ts) {
    const day = ts.slice(0, 10).replace(/-/g, ""); const prefix = this.settings.invoice_prefix || "INV";
    const seq = this.state.sales.filter((s) => s.invoice_no.startsWith(`${prefix}-${day}-`)).length + 1;
    return `${prefix}-${day}-${String(seq).padStart(3, "0")}`;
  }
  createSale({ items, discount = 0, payment_method = "Cash", amount_received = 0, customer_id = null, notes = "", created_at = null }) {
    if (!items || !items.length) throw new Error("Cart is empty");
    let subtotal = 0; const lines = [];
    for (const it of items) {
      const p = this.state.products.find((x) => x.id === it.product_id); if (!p) throw new Error("Product not found");
      const qty = parseInt(it.qty); if (!(qty > 0)) throw new Error("Quantity must be positive");
      if (p.quantity < qty) { const e = new Error("err.insufficient"); e.vars = { name: p.name, n: p.quantity }; throw e; }
      const price = Number(it.unit_price ?? p.selling_price); const line = round2(price * qty); subtotal += line;
      lines.push({ product_id: p.id, product_name: p.name, qty, unit_price: price, unit_cost: p.purchase_price, line_total: line });
    }
    discount = Math.max(0, Math.min(Number(discount) || 0, subtotal));
    const total = round2(subtotal - discount); const received = Math.max(0, Number(amount_received) || 0);
    const isCredit = payment_method === CREDIT_METHOD; let credit_amount = 0, change_due = 0;
    if (isCredit) { if (!customer_id) throw new Error("err.select_customer"); credit_amount = round2(Math.max(0, total - received)); change_due = round2(Math.max(0, received - total)); }
    else { if (received + 0.001 < total) throw new Error("pos.short"); change_due = round2(received - total); }
    const ts = created_at || nowISO(); const id = this.nextId("sale"); const invoice_no = this._invoiceNo(ts);
    this.state.sales.push({ id, invoice_no, customer_id, subtotal: round2(subtotal), discount, total, amount_received: received, change_due, credit_amount, payment_method, status: "completed", notes, created_at: ts, items: lines });
    for (const l of lines) { const p = this.state.products.find((x) => x.id === l.product_id); p.quantity -= l.qty; this._movement(p.id, -l.qty, "sale", invoice_no, ts); }
    if (credit_amount > 0) this.state.khata.push({ id: this.nextId("khata"), customer_id, type: "credit", amount: credit_amount, sale_id: id, payment_method: null, note: `Invoice ${invoice_no}`, created_at: ts });
    this.commit();
    return { id, invoice_no, total, change_due, credit_amount, subtotal: round2(subtotal), discount };
  }
  getSales({ start = null, end = null, search = "", method = "All", customer_id = null, limit = null } = {}) {
    const q = search.trim().toLowerCase();
    let list = this.state.sales.filter((s) => (!start || s.created_at.slice(0, 10) >= start) && (!end || s.created_at.slice(0, 10) <= end)
      && (method === "All" || s.payment_method === method) && (!customer_id || s.customer_id === customer_id));
    list = list.map((s) => ({ ...s, customer_name: s.customer_id ? (this.state.customers.find((c) => c.id === s.customer_id) || {}).name || "" : "", item_count: s.items.reduce((n, i) => n + i.qty, 0) }));
    if (q) list = list.filter((s) => s.invoice_no.toLowerCase().includes(q) || s.customer_name.toLowerCase().includes(q));
    list.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
    return limit ? list.slice(0, limit) : list;
  }
  getSale(id) { const s = this.state.sales.find((x) => x.id === id); if (!s) return null; const c = s.customer_id ? this.state.customers.find((x) => x.id === s.customer_id) : null; return { ...s, customer_name: c ? c.name : "", customer_phone: c ? c.phone : "" }; }

  // ------------------------------------------------------------ expenses
  getExpenses({ start = null, end = null, category = "All", search = "" } = {}) {
    const q = search.trim().toLowerCase();
    return this.state.expenses.filter((e) => (!start || e.expense_date >= start) && (!end || e.expense_date <= end) && (category === "All" || e.category === category)
      && (!q || (e.description || "").toLowerCase().includes(q) || e.category.toLowerCase().includes(q))).sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.id - a.id);
  }
  addExpense(data) { if (!(Number(data.amount) > 0)) throw new Error("err.amount_positive"); const id = this.nextId("expense"); this.state.expenses.push({ id, category: data.category, amount: round2(data.amount), description: (data.description || "").trim(), payment_method: data.payment_method || "Cash", expense_date: data.expense_date || todayISO(), created_at: nowISO() }); this.commit(); return id; }
  updateExpense(id, data) { const e = this.state.expenses.find((x) => x.id === id); if (e) { Object.assign(e, { category: data.category, amount: round2(data.amount), description: (data.description || "").trim(), payment_method: data.payment_method, expense_date: data.expense_date }); this.commit(); } }
  deleteExpense(id) { this.state.expenses = this.state.expenses.filter((e) => e.id !== id); this.commit(); }
  expensesByCategory(start, end) {
    const m = new Map();
    for (const e of this.state.expenses) if (e.expense_date >= start && e.expense_date <= end) { const cur = m.get(e.category) || { category: e.category, amount: 0, entries: 0 }; cur.amount += e.amount; cur.entries++; m.set(e.category, cur); }
    return [...m.values()].sort((a, b) => b.amount - a.amount);
  }

  // ------------------------------------------------------------ reporting
  summary(start, end) {
    const sales = this.state.sales.filter((s) => inRange(s.created_at, start, end));
    const revenue = sales.reduce((n, s) => n + s.total, 0); const discount = sales.reduce((n, s) => n + s.discount, 0);
    const cogs = sales.reduce((n, s) => n + s.items.reduce((m, i) => m + i.qty * i.unit_cost, 0), 0);
    const items = sales.reduce((n, s) => n + s.items.reduce((m, i) => m + i.qty, 0), 0);
    const credit = sales.reduce((n, s) => n + s.credit_amount, 0);
    const expenses = this.state.expenses.filter((e) => e.expense_date >= start && e.expense_date <= end).reduce((n, e) => n + e.amount, 0);
    const gross = revenue - cogs;
    return { revenue: round2(revenue), orders: sales.length, discount: round2(discount), cogs: round2(cogs), gross_profit: round2(gross), expenses: round2(expenses), net_profit: round2(gross - expenses), credit_given: round2(credit), items_sold: items, avg_order: sales.length ? round2(revenue / sales.length) : 0 };
  }
  salesByDay(start, end) {
    const out = []; const sm = new Map(), em = new Map();
    for (const s of this.state.sales) { const d = s.created_at.slice(0, 10); if (d >= start && d <= end) { const c = sm.get(d) || { revenue: 0, orders: 0 }; c.revenue += s.total; c.orders++; sm.set(d, c); } }
    for (const e of this.state.expenses) if (e.expense_date >= start && e.expense_date <= end) em.set(e.expense_date, (em.get(e.expense_date) || 0) + e.amount);
    for (let d = start; d <= end; d = addDays(d, 1)) out.push({ day: d, revenue: round2((sm.get(d) || {}).revenue || 0), orders: (sm.get(d) || {}).orders || 0, expenses: round2(em.get(d) || 0) });
    return out;
  }
  salesByHour(start, end) {
    const h = Array.from({ length: 17 }, (_, i) => ({ hour: i + 7, revenue: 0, orders: 0 }));
    for (const s of this.state.sales) if (inRange(s.created_at, start, end)) { const hr = parseInt(s.created_at.slice(11, 13)); const slot = h.find((x) => x.hour === hr); if (slot) { slot.revenue += s.total; slot.orders++; } }
    return h;
  }
  topProducts(start, end, limit = 5) {
    const m = new Map();
    for (const s of this.state.sales) if (inRange(s.created_at, start, end)) for (const i of s.items) { const c = m.get(i.product_id) || { product_id: i.product_id, name: i.product_name, qty: 0, revenue: 0, profit: 0 }; c.qty += i.qty; c.revenue += i.line_total; c.profit += i.line_total - i.qty * i.unit_cost; m.set(i.product_id, c); }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  }
  salesByCategory(start, end) {
    const m = new Map();
    for (const s of this.state.sales) if (inRange(s.created_at, start, end)) for (const i of s.items) { const p = this.state.products.find((x) => x.id === i.product_id); const cat = p ? this.categoryName(p.category_id) || "Uncategorised" : "Uncategorised"; const c = m.get(cat) || { category: cat, revenue: 0, qty: 0 }; c.revenue += i.line_total; c.qty += i.qty; m.set(cat, c); }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue);
  }
  salesByMethod(start, end) {
    const m = new Map();
    for (const s of this.state.sales) if (inRange(s.created_at, start, end)) { const c = m.get(s.payment_method) || { method: s.payment_method, revenue: 0, orders: 0 }; c.revenue += s.total; c.orders++; m.set(s.payment_method, c); }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue);
  }
  globalSearch(q, limit = 5) {
    q = q.trim().toLowerCase(); if (!q) return { products: [], customers: [], sales: [] };
    return { products: this.getProducts({ search: q }).slice(0, limit), customers: this.getCustomers(q).slice(0, limit), sales: this.getSales({ search: q, limit }) };
  }
  notifications() {
    const notes = this.lowStock(5).map((p) => ({ kind: p.status, title: p.name, text: p.status === "out" ? "pos.out_of_stock" : `${p.quantity} ${p.unit}`, page: "inventory" }));
    for (const c of this.getCustomers().filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 3)) notes.push({ kind: "credit", title: c.name, amount: c.balance, page: "khata" });
    return notes;
  }

  // ------------------------------------------------------------ demo data
  seedDemo() {
    const rng = mulberry32(42);
    const cats = [["Grocery", "گروسری"], ["Beverages", "مشروبات"], ["Snacks", "اسنیکس"], ["Dairy", "ڈیری"], ["Household", "گھریلو"], ["Personal Care", "ذاتی نگہداشت"], ["Stationery", "اسٹیشنری"]];
    const catId = {}; for (const [n, u] of cats) catId[n] = this.addCategory(n, u);
    const P = [
      ["Sunridge Chakki Atta 10kg", "سن رج چکی آٹا 10 کلو", "Grocery", 1250, 1390, 24, 8, "bag"], ["Guard Basmati Rice 5kg", "گارڈ باسمتی چاول 5 کلو", "Grocery", 1650, 1850, 14, 6, "bag"],
      ["Refined Sugar 1kg", "چینی 1 کلو", "Grocery", 150, 165, 60, 20, "kg"], ["Dalda Cooking Oil 1L", "ڈالڈا کوکنگ آئل 1 لیٹر", "Grocery", 520, 575, 30, 10, "bottle"],
      ["Dalda Banaspati Ghee 1kg", "ڈالڈا بناسپتی گھی 1 کلو", "Grocery", 540, 595, 9, 10, "pack"], ["Masoor Daal 1kg", "مسور دال 1 کلو", "Grocery", 260, 295, 35, 10, "kg"],
      ["Shan Biryani Masala 50g", "شان بریانی مصالحہ", "Grocery", 85, 110, 48, 12, "pack"], ["National Chaat Masala 100g", "نیشنل چاٹ مصالحہ", "Grocery", 95, 120, 0, 10, "pack"],
      ["Tapal Danedar 190g", "ٹپال دانےدار 190 گرام", "Beverages", 310, 350, 26, 8, "pack"], ["Lipton Yellow Label 190g", "لپٹن ییلو لیبل 190 گرام", "Beverages", 330, 370, 5, 8, "pack"],
      ["Coca-Cola 1.5L", "کوکا کولا 1.5 لیٹر", "Beverages", 150, 180, 40, 12, "bottle"], ["Rooh Afza 800ml", "روح افزا 800 ملی", "Beverages", 380, 430, 12, 6, "bottle"],
      ["Nestle Pure Life 1.5L", "نیسلے پیور لائف 1.5 لیٹر", "Beverages", 60, 80, 72, 24, "bottle"], ["Lays Masala 40g", "لیز مصالحہ 40 گرام", "Snacks", 40, 50, 90, 30, "pack"],
      ["Peek Freans Sooper 6pk", "پیک فرینز سوپر", "Snacks", 110, 130, 7, 12, "pack"], ["Candi Biscuits Family", "کینڈی بسکٹ فیملی", "Snacks", 95, 120, 22, 10, "pack"],
      ["Olpers Milk 1L", "اولپرز دودھ 1 لیٹر", "Dairy", 270, 295, 28, 12, "pack"], ["Nestle Milkpak 1L", "نیسلے ملک پیک 1 لیٹر", "Dairy", 275, 300, 0, 12, "pack"],
      ["Nurpur Butter 200g", "نورپور مکھن 200 گرام", "Dairy", 420, 470, 11, 6, "pack"], ["Surf Excel 1kg", "سرف ایکسل 1 کلو", "Household", 560, 620, 18, 8, "pack"],
      ["Lemon Max Dishwash Bar", "لیمن میکس ڈش واش بار", "Household", 55, 70, 44, 15, "pcs"], ["Dettol Antiseptic 250ml", "ڈیٹول اینٹی سیپٹک 250 ملی", "Household", 290, 330, 16, 6, "bottle"],
      ["Candles Pack of 6", "موم بتیاں 6 عدد", "Household", 80, 110, 3, 10, "pack"], ["Lifebuoy Soap 145g", "لائف بوائے صابن 145 گرام", "Personal Care", 95, 115, 52, 15, "pcs"],
      ["Colgate Toothpaste 150g", "کولگیٹ ٹوتھ پیسٹ 150 گرام", "Personal Care", 220, 255, 21, 8, "pcs"], ["Head & Shoulders 185ml", "ہیڈ اینڈ شولڈرز 185 ملی", "Personal Care", 430, 490, 8, 8, "bottle"],
      ["Pampers Medium 44pk", "پیمپرز میڈیم 44 عدد", "Personal Care", 1950, 2150, 6, 4, "pack"], ["Dollar Ball Pen (Box 10)", "ڈالر بال پین باکس", "Stationery", 150, 200, 15, 5, "box"],
      ["Notebook 200pg", "نوٹ بک 200 صفحات", "Stationery", 120, 160, 33, 10, "pcs"], ["Duracell AA Battery 2pk", "ڈیورسیل بیٹری AA", "Stationery", 240, 290, 4, 6, "pack"],
    ];
    const finalQty = {};
    for (const [name, name_ur, cat, cost, price, qty, thr, unit] of P) {
      const id = this.addProduct({ name, name_ur, category_id: catId[cat], purchase_price: cost, selling_price: price, quantity: qty + 400, low_stock_threshold: thr, unit, barcode: `89${Math.floor(rng() * 9e9 + 1e9)}` });
      finalQty[id] = qty;
    }
    const C = [["Abdul Rehman", "0301-2345678", "Gulberg, Lahore"], ["Fatima Noor", "0321-9876543", "Model Town, Lahore"], ["Imran Siddiqui", "0333-4567891", "Johar Town, Lahore"], ["Ayesha Khan", "0345-1122334", "DHA Phase 5, Lahore"], ["Bilal Chaudhry", "0300-7788990", "Township, Lahore"], ["Sana Malik", "0312-5566778", "Garden Town, Lahore"], ["Usman Tariq", "0346-6677889", "Wapda Town, Lahore"], ["Hina Baig", "0302-3344556", "Iqbal Town, Lahore"], ["Kashif Mehmood", "0315-9988776", "Shadman, Lahore"], ["Zainab Ali", "0334-2211445", "Cantt, Lahore"]];
    for (const [name, phone, address] of C) this.addCustomer({ name, phone, address });
    const products = this.state.products; const customers = this.state.customers;
    const methods = [...this.settings.payment_methods.slice(0, 4), "Cash", "Cash", CREDIT_METHOD];
    const today = new Date();
    for (let off = 44; off >= 0; off--) {
      const day = new Date(today); day.setDate(today.getDate() - off);
      const n = 2 + Math.floor(rng() * (day.getDay() === 5 ? 8 : 6));
      for (let k = 0; k < n; k++) {
        const picks = shuffle(products, rng).slice(0, 1 + Math.floor(rng() * 5));
        const items = picks.map((p) => ({ product_id: p.id, qty: 1 + Math.floor(rng() * 4), unit_price: p.selling_price }));
        const total = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
        const method = methods[Math.floor(rng() * methods.length)];
        const cust = method === CREDIT_METHOD || rng() < 0.3 ? customers[Math.floor(rng() * customers.length)].id : null;
        const received = method === CREDIT_METHOD ? Math.round(total * [0, 0, 0.5][Math.floor(rng() * 3)]) : total;
        const hour = off === 0 ? 8 + Math.floor(rng() * Math.max(1, Math.min(13, today.getHours() - 8))) : 9 + Math.floor(rng() * 12);
        const ts = `${todayISO(day)} ${p2(hour)}:${p2(Math.floor(rng() * 60))}:${p2(Math.floor(rng() * 60))}`;
        try { this.createSale({ items, discount: [0, 0, 0, 20, 50][Math.floor(rng() * 5)], payment_method: method, amount_received: received, customer_id: cust, created_at: ts }); } catch { /* skip */ }
      }
      if (rng() < 0.55 || off === 0) {
        const cat = this.expenseCategories[Math.floor(rng() * this.expenseCategories.length)];
        const amt = { Rent: 1500, Utilities: 300 + Math.floor(rng() * 900), Salaries: 1200, Transport: 150 + Math.floor(rng() * 450), Purchases: 2000 + Math.floor(rng() * 7000), Maintenance: 200 + Math.floor(rng() * 1300), Marketing: 200 + Math.floor(rng() * 600), Other: 100 + Math.floor(rng() * 600) }[cat] || 500;
        this.state.expenses.push({ id: this.nextId("expense"), category: cat, amount: amt, description: `${cat} expense`, payment_method: "Cash", expense_date: todayISO(day), created_at: `${todayISO(day)} 18:00:00` });
      }
    }
    for (const c of this.getCustomers()) if (c.balance > 0 && rng() < 0.7) {
      const pay = Math.round(c.balance * [0.3, 0.5, 0.8][Math.floor(rng() * 3)] / 10) * 10;
      if (pay > 0) { const d = new Date(today); d.setDate(today.getDate() - Math.floor(rng() * 10)); this.state.khata.push({ id: this.nextId("khata"), customer_id: c.id, type: "payment", amount: pay, sale_id: null, payment_method: rng() < 0.5 ? "Cash" : "JazzCash", note: "Partial payment", created_at: `${todayISO(d)} 12:00:00` }); }
    }
    for (const p of this.state.products) if (finalQty[p.id] !== undefined) p.quantity = finalQty[p.id];
    this.commit();
  }
}

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export const store = new Store();
