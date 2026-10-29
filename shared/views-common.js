// Screens used by both apps: Sell, Stock, Customers, Repairs, Receipts.
// Owner-only parts (costs, suppliers, price overrides, cancelling sales) appear
// only in the Owner app, and the database refuses them to staff anyway.
import { t, catName, CATS } from "./i18n.js";
import * as core from "./core.js";
import { S, num, usd, toLL, fmtLL, isOwner, isLow, round2 } from "./core.js";
import { esc, ICON, on, onInput, view, rerender, go, openModal, closeModal, renderModal, sheetHead, toast, M, fmtDate, confirmTwice } from "./ui.js";
import { openScanner } from "./scanner.js";
import { receiptHTML, ticketHTML, exportPdf } from "./receipt.js";

const ownerApp = () => S.mode === "owner" && isOwner();
const LL = () => t("ll");
const qtyCls = (p) => (p.kind !== "item" ? "svc" : num(p.qty) <= 0 ? "out" : isLow(p) ? "low" : "");
const qtyPill = (p) => `<span class="qty ${qtyCls(p)}">${p.kind === "item" ? num(p.qty) : "—"}</span>`;

/* =====================================================================
   SELL
   ===================================================================== */
export const CART = { lines: [], q: "", discount: "", payU: "", payL: "", customer: null, onAccount: false, repairId: null, repairNo: null };
function resetCart() { Object.assign(CART, { lines: [], q: "", discount: "", payU: "", payL: "", customer: null, onAccount: false, repairId: null, repairNo: null }); }
function cartTotals() {
  const sub = CART.lines.reduce((a, l) => a + num(l.qty) * num(l.unit_price), 0);
  const total = Math.max(sub - num(CART.discount), 0);
  const paid = num(CART.payU) + num(CART.payL) / S.settings.rate;
  return { sub, total, paid, diff: paid - total };
}
export function addToCart(p, qty = 1) {
  const ex = CART.lines.find((l) => l.product_id === p.id);
  if (ex) ex.qty = num(ex.qty) + qty;
  else CART.lines.push({ product_id: p.id, name: p.name, qty, unit_price: num(p.price_usd), kind: p.kind });
  if (p.kind === "item" && num(p.qty) - qty < 0) toast(t("outOfStockWarn") + " " + p.name);
  CART.q = "";
  rerender();
}
function onCode(code, ctx) {
  const p = core.findBarcode(code);
  if (ctx === "product" && M.current) { M.current.d.barcode = code; renderModal(); return; }
  if (ctx === "part" && M.current) { if (p) addPart(M.current, p); return; }
  if (p) { if (ctx === "sell") addToCart(p); else openProduct(p.id); return; }
  toast(t("notFoundCreate"));
  openProduct(null, { barcode: code, addToCart: ctx === "sell" });
}

