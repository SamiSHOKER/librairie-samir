// Minimal UI kit: routing, rendering, events, modal sheet, toast, script loader.
import { t, getLang, setLang, applyDir } from "./i18n.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/></svg>',
  sell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 5v14M7 5v14M10.5 5v14M14 5v14M16.5 5v14M20 5v14"/></svg>',
  stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg>',
  repairs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5.5" cy="16" r="3.5"/><circle cx="18.5" cy="16" r="3.5"/><path d="M5.5 16 9 9h6l3.5 7M9 9 12 16h-6.5M15 9l-1.5-3H11" stroke-linejoin="round"/></svg>',
  customers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.7 3.2-6 6.5-6s5.9 2.3 6.5 6"/><path d="M16 4.5a3.3 3.3 0 0 1 0 6.5M18.5 14.5c1.7.8 2.7 2.8 3 5.5"/></svg>',
  receipts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 3h14v18l-2.3-1.5L14.3 21 12 19.5 9.7 21l-2.4-1.5L5 21z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M2 6h11v10H2zM13 9h4.5L21 12.5V16h-8z"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
  suppliers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 21V9l6-4v4l6-4v4l6-4v16z"/><path d="M8 17h2M14 17h2"/></svg>',
  schools: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 4.5h6.5A2.5 2.5 0 0 1 13 7v13a2 2 0 0 0-2-2H4zM20 4.5h-4.5A2.5 2.5 0 0 0 13 7"/><path d="M20 4.5V18h-7"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3"/><path d="M7 8v8M10 8v8M13 8v8M16 8v8"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
};

/* ---------------- events ---------------- */
const actions = {}, inputs = {};
export const on = (name, fn) => { actions[name] = fn; };
export const onInput = (name, fn) => { inputs[name] = fn; };

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-a]");
  if (!el || el.disabled) return;
  if (el.dataset.a === "overlay") { if (e.target === el) closeModal(); return; }
  const fn = actions[el.dataset.a];
  if (!fn) return;
  if (el.tagName === "A" && !el.getAttribute("href")) e.preventDefault();
  try { await fn(el, e); } catch (err) { console.error(err); toast(errText(err)); }
});
document.addEventListener("input", (e) => {
  const el = e.target.closest("[data-in]");
  if (el && inputs[el.dataset.in]) inputs[el.dataset.in](el, e);
});
document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-ch]");
  if (el && inputs[el.dataset.ch]) inputs[el.dataset.ch](el, e);
});
document.addEventListener("keydown", async (e) => {
  if (e.key === "Escape" && M.current) { closeModal(); return; }
  if (e.key !== "Enter") return;
  const el = e.target.closest("[data-enter]");
  if (!el) return;
  e.preventDefault();
  try { await actions[el.dataset.enter]?.(el, e); } catch (err) { console.error(err); toast(errText(err)); }
});

export function errText(err) {
  const m = String(err?.message || err || "");
  if (/only owners can change prices/.test(m)) return t("priceLocked");
  if (/products_barcode_uq|duplicate key/.test(m)) return t("duplicateBarcode");
  if (/Invalid login/i.test(m)) return t("wrongLogin");
  if (!navigator.onLine || /Failed to fetch|NetworkError/i.test(m)) return t("offline");
  return t("errSave") + (m ? " (" + m.slice(0, 120) + ")" : "");
}

/* ---------------- router & render ---------------- */
const views = {};
export const R = { route: null, nav: [], loaded: {}, errors: {}, shell: null };
export const view = (name, def) => { views[name] = def; };
export const go = (name) => { if (location.hash !== "#" + name) location.hash = "#" + name; else showRoute(); };

