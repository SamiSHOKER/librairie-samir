// Live camera barcode scanner. Uses the phone's built-in detector when it has
// one (Android Chrome), otherwise the html5-qrcode library (iPhone, others).
import { t } from "./i18n.js";
import { ICON, loadScript, toast } from "./ui.js";

const LIB = new URL("./vendor/html5-qrcode.min.js", import.meta.url).href; // html5-qrcode 2.3.8
let active = null;

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 1400; g.gain.value = 0.08; o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.09); setTimeout(() => ctx.close(), 300);
  } catch (e) {}
  try { navigator.vibrate?.(60); } catch (e) {}
}

// onCode(code) is called for each new barcode. Set continuous=false to close after the first.
export async function openScanner(onCode, { continuous = true } = {}) {
  closeScanner();
  const host = document.createElement("div");
  host.className = "scanner";
  host.innerHTML = `<div class="scanner-top"><span id="scanLast">${t("scanSearch")}</span><button class="iconbtn" id="scanClose" aria-label="${t("close")}">${ICON.x}</button></div>
    <div class="scanner-view" id="scanView"><video id="scanVideo" playsinline muted></video><div class="scanner-frame"></div></div>`;
  document.body.appendChild(host);
  const state = { host, stream: null, lib: null, timer: null, last: "", lastAt: 0 };
  active = state;
  host.querySelector("#scanClose").onclick = closeScanner;

  const hit = (code) => {
    code = String(code || "").trim();
    if (!code) return;
    const now = Date.now();
    if (code === state.last && now - state.lastAt < 2000) return;
    state.last = code; state.lastAt = now;
    beep();
    host.querySelector("#scanLast").textContent = code;
    onCode(code);
    if (!continuous) closeScanner();
  };

  try {
    if ("BarcodeDetector" in window) {
      const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"] });
      state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
      const v = host.querySelector("#scanVideo");
      v.srcObject = state.stream; await v.play();
      const loop = async () => {
        if (active !== state) return;
        try { const r = await det.detect(v); if (r && r[0]) hit(r[0].rawValue); } catch (e) {}
        state.timer = setTimeout(loop, 180);
      };
      loop();
    } else {
      await loadScript(LIB);
      host.querySelector("#scanVideo").remove();
      const F = window.Html5QrcodeSupportedFormats;
      state.lib = new window.Html5Qrcode("scanView", { formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE], verbose: false });
      await state.lib.start({ facingMode: "environment" }, { fps: 12, qrbox: (w, h) => ({ width: Math.min(w * 0.85, 340), height: Math.min(h * 0.45, 170) }) }, hit, () => {});
    }
  } catch (e) {
    console.error(e);
    toast(t("errLoad") + " (camera)");
    closeScanner();
  }
}

export function closeScanner() {
  const s = active; active = null;
  if (!s) return;
  clearTimeout(s.timer);
  try { s.stream?.getTracks().forEach((tr) => tr.stop()); } catch (e) {}
  try { s.lib?.stop().catch(() => {}).finally(() => s.lib.clear?.()); } catch (e) {}
  s.host.remove();
}