view("sell", {
  load: () => core.loadProducts(),
  render() {
    const res = core.searchProducts(CART.q, 8);
    const { sub, total, diff } = cartTotals();
    const hasPay = num(CART.payU) || num(CART.payL);
    const owner = ownerApp();
    const bal = CART.customer ? S.balances.get(CART.customer.id) || 0 : 0;
    return `<div class="sellgrid">
    <section class="card">
      <div class="scanbar"><input class="input" id="sellQ" type="search" inputmode="search" autocomplete="off" placeholder="${t("scanSearch")}" value="${esc(CART.q)}" data-in="sellQ" data-enter="sellEnter">
        <button class="btn primary" data-a="scan" data-ctx="sell">${ICON.cam}<span>${t("scan")}</span></button></div>
      ${res.length ? `<div class="results">${res.map((p) => `<button data-a="cartAdd" data-id="${p.id}">${qtyPill(p)}<span class="grow"><b>${esc(p.name)}</b> <small class="mono muted">${esc(p.barcode || "")}</small></span><span class="num">${usd(p.price_usd)}</span></button>`).join("")}</div>` : ""}
      <div class="row">
        ${CART.customer ? `<span class="pill strong">${esc(CART.customer.name)}${bal > 0 ? ` · ${t("owes")} ${usd(bal)}` : ""} <button class="pill-x" data-a="custClear" aria-label="${t("delete")}">×</button></span>`
          : `<button class="btn sm" data-a="custPick">${ICON.plus}${t("chooseCustomer")}</button>`}
        <button class="btn sm" data-a="customItem">${ICON.plus}${t("customItem")}</button>
        ${CART.repairId ? `<span class="pill">${t("fromRepair")} #${CART.repairNo}</span>` : ""}
      </div>
      <div class="cart">${CART.lines.length ? CART.lines.map((l, i) => `<div class="cartline">
          <div class="nm"><b>${esc(l.name)}</b>${owner && l.product_id
            ? `<input class="input sm num" id="lp${i}" data-in="linePrice" data-i="${i}" inputmode="decimal" value="${esc(l.unit_price)}" aria-label="${t("price")}">`
            : `<small class="muted num">${usd(l.unit_price)} · ${fmtLL(toLL(l.unit_price), LL())}</small>`}</div>
          <div class="stepper"><button data-a="qtyDec" data-i="${i}" aria-label="−">−</button><input id="lq${i}" data-ch="lineQty" data-i="${i}" inputmode="decimal" value="${esc(l.qty)}" aria-label="${t("qty")}"><button data-a="qtyInc" data-i="${i}" aria-label="+">+</button></div>
          <b class="num lt">${usd(num(l.qty) * num(l.unit_price))}</b></div>`).join("")
        : `<p class="muted">${t("cartEmpty")}</p>`}</div>
    </section>
    <section class="card pay">
      <div class="tr muted"><span>${t("subtotal")}</span><span class="num">${usd(sub)}</span></div>
      <div class="field"><label for="disc">${t("discount")}</label><input class="input" id="disc" inputmode="decimal" placeholder="0" value="${esc(CART.discount)}" data-in="cartField" data-k="discount"></div>
      <div class="tr total"><span>${t("total")}</span><span class="grand num">${usd(total)}</span></div>
      <div class="tr"><span class="muted">$1 = ${fmtLL(S.settings.rate, LL())}</span><span class="grand-ll num">${fmtLL(toLL(total), LL())}</span></div>
      <div class="fgrid">
        <div class="field"><label for="payU">${t("paidUsd")}</label><input class="input" id="payU" inputmode="decimal" placeholder="0" value="${esc(CART.payU)}" data-in="cartField" data-k="payU"></div>
        <div class="field"><label for="payL">${t("paidLbp")}</label><input class="input" id="payL" inputmode="numeric" placeholder="0" value="${esc(CART.payL)}" data-in="cartField" data-k="payL"></div>
      </div>
      ${CART.lines.length && hasPay ? (diff >= -0.004
        ? `<div class="changebox ok"><span>${t("change")}</span><b class="num">${fmtLL(toLL(diff), LL())} · ${usd(diff)}</b></div>`
        : `<div class="changebox due"><span>${t("due")}</span><b class="num">${usd(-diff)} · ${fmtLL(toLL(-diff), LL())}</b></div>`) : ""}
      ${CART.customer && CART.lines.length && diff < -0.004 ? `<label class="check"><input type="checkbox" id="onAcc" data-ch="onAcc" ${CART.onAccount ? "checked" : ""}> ${t("onAccount")}</label>` : ""}
      <button class="btn pencil big" data-a="completeSale" ${CART.lines.length ? "" : "disabled"}>${t("completeSale")} · ${usd(total)}</button>
    </section></div>`;
  },
});
onInput("sellQ", (el) => { CART.q = el.value; rerender(); });
onInput("cartField", (el) => { CART[el.dataset.k] = el.value; rerender(); });
onInput("linePrice", (el) => { CART.lines[+el.dataset.i].unit_price = el.value; rerender(); });
onInput("lineQty", (el) => { const i = +el.dataset.i, v = num(el.value); if (v <= 0) CART.lines.splice(i, 1); else CART.lines[i].qty = v; rerender(); });
onInput("onAcc", (el) => { CART.onAccount = el.checked; });
on("sellEnter", (el) => {
  const v = el.value.trim(); if (!v) return;
  const p = core.findBarcode(v); if (p) return addToCart(p);
  const r = core.searchProducts(v, 2); if (r.length === 1) return addToCart(r[0]);
  if (/^\d{6,}$/.test(v)) { CART.q = ""; onCode(v, "sell"); }
});
on("scan", (el) => openScanner((code) => onCode(code, el.dataset.ctx), { continuous: el.dataset.ctx === "sell" }));
on("cartAdd", (el) => { const p = S.byId.get(el.dataset.id); if (p) addToCart(p); document.getElementById("sellQ")?.focus(); });
on("qtyInc", (el) => { CART.lines[+el.dataset.i].qty = num(CART.lines[+el.dataset.i].qty) + 1; rerender(); });
on("qtyDec", (el) => { const l = CART.lines[+el.dataset.i]; l.qty = num(l.qty) - 1; if (l.qty <= 0) CART.lines.splice(+el.dataset.i, 1); rerender(); });
on("custClear", () => { CART.customer = null; CART.onAccount = false; rerender(); });
on("custPick", async () => { if (!S.customers.length) await core.loadCustomers(); pickCustomer((c) => { CART.customer = c; rerender(); }); });
on("customItem", () => openModal({ d: { name: "", price: "", qty: 1 }, render: (m) => sheetHead(t("customItem")) + `
  <div class="fgrid"><div class="field full"><label for="ciN">${t("name")}</label><input class="input" id="ciN" autofocus placeholder="${t("customHint")}" value="${esc(m.d.name)}" data-in="mField" data-k="name"></div>
  <div class="field"><label for="ciP">${t("unitPrice")}</label><input class="input" id="ciP" inputmode="decimal" value="${esc(m.d.price)}" data-in="mField" data-k="price"></div>
  <div class="field"><label for="ciQ">${t("qty")}</label><input class="input" id="ciQ" inputmode="decimal" value="${esc(m.d.qty)}" data-in="mField" data-k="qty"></div></div>
  <div class="sheet-f"><button class="btn" data-a="closeModal">${t("cancel")}</button><button class="btn primary" data-a="customAdd">${t("add")}</button></div>` }));
on("customAdd", () => {
  const d = M.current.d; if (!String(d.name).trim() || !num(d.price)) return;
  CART.lines.push({ product_id: null, name: String(d.name).trim(), qty: Math.max(num(d.qty), 1), unit_price: round2(d.price), kind: "service" });
  closeModal(); rerender();
});
onInput("mField", (el) => { M.current.d[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; if (el.dataset.re) renderModal(); });

on("completeSale", async (el) => {
  if (!CART.lines.length) return;
  el.disabled = true;
  const payload = {
    customer_id: CART.customer?.id || null, discount: num(CART.discount), paid_usd: num(CART.payU), paid_lbp: num(CART.payL),
    on_account: !!(CART.customer && CART.onAccount), repair_id: CART.repairId,
    lines: CART.lines.map((l) => (l.product_id ? { product_id: l.product_id, qty: num(l.qty), ...(ownerApp() ? { unit_price: num(l.unit_price) } : {}) }
                                              : { name: l.name, qty: num(l.qty), unit_price: num(l.unit_price) })),
  };
  try {
    const r = await core.createSale(payload);
    resetCart(); rerender();
    toast(t("saleDone") + " · #" + r.receipt_no);
    if (payload.on_account || payload.customer_id) core.loadCustomers().catch(() => {});
    openReceipt(r.id);
  } finally { el.disabled = false; }
});

/* ---------- customer picker (used by Sell and Repairs) ---------- */
export function pickCustomer(onPick) {
  openModal({ q: "", d: { name: "", phone: "" }, render: (m) => {
    const res = m.q ? core.searchCustomers(m.q, 8) : S.customers.slice(0, 8);
    return sheetHead(t("customer")) + `
    <input class="input" id="cpQ" type="search" autofocus placeholder="${t("search")}" value="${esc(m.q)}" data-in="cpQ">
    <div class="list">${res.map((c) => { const b = S.balances.get(c.id) || 0; return `<button class="li" data-a="cpPick" data-id="${c.id}"><span class="main"><b>${esc(c.name)}</b><small>${esc(c.phone)}</small></span>${b > 0 ? `<span class="pill warn">${usd(b)}</span>` : ""}</button>`; }).join("")}</div>
    <div class="subcard"><h3>${t("addCustomer")}</h3><div class="fgrid">
      <div class="field"><label for="cpN">${t("name")}</label><input class="input" id="cpN" value="${esc(m.d.name || m.q)}" data-in="mField" data-k="name"></div>
      <div class="field"><label for="cpP">${t("phone")}</label><input class="input" id="cpP" inputmode="tel" value="${esc(m.d.phone)}" data-in="mField" data-k="phone"></div></div>
      <button class="btn primary" data-a="cpCreate">${t("add")}</button></div>`;
  }, onPick });
}
onInput("cpQ", (el) => { M.current.q = el.value; renderModal(); });
on("cpPick", (el) => { const c = S.customers.find((x) => x.id === el.dataset.id); const f = M.current.onPick; closeModal(); f(c); });
on("cpCreate", async () => {
  const m = M.current, name = String(m.d.name || m.q).trim(); if (!name) return;
  const c = await core.saveCustomer(null, { name, phone: m.d.phone });
  const f = m.onPick; closeModal(); f(c);
});

/* ---------- receipt viewer ---------- */
export async function openReceipt(id) {
  const data = await core.loadSale(id);
  openModal({ data, render: (m) => sheetHead(`${t("receiptNo")} #${m.data.sale.receipt_no}`) + `
    <div class="receipt-preview">${receiptHTML(m.data)}</div>
    <div class="sheet-f">${ownerApp() && !m.data.sale.voided ? `<button class="btn danger" data-a="voidSale">${m.confirm ? t("confirmDelete") : t("voidSale")}</button>` : ""}
      <span class="grow"></span><button class="btn" data-a="closeModal">${t("close")}</button>
      <button class="btn primary" data-a="receiptPdf">${ICON.pdf}${t("downloadPdf")}</button></div>` });
}
on("receiptPdf", async () => { const d = M.current.data; await exportPdf(receiptHTML(d), `receipt-${d.sale.receipt_no}.pdf`); });
on("voidSale", async () => {
  const m = M.current; if (!confirmTwice(m, "confirm")) return;
  await core.voidSale(m.data.sale.id); closeModal(); toast(t("saved")); rerender();
});

/* =====================================================================
   STOCK
   ===================================================================== */
const SF = { q: "", cat: "all", low: false, hidden: false };
view("stock", {
  load: async () => { await core.loadProducts(true); if (ownerApp() && !S.suppliers.length) await core.loadSuppliers(); },
  render() {
    const all = S.products, q = SF.q.trim().toLowerCase(), owner = ownerApp();
    const counts = {}; for (const p of all) if (p.active) counts[p.category] = (counts[p.category] || 0) + 1;
    const list = all.filter((p) => (SF.hidden ? !p.active : p.active) && (SF.cat === "all" || p.category === SF.cat) && (!SF.low || isLow(p))
      && (!q || p.name.toLowerCase().includes(q) || (p.barcode || "").startsWith(q)));
    const lowN = all.filter(isLow).length;
    return `<section class="card">
      <div class="card-h"><h2>${t("stock")}</h2><span class="muted num">${list.length}</span>${owner ? `<button class="btn sm" data-a="csvImport">${t("importCsv")}</button><button class="btn sm" data-a="csvExport">${t("exportCsv")}</button>` : ""}<button class="btn primary sm" data-a="productNew">${ICON.plus}${t("addProduct")}</button></div>
      <div class="scanbar"><input class="input" id="stockQ" type="search" autocomplete="off" placeholder="${t("scanSearch")}" value="${esc(SF.q)}" data-in="stockQ" data-enter="stockEnter">
        <button class="btn" data-a="scan" data-ctx="stock" aria-label="${t("scan")}">${ICON.cam}</button></div>
      <div class="chips">
        <button class="fchip ${lowN ? "alert" : ""}" data-a="sf" data-k="low" aria-pressed="${SF.low}">${t("lowStock")} · ${lowN}</button>
        <button class="fchip" data-a="sf" data-k="cat" data-v="all" aria-pressed="${SF.cat === "all"}">${t("all")}</button>
        ${CATS.filter((c) => counts[c]).map((c) => `<button class="fchip" data-a="sf" data-k="cat" data-v="${c}" aria-pressed="${SF.cat === c}">${catName(c)} · ${counts[c]}</button>`).join("")}
        ${owner ? `<button class="fchip" data-a="sf" data-k="hidden" aria-pressed="${SF.hidden}">${t("hidden")}</button>` : ""}
      </div>
      ${all.length ? "" : `<div class="empty"><p>${t("noProducts")}</p></div>`}
      <div class="list">${list.slice(0, 400).map((p) => {
        const pr = owner ? S.privateById.get(p.id) : null;
        const mg = pr && num(p.price_usd) ? Math.round(((num(p.price_usd) - num(pr.cost_usd)) / num(p.price_usd)) * 100) : null;
        return `<button class="li" data-a="productOpen" data-id="${p.id}">${qtyPill(p)}
          <span class="main"><b>${esc(p.name)}</b><small>${catName(p.category)}${p.barcode ? ` · <span class="mono">${esc(p.barcode)}</span>` : ""}${pr ? ` · ${t("cost")} ${usd(pr.cost_usd)}` : ""}</small></span>
          <span class="price num">${usd(p.price_usd)}<small>${mg != null ? mg + "% " + t("marginPct") : fmtLL(toLL(p.price_usd), LL())}</small></span></button>`;
      }).join("")}</div></section>`;
  },
});
onInput("stockQ", (el) => { SF.q = el.value; rerender(); });

/* ---------- owner: bulk import / export (Excel saved as CSV) ---------- */
function parseCsv(txt) {
  txt = txt.replace(/^\ufeff/, "");
  const first = txt.split(/\r?\n/)[0] || "", delim = first.split(";").length > first.split(",").length ? ";" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && cell === "") q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && txt[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const out = rows.filter((r) => r.some((x) => String(x).trim()));
  out.delim = delim;
  return out;
}
const COLS = { name: ["name", "nom", "الاسم", "product", "produit", "article"], barcode: ["barcode", "code", "code-barres", "ean", "isbn", "الباركود"],
  category: ["category", "categorie", "catégorie", "الفئة"], cost: ["cost", "cout", "coût", "الكلفة"], price: ["price", "prix", "السعر"],
  qty: ["qty", "quantity", "quantite", "quantité", "stock", "الكمية"], min: ["min", "minimum", "alert", "alerte"], supplier: ["supplier", "fournisseur", "المورد"] };
function matchCat(v) {
  v = String(v || "").trim().toLowerCase(); if (!v) return "stationery";
  for (const c of CATS) if (c === v || catName(c).toLowerCase() === v) return c;
  if (/book|livre|كتب|كتاب/.test(v)) return "books"; if (/part|pièce|piece|قطع/.test(v)) return "bike_parts";
  if (/bike|vélo|velo|دراج/.test(v)) return "bikes"; if (/toy|jouet|لعب/.test(v)) return "toys";
  if (/bag|cartable|sac|حقيب/.test(v)) return "bags"; if (/uniform|زي/.test(v)) return "uniforms"; return "other";
}
on("csvImport", () => {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".csv,text/csv,text/plain";
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const rows = parseCsv(await f.text()); if (rows.length < 2) return;
    const hdr = rows[0].map((h) => String(h).trim().toLowerCase()), idx = {};
    for (const k in COLS) idx[k] = hdr.findIndex((h) => COLS[k].includes(h));
    if (idx.name < 0) idx.name = 0;
    if (!S.suppliers.length) await core.loadSuppliers();
    const items = [];
    for (const r of rows.slice(1)) {
      const g = (k) => (idx[k] >= 0 ? String(r[idx[k]] ?? "").trim() : "");
      // Excel in French/Arabic settings saves "1,10" with ";" between columns: the comma is a decimal point there.
      const n = (k) => num(rows.delim === ";" ? g(k).replace(/\s/g, "").replace(",", ".") : g(k));
      if (!g("name")) continue;
      items.push({ name: g("name"), barcode: g("barcode"), category: matchCat(g("category")), price_usd: n("price"), qty: n("qty"),
        min_qty: idx.min >= 0 ? n("min") : 5, cost_usd: n("cost"), supplier: g("supplier") });
    }
    const n = await core.importProducts(items);
    toast(`${n.created} ${t("importDone")} · ${n.skipped} ${t("importSkipped")}`); rerender();
  };
  inp.click();
});
on("csvExport", () => {
  const sup = (id) => (S.suppliers.find((s) => s.id === id) || {}).name || "";
  const rows = [["name", "barcode", "category", "cost", "price", "qty", "min", "supplier"],
    ...S.products.map((p) => { const pr = S.privateById.get(p.id) || {}; return [p.name, p.barcode || "", p.category, pr.cost_usd ?? "", p.price_usd, p.qty, p.min_qty, sup(pr.supplier_id)]; })];
  core.downloadText(`stock-${core.todayISO()}.csv`, core.toCsv(rows));
});
on("stockEnter", (el) => { const p = core.findBarcode(el.value); if (p) openProduct(p.id); else if (/^\d{6,}$/.test(el.value.trim())) onCode(el.value.trim(), "stock"); });
on("sf", (el) => { const k = el.dataset.k; if (k === "cat") SF.cat = el.dataset.v; else SF[k] = !SF[k]; rerender(); });
on("productNew", () => openProduct(null));
on("productOpen", (el) => openProduct(el.dataset.id));

export function openProduct(id, extra = {}) {
  const p = id ? S.byId.get(id) : null, pr = id ? S.privateById.get(id) : null;
  const d = p ? { ...p } : { name: "", barcode: extra.barcode || "", category: "stationery", kind: "item", price_usd: "", qty: "", min_qty: "5", active: true };
  d.cost_usd = pr ? pr.cost_usd : ""; d.supplier_id = pr ? pr.supplier_id || "" : "";
  openModal({ id, d, addToCart: extra.addToCart, adj: "add", adjQ: "", history: null, render: renderProduct });
}
function renderProduct(m) {
  const d = m.d, owner = ownerApp(), isNew = !m.id, p = m.id ? S.byId.get(m.id) : null;
  const priceLocked = !isNew && !isOwner();
  const mg = num(d.price_usd) && num(d.cost_usd) ? Math.round(((num(d.price_usd) - num(d.cost_usd)) / num(d.price_usd)) * 100) : null;
  return sheetHead(isNew ? t("addProduct") : esc(p.name)) + `
  <div class="fgrid">
    <div class="field full"><label for="pN">${t("name")}</label><input class="input" id="pN" ${isNew ? "autofocus" : ""} value="${esc(d.name)}" data-in="mField" data-k="name"></div>
    <div class="field"><label for="pB">${t("barcode")}</label><div class="scanbar"><input class="input mono" id="pB" inputmode="numeric" value="${esc(d.barcode || "")}" data-in="mField" data-k="barcode"><button class="btn" data-a="scan" data-ctx="product" aria-label="${t("scan")}">${ICON.cam}</button></div></div>
    <div class="field"><label for="pC">${t("category")}</label><select class="input" id="pC" data-ch="mField" data-k="category">${CATS.map((c) => `<option value="${c}" ${d.category === c ? "selected" : ""}>${catName(c)}</option>`).join("")}</select></div>
    <div class="field"><label for="pK">${t("kind")}</label><select class="input" id="pK" data-ch="mField" data-k="kind" data-re="1"><option value="item" ${d.kind === "item" ? "selected" : ""}>${t("kindItem")}</option><option value="service" ${d.kind === "service" ? "selected" : ""}>${t("kindService")}</option></select></div>
    <div class="field"><label for="pP">${t("priceUsd")}</label><input class="input" id="pP" inputmode="decimal" value="${esc(d.price_usd)}" data-in="mField" data-k="price_usd" data-re="1" ${priceLocked ? "disabled" : ""}>
      <small class="muted num">${priceLocked ? t("priceLocked") : fmtLL(toLL(d.price_usd), LL())}</small></div>
    ${isNew && d.kind === "item" ? `<div class="field"><label for="pQ">${t("quantity")}</label><input class="input" id="pQ" inputmode="decimal" value="${esc(d.qty)}" data-in="mField" data-k="qty"></div>` : ""}
    ${d.kind === "item" ? `<div class="field"><label for="pM">${t("minQty")}</label><input class="input" id="pM" inputmode="decimal" value="${esc(d.min_qty)}" data-in="mField" data-k="min_qty"></div>` : ""}
  </div>
  ${owner ? `<div class="subcard owner"><h3>${t("private")}</h3><div class="fgrid">
    <div class="field"><label for="pCo">${t("costUsd")}</label><input class="input" id="pCo" inputmode="decimal" value="${esc(d.cost_usd)}" data-in="mField" data-k="cost_usd" data-re="1">
      ${mg != null ? `<small class="num ${mg < 15 ? "warn-t" : "ok-t"}">${t("margin")} ${mg}% · ${usd(num(d.price_usd) - num(d.cost_usd))}</small>` : ""}</div>
    <div class="field"><label for="pS">${t("supplier")}</label><select class="input" id="pS" data-ch="mField" data-k="supplier_id"><option value="">${t("none")}</option>${S.suppliers.map((s) => `<option value="${s.id}" ${d.supplier_id === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
  </div></div>` : ""}
  ${p && p.kind === "item" ? `<div class="subcard"><div class="card-h"><h3>${t("adjust")}</h3>${qtyPill(p)}</div>
    <div class="chips">${[["add", "received"], ["remove", "removed"], ["set", "counted"]].map(([k, l]) => `<button class="fchip" data-a="adjKind" data-v="${k}" aria-pressed="${m.adj === k}">${t(l)}</button>`).join("")}</div>
    <div class="row"><input class="input" id="adjQ" inputmode="decimal" style="max-width:130px" placeholder="${t("qty")}" value="${esc(m.adjQ)}" data-in="adjQ" data-enter="adjApply"><button class="btn primary" data-a="adjApply">${t("apply")}</button>
    <button class="btn ghost sm" data-a="histLoad">${t("history")}</button></div>
    ${m.history ? `<div class="list compact">${m.history.map((h) => `<div class="li"><span class="mono muted">${fmtDate(h.created_at)}</span><span class="main"><b>${esc(h.reason)}${h.note ? " · " + esc(h.note) : ""}</b><small>${esc(core.teamName(h.user_id))}</small></span><span class="num ${num(h.delta) < 0 ? "warn-t" : "ok-t"}">${num(h.delta) > 0 ? "+" : ""}${num(h.delta)} → ${num(h.qty_after)}</span></div>`).join("") || `<p class="muted">—</p>`}</div>` : ""}
  </div>` : ""}
  <div class="sheet-f">
    ${owner && p ? `<button class="btn danger" data-a="productDel">${m.confirm ? t("confirmDelete") : t("delete")}</button>
      <button class="btn ghost" data-a="productHide">${p.active ? t("archive") : t("active")}</button>` : ""}
    <span class="grow"></span><button class="btn" data-a="closeModal">${t("cancel")}</button><button class="btn primary" data-a="productSave">${t("save")}</button></div>`;
}
onInput("adjQ", (el) => { M.current.adjQ = el.value; });
on("adjKind", (el) => { M.current.adj = el.dataset.v; renderModal(); document.getElementById("adjQ")?.focus(); });
on("adjApply", async () => {
  const m = M.current; const q = num(m.adjQ); if (!q && m.adj !== "set") return;
  await core.adjustStock(m.id, m.adj, q, "");
  m.adjQ = ""; m.history = null; toast(t("saved")); renderModal(); rerender();
});
on("histLoad", async () => { const m = M.current; m.history = await core.stockHistory(m.id); renderModal(); });
on("productSave", async (el) => {
  const m = M.current, d = m.d; if (!String(d.name).trim()) { document.getElementById("pN")?.focus(); return; }
  el.disabled = true;
  try {
    const id = await core.saveProduct(m.id, d, ownerApp() ? { cost_usd: d.cost_usd, supplier_id: d.supplier_id } : null);
    const add = m.addToCart; closeModal(); toast(t("saved"));
    if (add) addToCart(S.byId.get(id)); else rerender();
  } finally { el.disabled = false; }
});
on("productDel", async () => { const m = M.current; if (!confirmTwice(m, "confirm")) return; await core.deleteProduct(m.id); closeModal(); rerender(); });
on("productHide", async () => { const m = M.current, p = S.byId.get(m.id); await core.saveProduct(m.id, { ...p, active: !p.active }, null); closeModal(); rerender(); });

/* =====================================================================
   CUSTOMERS
   ===================================================================== */
const CF = { q: "", owing: false };
view("customers", {
  load: () => core.loadCustomers(),
  render() {
    const list = (CF.q ? core.searchCustomers(CF.q, 500) : S.customers).filter((c) => !CF.owing || (S.balances.get(c.id) || 0) > 0.004);
    const totalOwed = [...S.balances.values()].reduce((a, b) => a + Math.max(b, 0), 0);
    return `<section class="card"><div class="card-h"><h2>${t("customers")}</h2><span class="muted num">${S.customers.length}</span><button class="btn primary sm" data-a="custNew">${ICON.plus}${t("addCustomer")}</button></div>
      <input class="input" id="custQ" type="search" placeholder="${t("search")}" value="${esc(CF.q)}" data-in="custQ">
      <div class="chips"><button class="fchip ${totalOwed ? "alert" : ""}" data-a="custOwing" aria-pressed="${CF.owing}">${t("balance")} · ${usd(totalOwed)}</button></div>
      ${list.length ? `<div class="list">${list.slice(0, 300).map((c) => { const b = S.balances.get(c.id) || 0;
        return `<button class="li" data-a="custOpen" data-id="${c.id}"><span class="main"><b>${esc(c.name)}</b><small>${esc(c.phone)}</small></span>${b > 0.004 ? `<span class="pill warn num">${usd(b)}</span>` : ""}</button>`; }).join("")}</div>`
        : `<p class="muted">${t("noCustomers")}</p>`}</section>`;
  },
});
onInput("custQ", (el) => { CF.q = el.value; rerender(); });
on("custOwing", () => { CF.owing = !CF.owing; rerender(); });
on("custNew", () => openCustomer(null));
on("custOpen", (el) => openCustomer(el.dataset.id));
async function openCustomer(id) {
  const c = id ? S.customers.find((x) => x.id === id) : null;
  const m = { id, d: c ? { ...c } : { name: "", phone: "", notes: "" }, pay: "", sales: null, render: renderCustomer };
  openModal(m);
  if (id) { m.sales = await core.listSales({ customerId: id, limit: 30 }); if (M.current === m) renderModal(); }
}
function renderCustomer(m) {
  const b = m.id ? S.balances.get(m.id) || 0 : 0;
  return sheetHead(m.id ? esc(m.d.name) : t("addCustomer")) + `
  <div class="fgrid"><div class="field"><label for="cN">${t("name")}</label><input class="input" id="cN" ${m.id ? "" : "autofocus"} value="${esc(m.d.name)}" data-in="mField" data-k="name"></div>
  <div class="field"><label for="cP">${t("phone")}</label><input class="input" id="cP" inputmode="tel" value="${esc(m.d.phone)}" data-in="mField" data-k="phone"></div>
  <div class="field full"><label for="cNo">${t("notes")}</label><textarea class="input" id="cNo" rows="2" data-in="mField" data-k="notes">${esc(m.d.notes)}</textarea></div></div>
  ${m.id ? `<div class="subcard"><div class="card-h"><h3>${t("balance")}</h3><b class="num ${b > 0.004 ? "warn-t" : ""}">${usd(b)}</b></div>
    ${b > 0.004 ? `<div class="row"><input class="input" id="payAmt" inputmode="decimal" style="max-width:140px" placeholder="${t("amountUsd")}" value="${esc(m.pay)}" data-in="payAmt"><button class="btn primary" data-a="custPay">${t("takePayment")}</button></div>` : ""}</div>
  <div class="subcard"><h3>${t("purchases")}</h3>${m.sales == null ? `<p class="muted">${t("loading")}</p>` : m.sales.length
    ? `<div class="list compact">${m.sales.map((s) => `<button class="li" data-a="receiptOpen" data-id="${s.id}"><span class="mono muted">#${s.receipt_no}</span><span class="main"><b>${fmtDate(s.created_at)}</b></span><span class="num">${usd(s.total_usd)}</span></button>`).join("")}</div>`
    : `<p class="muted">—</p>`}</div>` : ""}
  <div class="sheet-f">${m.id && ownerApp() ? `<button class="btn danger" data-a="custDel">${m.confirm ? t("confirmDelete") : t("delete")}</button>` : ""}<span class="grow"></span>
    <button class="btn" data-a="closeModal">${t("cancel")}</button><button class="btn primary" data-a="custSave">${t("save")}</button></div>`;
}
onInput("payAmt", (el) => { M.current.pay = el.value; });
on("custSave", async () => { const m = M.current; if (!String(m.d.name).trim()) return; await core.saveCustomer(m.id, m.d); closeModal(); toast(t("saved")); rerender(); });
on("custPay", async () => { const m = M.current, a = num(m.pay); if (a <= 0) return; await core.addPayment(m.id, a, ""); m.pay = ""; toast(t("paymentSaved")); renderModal(); rerender(); });
on("custDel", async () => { const m = M.current; if (!confirmTwice(m, "confirm")) return; await core.sb.from("customers").delete().eq("id", m.id).then(core.check); await core.loadCustomers(); closeModal(); rerender(); });
on("receiptOpen", (el) => openReceipt(el.dataset.id));

/* =====================================================================
   REPAIRS
   ===================================================================== */
const RF = { status: "open", jobs: [] };
const OPEN = ["received", "in_progress", "ready"];
const stPill = (s) => `<span class="pill st-${s}">${t("st_" + s)}</span>`;
const jobTotal = (j) => num(j.labour_usd) + (j.repair_parts || []).reduce((a, p) => a + num(p.qty) * num(p.unit_price), 0);
view("repairs", {
  load: async () => { RF.jobs = await core.listRepairs(); if (!S.customers.length) await core.loadCustomers(); await core.loadProducts(); },
  render() {
    const list = RF.jobs.filter((j) => (RF.status === "open" ? OPEN.includes(j.status) : j.status === RF.status));
    const cnt = (s) => RF.jobs.filter((j) => (s === "open" ? OPEN.includes(j.status) : j.status === s)).length;
    return `<section class="card"><div class="card-h"><h2>${t("repairs")}</h2><button class="btn primary sm" data-a="jobNew">${ICON.plus}${t("newJob")}</button></div>
      <div class="chips">${["open", "ready", "collected", "cancelled"].map((s) => `<button class="fchip" data-a="rf" data-v="${s}" aria-pressed="${RF.status === s}">${s === "open" ? t("openJobs") : t("st_" + s)} · ${cnt(s)}</button>`).join("")}</div>
      ${list.length ? `<div class="list">${list.map((j) => { const c = S.customers.find((x) => x.id === j.customer_id);
        return `<button class="li" data-a="jobOpen" data-id="${j.id}"><span class="mono muted">#${j.job_no}</span><span class="main"><b>${esc(c ? c.name : "—")} · ${esc(j.bike)}</b><small>${esc(j.problem)} · ${fmtDate(j.created_at)}</small></span>${stPill(j.status)}<span class="price num">${usd(jobTotal(j))}</span></button>`; }).join("")}</div>`
        : `<p class="muted">${t("noJobs")}</p>`}</section>`;
  },
});
on("rf", (el) => { RF.status = el.dataset.v; rerender(); });
on("jobNew", () => openJob(null));
on("jobOpen", (el) => openJob(el.dataset.id));
function openJob(id) {
  const j = id ? RF.jobs.find((x) => x.id === id) : null;
  const d = j ? { ...j } : { customer_id: null, bike: "", problem: "", status: "received", labour_usd: "", notes: "" };
  const parts = (j?.repair_parts || []).map((p) => ({ ...p }));
  openModal({ id, d, parts, pq: "", render: renderJob });
}
function addPart(m, p) {
  const ex = m.parts.find((x) => x.product_id === p.id);
  if (ex) ex.qty = num(ex.qty) + 1; else m.parts.push({ product_id: p.id, name: p.name, qty: 1, unit_price: num(p.price_usd) });
  m.pq = ""; renderModal();
}
function renderJob(m) {
  const d = m.d, c = S.customers.find((x) => x.id === d.customer_id);
  const res = m.pq ? core.searchProducts(m.pq, 6) : [];
  const total = num(d.labour_usd) + m.parts.reduce((a, p) => a + num(p.qty) * num(p.unit_price), 0);
  const closed = ["collected", "cancelled"].includes(d.status);
  return sheetHead(m.id ? `${t("job")} #${d.job_no}` : t("newJob")) + `
  <div class="row">${c ? `<span class="pill strong">${esc(c.name)}${c.phone ? " · " + esc(c.phone) : ""}</span>` : ""}<button class="btn sm" data-a="jobCust" ${closed ? "disabled" : ""}>${c ? t("edit") : t("chooseCustomer")}</button></div>
  <div class="fgrid"><div class="field"><label for="jB">${t("bike")}</label><input class="input" id="jB" placeholder="${t("bikeHint")}" value="${esc(d.bike)}" data-in="mField" data-k="bike"></div>
  <div class="field"><label for="jL">${t("labour")}</label><input class="input" id="jL" inputmode="decimal" value="${esc(d.labour_usd)}" data-in="mField" data-k="labour_usd" data-re="1"></div>
  <div class="field full"><label for="jP">${t("problem")}</label><textarea class="input" id="jP" rows="2" data-in="mField" data-k="problem">${esc(d.problem)}</textarea></div></div>
  ${m.id ? `<div class="chips">${["received", "in_progress", "ready", "cancelled"].map((s) => `<button class="fchip" data-a="jobStatus" data-v="${s}" aria-pressed="${d.status === s}" ${d.status === "collected" ? "disabled" : ""}>${t("st_" + s)}</button>`).join("")}${d.status === "collected" ? stPill("collected") : ""}</div>` : ""}
  <div class="subcard"><h3>${t("parts")}</h3>
    ${m.parts.map((p, i) => `<div class="cartline"><div class="nm"><b>${esc(p.name)}</b><small class="muted num">${usd(p.unit_price)}</small></div>
      <div class="stepper"><button data-a="partDec" data-i="${i}" ${closed ? "disabled" : ""}>−</button><input value="${esc(p.qty)}" readonly aria-label="${t("qty")}"><button data-a="partInc" data-i="${i}" ${closed ? "disabled" : ""}>+</button></div>
      <b class="num lt">${usd(num(p.qty) * num(p.unit_price))}</b></div>`).join("")}
    ${closed ? "" : `<div class="scanbar"><input class="input" id="partQ" type="search" autocomplete="off" placeholder="${t("addPart")}" value="${esc(m.pq)}" data-in="partQ"><button class="btn" data-a="scan" data-ctx="part" aria-label="${t("scan")}">${ICON.cam}</button></div>
    ${res.length ? `<div class="results">${res.map((p) => `<button data-a="partAdd" data-id="${p.id}">${qtyPill(p)}<span class="grow">${esc(p.name)}</span><span class="num">${usd(p.price_usd)}</span></button>`).join("")}</div>` : ""}`}
  </div>
  <div class="tr total"><span>${t("estimate")}</span><span class="grand num">${usd(total)}</span></div>
  <div class="sheet-f">${m.id && ownerApp() ? `<button class="btn danger" data-a="jobDel">${m.confirm ? t("confirmDelete") : t("delete")}</button>` : ""}
    ${m.id ? `<button class="btn ghost" data-a="jobTicket">${ICON.pdf}${t("ticket")}</button>` : ""}<span class="grow"></span>
    <button class="btn" data-a="jobSave" ${closed ? "disabled" : ""}>${t("save")}</button>
    ${m.id && !closed ? `<button class="btn pencil" data-a="jobBill">${t("billCollect")}</button>` : ""}</div>`;
}
onInput("partQ", (el) => { M.current.pq = el.value; renderModal(); });
on("partAdd", (el) => { const p = S.byId.get(el.dataset.id); if (p) addPart(M.current, p); });
on("partInc", (el) => { M.current.parts[+el.dataset.i].qty = num(M.current.parts[+el.dataset.i].qty) + 1; renderModal(); });
on("partDec", (el) => { const m = M.current, p = m.parts[+el.dataset.i]; p.qty = num(p.qty) - 1; if (p.qty <= 0) m.parts.splice(+el.dataset.i, 1); renderModal(); });
on("jobStatus", (el) => { M.current.d.status = el.dataset.v; renderModal(); });
on("jobCust", () => { const m = M.current; pickCustomer((c) => { m.d.customer_id = c.id; openModal(m); }); });
async function saveJob(m) { const r = await core.saveRepair(m.id, m.d, m.parts); RF.jobs = await core.listRepairs(); return r; }
on("jobSave", async (el) => { el.disabled = true; try { await saveJob(M.current); closeModal(); toast(t("saved")); rerender(); } finally { el.disabled = false; } });
on("jobTicket", async () => { const m = M.current, j = RF.jobs.find((x) => x.id === m.id) || m.d; const c = S.customers.find((x) => x.id === m.d.customer_id);
  await exportPdf(ticketHTML({ ...j, ...m.d, repair_parts: m.parts }, c), `repair-${m.d.job_no}.pdf`); });
on("jobDel", async () => { const m = M.current; if (!confirmTwice(m, "confirm")) return; await core.sb.from("repairs").delete().eq("id", m.id).then(core.check); RF.jobs = await core.listRepairs(); closeModal(); rerender(); });
on("jobBill", async () => {
  const m = M.current; const r = await saveJob(m);
  resetCart();
  for (const p of m.parts) {
    const prod = p.product_id && S.byId.get(p.product_id);
    if (prod) CART.lines.push({ product_id: prod.id, name: prod.name, qty: num(p.qty), unit_price: num(prod.price_usd), kind: prod.kind });
    else CART.lines.push({ product_id: null, name: p.name, qty: num(p.qty), unit_price: num(p.unit_price), kind: "service" });
  }
  if (num(m.d.labour_usd)) CART.lines.push({ product_id: null, name: `${t("repairLabour")} #${r.job_no}`, qty: 1, unit_price: num(m.d.labour_usd), kind: "service" });
  CART.customer = S.customers.find((c) => c.id === m.d.customer_id) || null;
  CART.repairId = r.id; CART.repairNo = r.job_no;
  closeModal(); go("sell");
});

/* =====================================================================
   RECEIPTS
   ===================================================================== */
const RC = { from: core.todayISO(), to: core.todayISO(), rows: [] };
view("receipts", {
  load: async () => {
    if (!S.customers.length) await core.loadCustomers();
    RC.rows = ownerApp() ? await core.listSales({ from: RC.from, to: RC.to, limit: 500 }) : await core.listSales({ limit: 200 });
  },
  render() {
    const owner = ownerApp(), rows = RC.rows;
    const total = rows.filter((r) => !r.voided).reduce((a, r) => a + num(r.total_usd), 0);
    return `<section class="card"><div class="card-h"><h2>${t("receipts")}</h2><span class="muted num">${rows.length} · ${usd(total)}</span></div>
      ${owner ? `<div class="row"><div class="field"><label for="rcF">${t("from")}</label><input class="input" type="date" id="rcF" value="${RC.from}" data-ch="rcDate" data-k="from"></div>
        <div class="field"><label for="rcT">${t("to")}</label><input class="input" type="date" id="rcT" value="${RC.to}" data-ch="rcDate" data-k="to"></div></div>`
      : `<p class="muted small">${t("staffReceiptsHint")}</p>`}
      ${rows.length ? `<div class="list">${rows.map((r) => { const c = S.customers.find((x) => x.id === r.customer_id);
        return `<button class="li" data-a="receiptOpen" data-id="${r.id}"><span class="mono muted">#${r.receipt_no}</span><span class="main"><b>${fmtDate(r.created_at)}${c ? " · " + esc(c.name) : ""}</b><small>${esc(core.teamName(r.seller_id))}${r.repair_id ? " · " + t("job") : ""}</small></span>
          ${r.voided ? `<span class="pill">${t("voided")}</span>` : num(r.on_account) ? `<span class="pill warn">${t("balance")}</span>` : ""}<span class="price num ${r.voided ? "strike" : ""}">${usd(r.total_usd)}</span></button>`; }).join("")}</div>`
      : `<p class="muted">${t("noReceipts")}</p>`}</section>`;
  },
});
onInput("rcDate", async (el) => { RC[el.dataset.k] = el.value; RC.rows = await core.listSales({ from: RC.from, to: RC.to, limit: 500 }); rerender(); });
