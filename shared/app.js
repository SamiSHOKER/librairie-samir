// Starts either app. mode = "staff" (Shop app) or "owner" (Owner app).
import { t, applyDir } from "./i18n.js";
import * as core from "./core.js";
import { S, isOwner, isLow } from "./core.js";
import { R, on, showRoute, paintChrome, esc, toast, errText } from "./ui.js";
import "./views-common.js";

const STAFF_NAV = ["sell", "stock", "repairs", "customers", "receipts"];
const OWNER_NAV = ["home", "sell", "stock", "repairs", "more"];
const LOGIN = { mode: "login", busy: false, msg: "" };

export async function boot(mode) {
  S.mode = mode;
  applyDir();
  document.documentElement.dataset.app = mode;
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  core.sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") location.reload(); });
  let prof = null;
  try { prof = await core.loadSession(); } catch (e) { console.error(e); }
  if (!prof) return showLogin();
  return enter();
}

async function enter() {
  const p = S.profile;
  if (!p || !p.active || p.role === "pending") return showBlocked(t("noAccess"));
  if (S.mode === "owner" && !isOwner()) return showBlocked(t("ownerOnly"));
  try { await Promise.all([core.loadSettings(), core.loadTeam()]); } catch (e) { console.error(e); }
  let more = [];
  if (S.mode === "owner") { const mod = await import("./views-owner.js"); more = mod.MORE; }
  R.nav = S.mode === "owner" ? OWNER_NAV : STAFF_NAV;
  R.shell = {
    title: () => S.settings.shop.name || "Librairie Samir Shoker",
    subtitle: () => `${t(S.mode === "owner" ? "ownerApp" : "staffApp")} · ${S.profile.full_name || S.profile.username || ""} · $1 = ${Math.round(S.settings.rate).toLocaleString("en-US")} ${t("ll")}`,
    badge: (k) => { if (k !== "stock") return null; const n = S.products.filter(isLow).length; return n || null; },
    moreRoutes: more,
  };
  document.body.classList.remove("auth");
  showRoute();
}

function shellTitle(sub) {
  document.getElementById("shopName").textContent = "Librairie Samir Shoker";
  document.getElementById("subTitle").textContent = sub;
  document.getElementById("tabs").innerHTML = "";
}

function showBlocked(msg) {
  document.body.classList.add("auth");
  shellTitle(t(S.mode === "owner" ? "ownerApp" : "staffApp"));
  document.getElementById("view").innerHTML = `<section class="card auth-card"><h2>${esc(S.profile?.full_name || "")}</h2><p>${msg}</p><button class="btn" data-a="logout">${t("logout")}</button></section>`;
}

function showLogin() {
  document.body.classList.add("auth");
  shellTitle(t(S.mode === "owner" ? "ownerApp" : "staffApp"));
  const sign = LOGIN.mode === "signup";
  document.getElementById("view").innerHTML = `<form class="card auth-card" id="loginForm" novalidate>
    <h2>${sign ? t("createOwner") : t("login")}</h2>
    ${sign ? `<div class="field"><label for="lgName">${t("fullName")}</label><input class="input" id="lgName" autocomplete="name" required></div>` : ""}
    <div class="field"><label for="lgUser">${sign ? t("email") : t("username")}</label><input class="input" id="lgUser" autocapitalize="none" autocomplete="username" required ${sign ? 'type="email"' : ""}></div>
    <div class="field"><label for="lgPass">${t("password")}</label><input class="input" id="lgPass" type="password" autocomplete="${sign ? "new-password" : "current-password"}" required minlength="8"></div>
    ${LOGIN.msg ? `<p class="err">${esc(LOGIN.msg)}</p>` : ""}
    <button class="btn primary big" type="submit" ${LOGIN.busy ? "disabled" : ""}>${sign ? t("createAccount") : t("login")}</button>
    ${S.mode === "owner" ? `<button class="btn ghost" type="button" data-a="loginToggle">${sign ? t("haveAccount") : t("createOwner")}</button>` : ""}
  </form>`;
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = document.getElementById("lgUser").value.trim(), pass = document.getElementById("lgPass").value;
    if (!user || !pass) return;
    LOGIN.busy = true; LOGIN.msg = "";
    try {
      if (sign) { if (pass.length < 8) throw new Error(t("pwdShort")); await core.signUpOwner(user, pass, document.getElementById("lgName").value.trim()); toast(t("ownerCreated")); }
      else await core.signIn(user, pass);
      LOGIN.busy = false;
      return enter();
    } catch (err) {
      LOGIN.busy = false; LOGIN.msg = /Invalid login/i.test(err.message) ? t("wrongLogin") : err.message === t("pwdShort") ? err.message : errText(err);
      showLogin();
    }
  });
  setTimeout(() => document.getElementById(sign ? "lgName" : "lgUser")?.focus(), 50);
}
on("loginToggle", () => { LOGIN.mode = LOGIN.mode === "signup" ? "login" : "signup"; LOGIN.msg = ""; showLogin(); });
on("logout", async () => { await core.signOut(); location.hash = ""; location.reload(); });
R.onLang = () => {
  if (!document.body.classList.contains("auth")) return;
  if (S.profile) showBlocked(S.mode === "owner" && S.profile.role === "staff" ? t("ownerOnly") : t("noAccess"));
  else showLogin();
};