let pending = false;
export function rerender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; paint(); });
}
function keepFocus(fn) {
  const ae = document.activeElement, id = ae && ae.id;
  const sel = ae && "selectionStart" in ae ? [ae.selectionStart, ae.selectionEnd] : null;
  fn();
  if (id) { const n = document.getElementById(id); if (n && n !== document.activeElement) { n.focus(); if (sel && n.setSelectionRange) try { n.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
}
function paint() {
  const v = views[R.route];
  const main = document.getElementById("view");
  if (!v || !main) return;
  paintChrome();
  if (M.current && document.activeElement && document.activeElement.closest("#modal")) {
    main.innerHTML = body(v); v.after?.(); return;
  }
  keepFocus(() => { main.innerHTML = body(v); v.after?.(); });
}
function body(v) {
  if (R.errors[R.route]) return `<div class="empty"><p>${t("errLoad")}</p><button class="btn" data-a="reload">${t("retry")}</button></div>`;
  if (v.load && !R.loaded[R.route]) return `<div class="empty"><p>${t("loading")}</p></div>`;
  return v.render();
}
export async function showRoute(force) {
  const h = (location.hash || "").slice(1);
  const name = views[h] ? h : R.nav[0];
  R.route = name;
  const v = views[name];
  window.scrollTo(0, 0);
  if (v.load) {
    if (force) R.loaded[name] = false;
    R.errors[name] = false;
    paint();
    try { await v.load(); R.loaded[name] = true; } catch (e) { console.error(e); R.errors[name] = true; }
  }
  paint();
}
on("reload", () => showRoute(true));
window.addEventListener("hashchange", () => showRoute());

/* ---------------- chrome ---------------- */
export function paintChrome() {
  const sh = R.shell; if (!sh) return;
  document.getElementById("shopName").textContent = sh.title();
  document.getElementById("subTitle").textContent = sh.subtitle();
  for (const l of ["ar", "fr", "en"]) document.getElementById("l-" + l)?.setAttribute("aria-pressed", String(l === getLang()));
  const tabs = document.getElementById("tabs");
  const active = R.nav.includes(R.route) ? R.route : (sh.moreRoutes || []).includes(R.route) ? "more" : R.route;
  tabs.innerHTML = R.nav.map((k) => {
    const badge = sh.badge?.(k);
    return `<a href="#${k}" ${active === k ? 'aria-current="page"' : ""}>${ICON[k] || ""}<span>${t(k)}</span>${badge ? `<span class="badge">${badge}</span>` : ""}</a>`;
  }).join("");
  document.getElementById("netBar").hidden = navigator.onLine;
  document.getElementById("netBar").textContent = t("offline");
}
on("lang", (el) => {
  setLang(el.dataset.v);
  for (const l of ["ar", "fr", "en"]) document.getElementById("l-" + l)?.setAttribute("aria-pressed", String(l === el.dataset.v));
  paint(); if (M.current) renderModal(); R.onLang?.();
});
window.addEventListener("online", () => paintChrome());
window.addEventListener("offline", () => paintChrome());

/* ---------------- modal sheet ---------------- */
export const M = { current: null };
export function openModal(state) {
  M.current = state;
  renderModal();
  const f = document.querySelector("#modal [autofocus]");
  if (f && !(document.activeElement && document.activeElement.closest("#modal"))) f.focus();
}
export function closeModal() { const c = M.current; M.current = null; document.getElementById("modal").innerHTML = ""; c?.onClose?.(); }
export function renderModal() {
  const m = M.current, host = document.getElementById("modal");
  if (!m) { host.innerHTML = ""; return; }
  keepFocus(() => {
    host.innerHTML = `<div class="overlay" data-a="overlay"><div class="sheet ${m.wide ? "wide" : ""}" role="dialog" aria-modal="true">${m.render(m)}</div></div>`;
    m.after?.(m);
  });
}
export const sheetHead = (title) => `<div class="sheet-h"><h2>${title}</h2><button class="iconbtn" data-a="closeModal" aria-label="${t("close")}">${ICON.x}</button></div>`;
on("closeModal", () => closeModal());

/* ---------------- toast ---------------- */
let toastTimer;
export function toast(msg) {
  const el = document.getElementById("toast");
  el.firstElementChild.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 3200);
}

/* ---------------- misc ---------------- */
const scripts = {};
export function loadScript(src) {
  if (!scripts[src]) scripts[src] = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.onload = res;
    s.onerror = () => { delete scripts[src]; rej(new Error("script")); };
    document.head.appendChild(s);
  });
  return scripts[src];
}
export const fmtDate = (ts, withTime = true) => {
  const d = new Date(ts);
  const loc = getLang() === "ar" ? "ar-LB-u-nu-latn" : getLang() === "fr" ? "fr-FR" : "en-GB";
  return d.toLocaleString(loc, withTime ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" });
};
export function confirmTwice(m, key) { if (m[key]) return true; m[key] = true; renderModal(); return false; }
export { applyDir };
