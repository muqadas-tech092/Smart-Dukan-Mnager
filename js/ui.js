/* Shared UI helpers: formatting, building blocks, modals, toasts, tables, CSV, printing. */
import { icon } from "./icons.js";
import { t, isRTL } from "./i18n.js";
import { store, todayISO, addDays } from "./store.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const money = (v, decimals = 0) => { const n = Number(v) || 0; const sym = store.settings.currency_symbol || "Rs."; return `${n < 0 ? "-" : ""}${sym} ${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`; };
export const fmtNum = (v) => (Number(v) || 0).toLocaleString("en-US");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(ts, withTime = false) {
  if (!ts) return "-";
  const [d, tm] = String(ts).split(" "); const [y, m, day] = d.split("-").map(Number);
  let out = `${String(day).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
  if (withTime && tm) { const [hh, mm] = tm.split(":").map(Number); const ap = hh >= 12 ? "PM" : "AM"; out += `, ${String(hh % 12 || 12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${ap}`; }
  return out;
}
export const fmtDay = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]}`; };
export const initials = (name) => (String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "SD");
export const imgSrc = (p) => (p && p.image_data) || "assets/placeholder.png";
export const logoSrc = () => store.settings.logo_data || (window.SDM_CONFIG?.theme?.logo) || "assets/logo.png";

/** Replace the view container with a clean clone so listeners from the previous render are dropped.
    Every view calls this at the top of render() and draws into the element it returns. */
export function freshView() {
  const old = document.getElementById("view"); const next = old.cloneNode(false); old.replaceWith(next); return next;
}

// ------------------------------------------------------------------ blocks
export const pageHead = (title, subtitle = "", actions = "") => `<div class="page-head"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</div>`;
export const section = (title, ic = "", hint = "", right = "") => `<div class="section"><h3>${ic ? icon(ic, 17) : ""}${esc(title)}</h3>${right || (hint ? `<span class="hint">${esc(hint)}</span>` : "")}</div>`;
export function kpi({ label, value, ic = "banknote", tone = "emerald", delta = "", dir = "flat" }) {
  const arrow = dir === "up" ? icon("trending-up", 14) : dir === "down" ? icon("trending-down", 14) : "";
  return `<div class="kpi"><div class="row" style="border:none;padding:0"><span class="label">${esc(label)}</span><span class="ic-wrap tone-${tone}">${icon(ic, 18)}</span></div><div class="value num">${esc(value)}</div><div class="delta ${dir}">${arrow}<span>${esc(delta)}</span></div></div>`;
}
export const badge = (text, tone = "neutral", ic = "") => `<span class="badge ${tone}">${ic ? icon(ic, 12) : ""}${esc(text)}</span>`;
export const statusBadge = (s) => s === "ok" ? badge(t("inv.in_stock"), "ok", "circle-check") : s === "low" ? badge(t("inv.low_stock"), "low", "triangle-alert") : badge(t("inv.out_of_stock"), "out", "circle-alert");
export const emptyState = (title, hint = "", image = "empty_box.png") => `<div class="empty"><img src="assets/${image}" alt=""/><b>${esc(title)}</b><span>${esc(hint)}</span></div>`;
export function listRow({ title, sub = "", value = "", valueSub = "", ic = "", tone = "emerald", thumb = "", bar = null, avatar = "", valueClass = "" }) {
  const lead = thumb ? `<img class="thumb" src="${thumb}" alt=""/>` : avatar ? `<span class="avatar soft">${esc(avatar)}</span>` : ic ? `<span class="ic-wrap tone-${tone}">${icon(ic, 16)}</span>` : "";
  const barHtml = bar !== null ? `<div class="bar"><i style="width:${Math.max(2, Math.min(100, bar * 100)).toFixed(0)}%"></i></div>` : "";
  return `<div class="row">${lead}<div class="body"><div class="title">${esc(title)}</div><div class="sub">${sub}</div>${barHtml}</div><div class="end"><div class="v num ${valueClass}">${esc(value)}</div><div class="s">${valueSub}</div></div></div>`;
}
export const field = (label, inner, opts = {}) => `<div class="field ${opts.cls || ""}" ${opts.attrs || ""}><label>${esc(label)}${opts.optional ? ` <span class="faint">(${t("common.optional")})</span>` : ""}</label>${inner}${opts.help ? `<span class="help">${esc(opts.help)}</span>` : ""}<span class="err"></span></div>`;
export const input = (name, value = "", attrs = "") => `<input name="${name}" value="${esc(value)}" ${attrs}/>`;
export const select = (name, options, value, attrs = "") => `<select name="${name}" ${attrs}>${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select>`;
export const btn = (label, { ic = "", cls = "", attrs = "", type = "button" } = {}) => `<button type="${type}" class="btn ${cls}" ${attrs}>${ic ? icon(ic, 16) : ""}<span>${esc(label)}</span></button>`;
export const iconBtn = (ic, title, attrs = "", cls = "") => `<button type="button" class="btn-icon ${cls}" title="${esc(title)}" aria-label="${esc(title)}" ${attrs}>${icon(ic, 16)}</button>`;

// ------------------------------------------------------------------ modal / toast / confirm
const modalRoot = () => document.getElementById("modalRoot");
export function openModal({ title, ic = "", body, footer = "", size = "", onMount }) {
  closeModal();
  const wrap = document.createElement("div"); wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true"><div class="modal-head"><h3>${ic ? icon(ic, 18) : ""}${esc(title)}</h3><button type="button" class="btn-icon" data-close aria-label="${esc(t("common.close"))}">${icon("x", 16)}</button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ""}</div>`;
  wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("[data-close]")) closeModal(); });
  modalRoot().appendChild(wrap);
  document.body.style.overflow = "hidden";
  const first = wrap.querySelector("input:not([type=hidden]), select, textarea, button.primary"); if (first) setTimeout(() => first.focus(), 30);
  if (onMount) onMount(wrap.querySelector(".modal"));
  return wrap.querySelector(".modal");
}
export function closeModal() { const r = modalRoot(); if (r.firstChild) r.innerHTML = ""; document.body.style.overflow = ""; }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
export function confirmDialog({ title, body, danger = true, confirmText = "" }) {
  return new Promise((resolve) => {
    openModal({ title, ic: danger ? "triangle-alert" : "info", size: "sm", body: `<p class="muted" style="margin:0 0 6px">${esc(body)}</p><p class="faint" style="margin:0">${esc(t("common.confirm_delete"))}</p>`,
      footer: btn(t("common.cancel"), { attrs: 'data-close' }) + btn(confirmText || t("common.confirm"), { cls: danger ? "primary" : "primary", attrs: 'data-ok' }),
      onMount: (m) => { m.querySelector("[data-ok]").addEventListener("click", () => { closeModal(); resolve(true); }); m.querySelector(".modal-head [data-close]").addEventListener("click", () => resolve(false)); m.parentElement.addEventListener("click", (e) => { if (e.target === m.parentElement || e.target.closest(".modal-foot [data-close]")) resolve(false); }); } });
  });
}
export function toast(message, type = "ok") {
  const root = document.getElementById("toastRoot"); const el = document.createElement("div");
  el.className = `toast ${type === "error" ? "error" : ""}`; el.innerHTML = `${icon(type === "error" ? "circle-alert" : "circle-check", 16)}<span>${esc(message)}</span>`;
  root.appendChild(el); setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 300); }, 2600);
}
export function errorMessage(e) { const key = e && e.message; if (key && key.includes(".") && !key.includes(" ")) return t(key, e.vars || {}); return key || String(e); }

