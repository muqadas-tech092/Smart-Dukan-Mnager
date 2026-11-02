import { freshView } from "../ui.js";
import { t, getLang, setLang } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, field, input, select, btn, formValues, setError, logoSrc } from "../ui.js";
import { store } from "../store.js";

const CFG = window.SDM_CONFIG || {};
let step = 0;

export function render(_root, app) {
  const root = freshView();
  const s = store.settings; const demoAllowed = (CFG.features || {}).demoData !== false;
  document.getElementById("app").classList.add("menu-open"); document.getElementById("app").classList.remove("menu-open");
  root.innerHTML = `<div class="card" style="max-width:640px;margin:24px auto">
    <div class="onb-logo"><img src="${logoSrc()}" alt=""/><div><h2>${esc(t("onb.welcome"))}</h2><p>${esc(t("onb.intro"))}</p></div></div>
    <div class="onb-steps"><span class="${step >= 0 ? "done" : ""}"></span><span class="${step >= 1 ? "done" : ""}"></span></div>
    <form id="onbForm" novalidate>
      <div data-step="0" ${step !== 0 ? "hidden" : ""}>
        <h3 style="font-size:1rem;margin-bottom:10px">${esc(t("onb.step_shop"))}</h3>
        <div class="form-grid">
          ${field(t("set.shop_name"), input("shop_name", s.shop_name, 'required autofocus'), { cls: "span-2" })}
          ${field(t("set.owner"), input("owner_name", s.owner_name))}
          ${field(t("common.phone"), input("phone", s.phone, 'placeholder="03xx-xxxxxxx"'))}
          ${field(t("common.address"), input("address", s.address), { cls: "span-2" })}
        </div>
      </div>
      <div data-step="1" ${step !== 1 ? "hidden" : ""}>
        <h3 style="font-size:1rem;margin-bottom:10px">${esc(t("onb.step_prefs"))}</h3>
        <div class="form-grid">
          ${field(t("set.language"), select("language", [["en", "English"], ["ur", "اردو (Urdu)"]], getLang()))}
          ${field(t("set.currency"), input("currency_symbol", s.currency_symbol))}
          ${field(t("set.invoice_prefix"), input("invoice_prefix", s.invoice_prefix))}
          ${field(t("set.low_stock_default"), input("low_stock_default", s.low_stock_default, 'type="number" min="0"'))}
          ${demoAllowed ? `<label class="check span-2"><input type="checkbox" name="demo" checked/> <span>${esc(t("onb.demo"))}</span></label>` : ""}
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        ${step > 0 ? btn(t("common.back"), { ic: "arrow-left", attrs: 'data-back' }) : ""}
        ${btn(step === 0 ? t("common.continue") : t("onb.start"), { cls: "primary", ic: step === 0 ? "arrow-right" : "check", type: "submit" })}
      </div>
    </form></div>`;
  document.getElementById("sidebar").style.display = "none"; document.querySelector(".topbar").style.display = "none"; document.getElementById("bottomNav").style.display = "none";
  const form = root.querySelector("#onbForm");
  form.querySelector("[data-back]")?.addEventListener("click", () => { step = 0; render(root, app); });
  form.querySelector('select[name="language"]')?.addEventListener("change", (e) => { setLang(e.target.value); const v = formValues(form); Object.assign(store.state.settings, pick(v)); render(root, app); });
  form.addEventListener("submit", (e) => {
    e.preventDefault(); const v = formValues(form);
    if (step === 0) { if (!v.shop_name) { setError(form, "shop_name", t("common.required")); return; } Object.assign(store.state.settings, pick(v)); step = 1; render(root, app); return; }
    Object.assign(store.state.settings, pick(v)); setLang(v.language);
    store.state.setupDone = true;
    if (v.demo && demoAllowed) store.seedDemo(); else store.commit();
    document.getElementById("sidebar").style.display = ""; document.querySelector(".topbar").style.display = ""; document.getElementById("bottomNav").style.display = "";
    app.applyTheme(); app.finishSetup();
  });
}
function pick(v) {
  const out = {}; for (const k of ["shop_name", "owner_name", "phone", "address", "currency_symbol", "invoice_prefix", "language"]) if (v[k] !== undefined) out[k] = v[k];
  if (v.low_stock_default !== undefined) out.low_stock_default = parseInt(v.low_stock_default) || 10; return out;
}
