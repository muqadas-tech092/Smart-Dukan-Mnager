/* Barcode / QR scanning.
   - Camera: uses the browser's BarcodeDetector (Chrome, Edge, Android) for QR, EAN, UPC and Code 128/39.
     Where it is missing (Safari, Firefox) a small QR decoder (jsQR, MIT) is loaded on demand so QR labels
     printed from this app still scan.
   - Keyboard-wedge scanners (USB / Bluetooth) simply type the code and press Enter into the scan field,
     which the POS handles without this module.
   - QR label generation uses qrcode-generator (MIT), also loaded on demand. */
import { t } from "./i18n.js";
import { icon } from "./icons.js";
import { esc, openModal, closeModal, toast, loadScript } from "./ui.js";

const JSQR_URL = "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js";
const QRGEN_URL = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
const FORMATS = ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar"];

let audioCtx = null;
export function beep(ok = true) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = ok ? 1400 : 300; g.gain.value = 0.08;
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + (ok ? 0.09 : 0.22));
  } catch { /* audio not available */ }
  if (navigator.vibrate) navigator.vibrate(ok ? 40 : [60, 40, 60]);
}

export function cameraSupported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && (window.isSecureContext || location.hostname === "localhost"); }

/** Open the camera scanner. onCode(code) is called for every new code; return false from it to keep the
    modal open (continuous mode) or true to close. */
export function openScanner({ title, hint = "", onCode, continuous = true }) {
  if (!cameraSupported()) { toast(t("scan.no_camera"), "error"); return; }
  let stream = null, raf = 0, running = true, lastCode = "", lastAt = 0, detector = null, jsqr = null;
  const body = `<div class="scanner"><video id="scanVideo" playsinline muted autoplay></video><div class="scan-frame"></div><canvas id="scanCanvas" hidden></canvas></div>
    <div class="scan-status" id="scanStatus">${esc(hint || t("scan.point"))}</div><div class="scan-last" id="scanLast"></div>`;
  const modal = openModal({ title: title || t("scan.title"), ic: "scan-barcode", body, size: "sm",
    footer: `<button type="button" class="btn" data-close>${icon("x", 16)}<span>${esc(t("common.close"))}</span></button>`,
    onMount: (m) => { m.parentElement.addEventListener("click", (e) => { if (e.target === m.parentElement || e.target.closest("[data-close]")) stop(); }); } });
  const video = modal.querySelector("#scanVideo"); const canvas = modal.querySelector("#scanCanvas"); const status = modal.querySelector("#scanStatus"); const last = modal.querySelector("#scanLast");
  const stop = () => { running = false; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((tr) => tr.stop()); stream = null; };
  const handle = (code) => {
    code = String(code || "").trim(); const now = Date.now();
    if (!code || (code === lastCode && now - lastAt < 1800)) return;
    lastCode = code; lastAt = now;
    const close = onCode(code);
    last.textContent = code;
    if (close || !continuous) { stop(); closeModal(); }
  };
  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      video.srcObject = stream; await video.play();
    } catch (e) { status.textContent = t("scan.denied"); return; }
    if ("BarcodeDetector" in window) {
      try { const supported = await window.BarcodeDetector.getSupportedFormats(); detector = new window.BarcodeDetector({ formats: FORMATS.filter((f) => supported.includes(f)) }); } catch { detector = null; }
    }
    if (!detector) {
      status.textContent = t("scan.loading");
      try { await loadScript(JSQR_URL); jsqr = window.jsQR; status.textContent = t("scan.point_qr"); } catch { status.textContent = t("scan.unsupported"); return; }
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let busy = false;
    const tick = async () => {
      if (!running) return;
      if (!busy && video.readyState >= 2) {
        busy = true;
        try {
          if (detector) { const codes = await detector.detect(video); if (codes.length) handle(codes[0].rawValue); }
          else if (jsqr) {
            const w = 480, h = Math.round(480 * video.videoHeight / (video.videoWidth || 1)) || 360; canvas.width = w; canvas.height = h;
            ctx.drawImage(video, 0, 0, w, h); const img = ctx.getImageData(0, 0, w, h);
            const res = jsqr(img.data, w, h, { inversionAttempts: "dontInvert" }); if (res && res.data) handle(res.data);
          }
        } catch { /* frame skipped */ }
        busy = false;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  })();
  return stop;
}

/** Return a data URL (GIF) for a QR code image of `text`. Loads the generator on first use. */
let qrReady = null;
export async function qrDataURL(text, cellSize = 4) {
  qrReady = qrReady || loadScript(QRGEN_URL);
  await qrReady;
  const qr = window.qrcode(0, "M"); qr.addData(String(text)); qr.make();
  return qr.createDataURL(cellSize, 0);
}