// ------------------------------------------------------------------ forms
export function formValues(form) { const o = {}; new FormData(form).forEach((v, k) => { o[k] = typeof v === "string" ? v.trim() : v; }); form.querySelectorAll("input[type=checkbox]").forEach((c) => { o[c.name] = c.checked; }); return o; }
export function setError(form, name, msg) { const f = form.querySelector(`[name="${name}"]`)?.closest(".field"); if (f) { f.classList.toggle("invalid", !!msg); f.querySelector(".err").textContent = msg || ""; } }
export function readImageFile(file, w = 640, h = 480) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d");
      const r = w / h; let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (img.width / img.height > r) { sw = img.height * r; sx = (img.width - sw) / 2; } else { sh = img.width / r; sy = (img.height - sh) / 2; }
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Invalid image")); };
    img.src = url;
  });
}

// ------------------------------------------------------------------ tables & pagination
export function table({ columns, rows, cls = "responsive" }) {
  const th = columns.map((c) => `<th class="${c.cls || ""}">${esc(c.label)}</th>`).join("");
  const body = rows.map((r) => `<tr ${r.attrs || ""}>${r.cells.map((cell, i) => { const c = columns[i]; return `<td class="${c.cls || ""}" data-label="${esc(c.label)}">${cell}</td>`; }).join("")}</tr>`).join("");
  return `<div class="table-wrap"><table class="tbl ${cls}"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}
export function paginate(items, key, size, state) {
  const total = items.length; const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, state[key] || 1), pages); state[key] = page;
  return { items: items.slice((page - 1) * size, page * size), page, pages, total };
}
export function pager({ page, pages, total }, key) {
  if (total <= 0 || pages <= 1) return "";
  return `<div class="pager"><button type="button" class="btn sm" data-pager="${key}" data-dir="-1" ${page <= 1 ? "disabled" : ""}>${icon("chevron-left", 14)}<span>${esc(t("common.previous"))}</span></button><span>${esc(t("common.page"))} ${page} ${esc(t("common.of"))} ${pages} <span class="faint">(${total} ${esc(t("common.rows"))})</span></span><button type="button" class="btn sm" data-pager="${key}" data-dir="1" ${page >= pages ? "disabled" : ""}><span>${esc(t("common.next"))}</span>${icon("chevron-right", 14)}</button></div>`;
}

// ------------------------------------------------------------------ date ranges
export function rangeFor(preset, custom = {}) {
  const today = todayISO();
  switch (preset) {
    case "today": return [today, today];
    case "7d": return [addDays(today, -6), today];
    case "month": return [today.slice(0, 8) + "01", today];
    case "custom": { let s = custom.from || addDays(today, -29), e = custom.to || today; if (s > e) [s, e] = [e, s]; return [s, e]; }
    default: return [addDays(today, -29), today];
  }
}
export function rangeControl(key, st) {
  const presets = [["today", t("common.today")], ["7d", t("common.7d")], ["30d", t("common.30d")], ["month", t("common.month")], ["custom", t("common.custom")]];
  const cur = st[key] || (st[key] = { preset: "30d" });
  const custom = cur.preset === "custom" ? `<div class="toolbar" style="margin-top:8px"><div class="field"><label>${esc(t("common.from"))}</label><input type="date" name="from" data-range="${key}" value="${cur.from || rangeFor("30d")[0]}" max="${todayISO()}"/></div><div class="field"><label>${esc(t("common.to"))}</label><input type="date" name="to" data-range="${key}" value="${cur.to || todayISO()}" max="${todayISO()}"/></div></div>` : "";
  return `<div class="pills" data-range-pills="${key}">${presets.map(([v, l]) => `<button type="button" class="pill ${cur.preset === v ? "active" : ""}" data-preset="${v}">${esc(l)}</button>`).join("")}</div>${custom}`;
}
export function bindRangeControl(root, st, onChange) {
  root.querySelectorAll("[data-range-pills]").forEach((el) => el.addEventListener("click", (e) => { const b = e.target.closest("[data-preset]"); if (!b) return; const key = el.dataset.rangePills; st[key].preset = b.dataset.preset; onChange(); }));
  root.querySelectorAll("input[data-range]").forEach((inp) => inp.addEventListener("change", () => { const key = inp.dataset.range; st[key][inp.name] = inp.value; onChange(); }));
}

// ------------------------------------------------------------------ CSV
export function toCSV(rows, columns) {
  const q = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "﻿" + [columns.join(","), ...rows.map((r) => columns.map((c) => q(r[c])).join(","))].join("\n");
}
export function parseCSV(text) {
  const rows = []; let row = [], cell = "", inQ = false; text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += ch; }
    else if (ch === '"') inQ = true; else if (ch === ",") { row.push(cell); cell = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}
export function downloadFile(name, content, mime = "text/plain") {
  const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ------------------------------------------------------------------ documents
export function invoiceHTML(sale) {
  const s = store.settings;
  const rows = sale.items.map((i) => `<tr><td>${esc(i.product_name)}</td><td class="r num">${i.qty}</td><td class="r num">${money(i.unit_price)}</td><td class="r num">${money(i.line_total)}</td></tr>`).join("");
  return `<div class="invoice"><div class="head"><div style="display:flex;gap:12px;align-items:center"><img class="logo" src="${logoSrc()}" alt=""/><div><h2>${esc(s.shop_name)}</h2><div class="meta">${esc(s.address || "")}<br/>${esc(s.phone || "")}</div></div></div>
  <div class="numbox"><b class="num">${esc(sale.invoice_no)}</b><div class="meta">${fmtDate(sale.created_at, true)}<br/>${esc(t("common.customer"))}: ${esc(sale.customer_name || t("common.walk_in"))}</div></div></div>
  <table><thead><tr><th>${esc(t("inv.product"))}</th><th class="r">${esc(t("common.qty"))}</th><th class="r">${esc(t("common.price"))}</th><th class="r">${esc(t("common.total"))}</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals-box kv"><span>${esc(t("pos.subtotal"))}</span><b class="num">${money(sale.subtotal)}</b><span>${esc(t("pos.discount"))}</span><b class="num">${money(sale.discount)}</b>
  <span class="strong">${esc(t("common.total"))}</span><b class="num" style="color:var(--primary);font-size:1.05rem">${money(sale.total)}</b><span>${esc(t("common.payment_method"))}</span><b>${esc(sale.payment_method)}</b>
  <span>${esc(t("sales.received"))}</span><b class="num">${money(sale.amount_received)}</b><span>${esc(t("pos.change"))}</span><b class="num">${money(sale.change_due)}</b>
  ${sale.credit_amount ? `<span>${esc(t("sales.credit"))}</span><b class="num">${money(sale.credit_amount)}</b>` : ""}</div>
  <div class="foot">${esc(s.receipt_footer || "")}</div></div>`;
}
export function statementHTML(customer, ledger) {
  const s = store.settings;
  const rows = ledger.map((r) => `<tr><td>${fmtDate(r.created_at)}</td><td>${esc(r.note || r.invoice_no || "")}</td><td class="r num">${r.type === "credit" ? money(r.amount) : ""}</td><td class="r num">${r.type === "payment" ? money(r.amount) : ""}</td><td class="r num">${money(r.running_balance)}</td></tr>`).join("");
  return `<div class="invoice"><div class="head"><div style="display:flex;gap:12px;align-items:center"><img class="logo" src="${logoSrc()}" alt=""/><div><h2>${esc(s.shop_name)}</h2><div class="meta">${esc(t("khata.statement"))} - ${esc(customer.name)}<br/>${esc(customer.phone || "")}</div></div></div>
  <div class="numbox"><b class="num">${money(customer.balance)}</b><div class="meta">${esc(t("cust.balance"))}<br/>${fmtDate(todayISO())}</div></div></div>
  <table><thead><tr><th>${esc(t("common.date"))}</th><th>${esc(t("common.description"))}</th><th class="r">${esc(t("khata.credit"))}</th><th class="r">${esc(t("khata.payment"))}</th><th class="r">${esc(t("khata.running"))}</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="foot">${esc(s.receipt_footer || "")}</div></div>`;
}
export function printHTML(html) {
  const root = document.getElementById("printRoot"); root.innerHTML = html; root.hidden = false;
  const done = () => { root.hidden = true; root.innerHTML = ""; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done); setTimeout(() => window.print(), 50);
}
const scriptCache = new Map();
/** Load a third-party script once (used for on-demand QR encode/decode libraries). */
export function loadScript(url) {
  if (!scriptCache.has(url)) scriptCache.set(url, new Promise((resolve, reject) => {
    const s = document.createElement("script"); s.src = url; s.async = true; s.onload = resolve; s.onerror = () => { scriptCache.delete(url); reject(new Error(`Failed to load ${url}`)); }; document.head.appendChild(s);
  }));
  return scriptCache.get(url);
}
export const isMobile = () => window.matchMedia("(max-width: 640px)").matches;
export function copyText(text) { if (navigator.clipboard) return navigator.clipboard.writeText(text).then(() => toast(t("common.copied"))); const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast(t("common.copied")); }
export { icon, t, isRTL };
