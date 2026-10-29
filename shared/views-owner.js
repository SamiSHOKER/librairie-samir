// Owner-only screens: dashboard, reports, purchase orders, suppliers,
// school book planner, team accounts and settings.
import { t, catName } from "./i18n.js";
import * as core from "./core.js";
import { S, num, usd, toLL, fmtLL, isLow, round2 } from "./core.js";
import { esc, ICON, on, onInput, view, rerender, go, openModal, closeModal, renderModal, sheetHead, toast, M, fmtDate, confirmTwice, R } from "./ui.js";

const today = () => core.todayISO();
const monthStart = () => today().slice(0, 8) + "01";
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/* ---------------- dashboard ---------------- */
const DB = { rep: null, stockValue: 0, openJobs: 0 };
view("home", {
  load: async () => {
    const from = core.addDays(today(), -29) < monthStart() ? core.addDays(today(), -29) : monthStart();
    const [rep, sv] = await Promise.all([core.reports(from, today()), core.stockValue(), core.loadProducts(true), core.loadCustomers()]);
    DB.rep = rep; DB.stockValue = sv;
    const { count } = await core.sb.from("repairs").select("id", { count: "exact", head: true }).in("status", ["received", "in_progress", "ready"]);
    DB.openJobs = count || 0;
  },
  render() {
    const d = DB.rep.daily, td = today(), ms = monthStart();
    const sum = (rows, k) => rows.reduce((a, r) => a + num(r[k]), 0);
    const tRows = d.filter((r) => r.day === td), mRows = d.filter((r) => r.day >= ms);
    const tRev = sum(tRows, "revenue"), tProf = tRev - sum(tRows, "cost");
    const mRev = sum(mRows, "revenue"), mProf = mRev - sum(mRows, "cost");
    const low = S.products.filter(isLow).length;
    const credit = [...S.balances.values()].reduce((a, b) => a + Math.max(b, 0), 0);
    const top = DB.rep.products.slice(0, 6), topMax = top.length ? num(top[0].revenue) : 1;
    return `<div class="tiles">
      <a class="tile" href="#reports"><span class="k">${t("today")}</span><span class="v num">${usd(tRev)}</span><span class="s num">${t("profit")} ${usd(tProf)} · ${sum(tRows, "receipts")} ${t("receiptsN")}</span></a>
      <a class="tile" href="#reports"><span class="k">${t("thisMonth")}</span><span class="v num">${usd(mRev)}</span><span class="s num">${t("profit")} ${usd(mProf)} · ${pct(mProf, mRev)}% ${t("marginPct")}</span></a>
      <a class="tile ${low ? "alert" : ""}" href="#stock"><span class="k">${t("lowStock")}</span><span class="v num">${low}</span><span class="s num">${t("stockValue")} ${usd(DB.stockValue)}</span></a>
      <a class="tile" href="#customers"><span class="k">${t("credit")}</span><span class="v num">${usd(credit)}</span><span class="s num">${t("openJobs")} ${DB.openJobs}</span></a>
    </div>
    <div class="grid2">
      <section class="card"><div class="card-h"><h2>${t("last30")}</h2><span class="legend"><i class="sw rev"></i>${t("revenue")} <i class="sw prof"></i>${t("profit")}</span></div>${chart30(d)}</section>
      <section class="card"><div class="card-h"><h2>${t("topProducts")}</h2><span class="muted small">${t("last30")}</span></div>
        ${top.length ? `<div class="list">${top.map((p) => `<div class="li"><span class="main"><b>${esc(p.name)}</b><div class="bar"><i style="width:${Math.max(4, (num(p.revenue) / topMax) * 100)}%"></i></div></span><span class="price num">${usd(p.revenue)}<small>${pct(num(p.revenue) - num(p.cost), num(p.revenue))}% ${t("marginPct")}</small></span></div>`).join("")}</div>` : `<p class="muted">—</p>`}
      </section></div>`;
  },
});
function chart30(daily) {
  const days = []; for (let i = 29; i >= 0; i--) days.push(core.addDays(today(), -i));
  const by = new Map(daily.map((r) => [r.day, r]));
  const vals = days.map((d) => { const r = by.get(d); return { d, rev: r ? num(r.revenue) : 0, prof: r ? num(r.revenue) - num(r.cost) : 0 }; });
  const max = Math.max(1, ...vals.map((v) => v.rev));
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); return Math.ceil(max / p) * p; })();
  const W = 600, H = 200, L = 44, B = 22, T = 8, bw = (W - L - 4) / 30;
  const y = (v) => T + (H - T - B) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  return `<div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("last30")}">
    ${ticks.map((v) => `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">$${Math.round(v)}</text>`).join("")}
    ${vals.map((v, i) => { const x = L + 2 + i * bw; return `<rect x="${x}" y="${y(v.rev)}" width="${bw - 3}" height="${H - B - y(v.rev)}" class="rev" rx="2"><title>${v.d}: ${usd(v.rev)}</title></rect>
      <rect x="${x + (bw - 3) * 0.25}" y="${y(Math.max(v.prof, 0))}" width="${(bw - 3) * 0.5}" height="${H - B - y(Math.max(v.prof, 0))}" class="prof" rx="1"/>`; }).join("")}
    ${[0, 10, 20, 29].map((i) => `<text x="${i === 29 ? W - 2 : L + 2 + i * bw + bw / 2}" y="${H - 6}" class="axis" text-anchor="${i === 29 ? "end" : "middle"}">${days[i].slice(8)}/${days[i].slice(5, 7)}</text>`).join("")}
  </svg></div>`;
}

/* ---------------- reports ---------------- */
const RP = { from: monthStart(), to: today(), data: null, tab: "day" };
view("reports", {
  load: async () => { RP.data = await core.reports(RP.from, RP.to); },
  render() {
    const { daily, products, sellers } = RP.data;
    const rev = daily.reduce((a, r) => a + num(r.revenue), 0), cost = daily.reduce((a, r) => a + num(r.cost), 0);
    const disc = daily.reduce((a, r) => a + num(r.discount), 0), rc = daily.reduce((a, r) => a + num(r.receipts), 0);
    const tab = RP.tab;
    return `<section class="card"><div class="card-h"><h2>${t("reports")}</h2><button class="btn sm" data-a="repCsv">${t("exportCsv")}</button></div>
      <div class="chips">${[["today", 0], ["7", 6], ["30", 29]].map(([k, n]) => `<button class="fchip" data-a="repPreset" data-n="${n}">${k === "today" ? t("today") : k + "d"}</button>`).join("")}<button class="fchip" data-a="repMonth">${t("thisMonth")}</button></div>
      <div class="row"><div class="field"><label for="rpF">${t("from")}</label><input class="input" type="date" id="rpF" value="${RP.from}" data-ch="repDate" data-k="from"></div>
        <div class="field"><label for="rpT">${t("to")}</label><input class="input" type="date" id="rpT" value="${RP.to}" data-ch="repDate" data-k="to"></div></div>
      <div class="tiles">
        <div class="tile"><span class="k">${t("revenue")}</span><span class="v num">${usd(rev)}</span><span class="s num">${rc} ${t("receiptsN")} · ${fmtLL(toLL(rev), t("ll"))}</span></div>
        <div class="tile"><span class="k">${t("profit")}</span><span class="v num">${usd(rev - cost)}</span><span class="s num">${pct(rev - cost, rev)}% ${t("marginPct")}</span></div>
        <div class="tile"><span class="k">${t("cost")}</span><span class="v num">${usd(cost)}</span><span class="s num">${t("discount")} ${usd(disc)}</span></div>
      </div>
      <div class="chips">${[["day", "byDay"], ["product", "byProduct"], ["seller", "bySeller"]].map(([k, l]) => `<button class="fchip" data-a="repTab" data-v="${k}" aria-pressed="${tab === k}">${t(l)}</button>`).join("")}</div>
      <div class="tablewrap"><table>
      ${tab === "day" ? `<thead><tr><th>${t("date")}</th><th class="n">${t("receiptsN")}</th><th class="n">${t("revenue")}</th><th class="n">${t("cost")}</th><th class="n">${t("profit")}</th><th class="n">%</th></tr></thead><tbody>
        ${daily.map((r) => `<tr><td>${r.day}</td><td class="n">${r.receipts}</td><td class="n">${usd(r.revenue)}</td><td class="n">${usd(r.cost)}</td><td class="n strong">${usd(num(r.revenue) - num(r.cost))}</td><td class="n">${pct(num(r.revenue) - num(r.cost), num(r.revenue))}</td></tr>`).join("")}</tbody>`
      : tab === "product" ? `<thead><tr><th>${t("name")}</th><th>${t("category")}</th><th class="n">${t("qty")}</th><th class="n">${t("revenue")}</th><th class="n">${t("profit")}</th><th class="n">%</th></tr></thead><tbody>
        ${products.map((r) => `<tr><td>${esc(r.name)}</td><td>${catName(r.category)}</td><td class="n">${num(r.qty)}</td><td class="n">${usd(r.revenue)}</td><td class="n strong">${usd(num(r.revenue) - num(r.cost))}</td><td class="n">${pct(num(r.revenue) - num(r.cost), num(r.revenue))}</td></tr>`).join("")}</tbody>`
      : `<thead><tr><th>${t("seller")}</th><th class="n">${t("receiptsN")}</th><th class="n">${t("revenue")}</th></tr></thead><tbody>
        ${sellers.map((r) => `<tr><td>${esc(r.name || "—")}</td><td class="n">${r.receipts}</td><td class="n">${usd(r.revenue)}</td></tr>`).join("")}</tbody>`}
      </table></div></section>`;
  },
});
async function repReload() { RP.data = await core.reports(RP.from, RP.to); rerender(); }
on("repPreset", (el) => { RP.to = today(); RP.from = core.addDays(RP.to, -num(el.dataset.n)); repReload(); });
on("repMonth", () => { RP.from = monthStart(); RP.to = today(); repReload(); });
onInput("repDate", (el) => { RP[el.dataset.k] = el.value; repReload(); });
on("repTab", (el) => { RP.tab = el.dataset.v; rerender(); });
on("repCsv", () => {
  const { daily, products, sellers } = RP.data;
  const rows = RP.tab === "day" ? [["date", "receipts", "revenue_usd", "cost_usd", "profit_usd"], ...daily.map((r) => [r.day, r.receipts, r.revenue, r.cost, round2(num(r.revenue) - num(r.cost))])]
    : RP.tab === "product" ? [["product", "category", "qty", "revenue_usd", "cost_usd", "profit_usd"], ...products.map((r) => [r.name, r.category, r.qty, r.revenue, r.cost, round2(num(r.revenue) - num(r.cost))])]
    : [["employee", "receipts", "revenue_usd"], ...sellers.map((r) => [r.name, r.receipts, r.revenue])];
  core.downloadText(`report-${RP.tab}-${RP.from}_${RP.to}.csv`, core.toCsv(rows));
});

/* ---------------- suppliers ---------------- */
view("suppliers", {
  load: () => core.loadSuppliers(),
  render() {
    return `<section class="card"><div class="card-h"><h2>${t("suppliers")}</h2><button class="btn primary sm" data-a="supNew">${ICON.plus}${t("addSupplier")}</button></div>
      ${S.suppliers.length ? `<div class="list">${S.suppliers.map((s) => { const n = [...S.privateById.values()].filter((p) => p.supplier_id === s.id).length;
        return `<button class="li" data-a="supOpen" data-id="${s.id}"><span class="main"><b>${esc(s.name)}</b><small>${[s.city, s.phone].filter(Boolean).map(esc).join(" · ")}</small></span><span class="pill">${n} ${t("items")}</span></button>`; }).join("")}</div>`
        : `<p class="muted">${t("noSuppliers")}</p>`}</section>`;
  },
});
const supModal = (id) => {
  const s = id ? S.suppliers.find((x) => x.id === id) : null;
  openModal({ id, d: s ? { ...s } : { name: "", phone: "", city: "", notes: "" }, render: (m) => sheetHead(m.id ? esc(m.d.name) : t("addSupplier")) + `
    <div class="fgrid"><div class="field full"><label for="sN">${t("name")}</label><input class="input" id="sN" autofocus value="${esc(m.d.name)}" data-in="mField" data-k="name"></div>
    <div class="field"><label for="sP">${t("phone")}</label><input class="input" id="sP" inputmode="tel" value="${esc(m.d.phone)}" data-in="mField" data-k="phone"></div>
    <div class="field"><label for="sC">${t("city")}</label><input class="input" id="sC" value="${esc(m.d.city)}" data-in="mField" data-k="city"></div>
    <div class="field full"><label for="sNo">${t("notes")}</label><textarea class="input" id="sNo" rows="3" data-in="mField" data-k="notes">${esc(m.d.notes)}</textarea></div></div>
    <div class="sheet-f">${m.id ? `<button class="btn danger" data-a="supDel">${m.confirm ? t("confirmDelete") : t("delete")}</button>` : ""}<span class="grow"></span>
    <button class="btn" data-a="closeModal">${t("cancel")}</button><button class="btn primary" data-a="supSave">${t("save")}</button></div>` });
};
on("supNew", () => supModal(null));
on("supOpen", (el) => supModal(el.dataset.id));
on("supSave", async () => { const m = M.current; if (!String(m.d.name).trim()) return; await core.saveSupplier(m.id, m.d); closeModal(); toast(t("saved")); rerender(); });
on("supDel", async () => { const m = M.current; if (!confirmTwice(m, "confirm")) return; await core.deleteSupplier(m.id); closeModal(); rerender(); });

/* ---------------- purchase orders ---------------- */
const PO = { list: [] };
view("orders", {
  load: async () => { await Promise.all([core.loadSuppliers(), core.loadProducts(true)]); PO.list = await core.listOrders(); },
  render() {
    const sup = (id) => (S.suppliers.find((s) => s.id === id) || {}).name || "—";
    const tot = (o) => (o.purchase_order_lines || []).reduce((a, l) => a + num(l.qty) * num(l.unit_cost), 0);
    const lowN = S.products.filter(isLow).length;
    return `<section class="card"><div class="card-h"><h2>${t("orders")}</h2>${lowN ? `<button class="btn sm" data-a="poLow">${t("fillLow")} · ${lowN}</button>` : ""}<button class="btn primary sm" data-a="poNew">${ICON.plus}${t("newOrder")}</button></div>
      ${PO.list.length ? `<div class="list">${PO.list.map((o) => `<button class="li" data-a="poOpen" data-id="${o.id}"><span class="mono muted">#${o.po_no}</span>
        <span class="main"><b>${esc(sup(o.supplier_id))}</b><small>${fmtDate(o.created_at, false)} · ${(o.purchase_order_lines || []).length} ${t("items")}${o.note ? " · " + esc(o.note) : ""}</small></span>
        <span class="pill ${o.status === "received" ? "ok" : o.status === "draft" ? "" : "warn"}">${t(o.status === "received" ? "received" : o.status === "draft" ? "draft" : "ordered")}</span><span class="price num">${usd(tot(o))}</span></button>`).join("")}</div>`
        : `<p class="muted">${t("noOrders")}</p>`}</section>`;
  },
});
function suggest(p) { return Math.max(Math.ceil(Math.max(num(p.min_qty) * 2, 1) - num(p.qty)), 1); }
function lowLines(supplierId) {
  return S.products.filter((p) => isLow(p) && (!supplierId || (S.privateById.get(p.id) || {}).supplier_id === supplierId))
    .map((p) => ({ product_id: p.id, name: p.name, qty: suggest(p), unit_cost: num((S.privateById.get(p.id) || {}).cost_usd) }));
}
function poModal(o, presetLines) {
  const d = o ? { supplier_id: o.supplier_id || "", note: o.note, status: o.status, po_no: o.po_no } : { supplier_id: "", note: "", status: "ordered" };
  const lines = o ? (o.purchase_order_lines || []).map((l) => ({ ...l })) : presetLines || [];
  openModal({ id: o?.id || null, d, lines, q: "", wide: true, render: renderPO });
}
function renderPO(m) {
  const rec = m.d.status === "received", res = rec ? [] : core.searchProducts(m.q, 6);
  const total = m.lines.reduce((a, l) => a + num(l.qty) * num(l.unit_cost), 0);
  return sheetHead(m.id ? `${t("po")} #${m.d.po_no}` : t("newOrder")) + `
  <div class="fgrid"><div class="field"><label for="poS">${t("supplier")}</label><select class="input" id="poS" data-ch="mField" data-k="supplier_id" ${rec ? "disabled" : ""}><option value="">${t("none")}</option>${S.suppliers.map((s) => `<option value="${s.id}" ${m.d.supplier_id === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
  <div class="field"><label for="poN">${t("notes")}</label><input class="input" id="poN" value="${esc(m.d.note)}" data-in="mField" data-k="note" ${rec ? "disabled" : ""}></div></div>
  ${rec ? "" : `<div class="scanbar"><input class="input" id="poQ" type="search" autocomplete="off" placeholder="${t("addProduct")}" value="${esc(m.q)}" data-in="poQ" data-enter="poEnter"><button class="btn sm" data-a="poFill">${t("fillLow")}</button></div>
  ${res.length ? `<div class="results">${res.map((p) => `<button data-a="poAdd" data-id="${p.id}"><span class="qty">${num(p.qty)}</span><span class="grow">${esc(p.name)}</span><span class="num muted">${usd((S.privateById.get(p.id) || {}).cost_usd)}</span></button>`).join("")}</div>` : ""}`}
  <div class="tablewrap"><table><thead><tr><th>${t("name")}</th><th class="n">${t("qty")}</th><th class="n">${t("costUsd")}</th><th class="n">${t("total")}</th>${rec ? "" : "<th></th>"}</tr></thead><tbody>
  ${m.lines.map((l, i) => `<tr><td class="wrap">${esc(l.name)}</td>
    <td class="n">${rec ? num(l.qty) : `<input class="input sm num" id="poq${i}" inputmode="decimal" value="${esc(l.qty)}" data-in="poLine" data-i="${i}" data-k="qty">`}</td>
    <td class="n">${rec ? usd(l.unit_cost) : `<input class="input sm num" id="poc${i}" inputmode="decimal" value="${esc(l.unit_cost)}" data-in="poLine" data-i="${i}" data-k="unit_cost">`}</td>
    <td class="n">${usd(num(l.qty) * num(l.unit_cost))}</td>${rec ? "" : `<td><button class="iconbtn sm" data-a="poDelLine" data-i="${i}" aria-label="${t("delete")}">${ICON.x}</button></td>`}</tr>`).join("")}
  </tbody></table></div>
  <div class="tr total"><span>${t("orderTotal")}</span><span class="grand num">${usd(total)}</span></div>
  <div class="sheet-f">${m.id ? `<button class="btn danger" data-a="poDel">${m.confirm ? t("confirmDelete") : t("delete")}</button>` : ""}<span class="grow"></span>
    ${rec ? `<button class="btn" data-a="closeModal">${t("close")}</button>` : `<button class="btn" data-a="poSave">${t("save")}</button><button class="btn primary" data-a="poReceive" ${m.lines.length ? "" : "disabled"}>${t("receive")}</button>`}</div>`;
}
onInput("poQ", (el) => { M.current.q = el.value; renderModal(); });
onInput("poLine", (el) => { M.current.lines[+el.dataset.i][el.dataset.k] = el.value; renderModal(); });
function poAddProduct(p) {
  const m = M.current; if (!m.lines.some((l) => l.product_id === p.id)) m.lines.push({ product_id: p.id, name: p.name, qty: suggest(p), unit_cost: num((S.privateById.get(p.id) || {}).cost_usd) });
  m.q = ""; renderModal(); document.getElementById("poQ")?.focus();
}
on("poAdd", (el) => poAddProduct(S.byId.get(el.dataset.id)));
on("poEnter", (el) => { const p = core.findBarcode(el.value) || core.searchProducts(el.value, 1)[0]; if (p) poAddProduct(p); });
on("poFill", () => { const m = M.current, have = new Set(m.lines.map((l) => l.product_id)); for (const l of lowLines(m.d.supplier_id)) if (!have.has(l.product_id)) m.lines.push(l); renderModal(); });
on("poDelLine", (el) => { M.current.lines.splice(+el.dataset.i, 1); renderModal(); });
on("poNew", () => poModal(null));
on("poLow", () => poModal(null, lowLines("")));
on("poOpen", (el) => poModal(PO.list.find((o) => o.id === el.dataset.id)));
async function poPersist(m) { const o = await core.saveOrder(m.id, m.d, m.lines); m.id = o.id; PO.list = await core.listOrders(); return o; }
on("poSave", async () => { await poPersist(M.current); closeModal(); toast(t("saved")); rerender(); });
on("poReceive", async (el) => { el.disabled = true; try { const m = M.current; await poPersist(m); await core.receiveOrder(m.id); PO.list = await core.listOrders(); closeModal(); toast(t("receivedOk")); rerender(); } finally { el.disabled = false; } });
on("poDel", async () => { const m = M.current; if (!confirmTwice(m, "confirm")) return; await core.deleteOrder(m.id); PO.list = await core.listOrders(); closeModal(); rerender(); });

/* ---------------- schools & book planner ---------------- */
const SC = { list: [] };
view("schools", {
  load: async () => { await core.loadProducts(true); SC.list = await core.loadSchools(); },
  render() {
    const share = num(S.settings.book_share) / 100, need = new Map();
    for (const s of SC.list) for (const g of s.school_grades || []) for (const b of g.grade_books || []) need.set(b.product_id, (need.get(b.product_id) || 0) + num(g.students));
    const rows = [...need.entries()].map(([pid, n]) => { const p = S.byId.get(pid); if (!p) return null; const exp = Math.ceil(n * share); return { p, n, exp, order: Math.max(exp - num(p.qty), 0) }; })
      .filter(Boolean).sort((a, b) => b.order - a.order || a.p.name.localeCompare(b.p.name));
    const toOrder = rows.filter((r) => r.order > 0);
    return `<section class="card"><div class="card-h"><h2>${t("schools")}</h2><button class="btn primary sm" data-a="schNew">${ICON.plus}${t("addSchool")}</button></div>
      <div class="list">${SC.list.map((s) => { const gs = s.school_grades || []; const st = gs.reduce((a, g) => a + num(g.students), 0); const bk = new Set(gs.flatMap((g) => (g.grade_books || []).map((b) => b.product_id)));
        return `<button class="li" data-a="schOpen" data-id="${s.id}"><span class="main"><b>${esc(s.name)}</b><small>${t("grade")}: ${gs.length} · ${t("students")}: ${st} · ${t("books")}: ${bk.size}</small></span></button>`; }).join("")}</div></section>
    <section class="card"><div class="card-h"><h2>${t("planner")}</h2>
      <div class="field" style="max-width:240px"><label for="bShare">${t("share")}</label><input class="input" id="bShare" inputmode="numeric" value="${esc(S.settings.book_share)}" data-ch="bShare"></div></div>
      ${rows.length ? `<div class="tablewrap"><table><thead><tr><th>${t("books")}</th><th class="n">${t("students")}</th><th class="n">${t("expected")}</th><th class="n">${t("inStock")}</th><th class="n">${t("toOrder")}</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td class="wrap">${esc(r.p.name)}</td><td class="n">${r.n}</td><td class="n">${r.exp}</td><td class="n">${num(r.p.qty)}</td><td class="n ${r.order ? "strong" : ""}">${r.order}</td></tr>`).join("")}</tbody></table></div>
        <div class="row"><button class="btn primary" data-a="schOrders" ${toOrder.length ? "" : "disabled"}>${t("createOrders")} · ${toOrder.length}</button></div>`
      : `<p class="muted">${t("plannerEmpty")}</p>`}</section>`;
  },
});
onInput("bShare", async (el) => { const v = Math.min(Math.max(num(el.value), 0), 100); await core.saveSetting("book_share", v); rerender(); });
on("schOrders", async () => {
  const share = num(S.settings.book_share) / 100, need = new Map();
  for (const s of SC.list) for (const g of s.school_grades || []) for (const b of g.grade_books || []) need.set(b.product_id, (need.get(b.product_id) || 0) + num(g.students));
  const bySup = new Map();
  for (const [pid, n] of need) { const p = S.byId.get(pid); if (!p) continue; const q = Math.ceil(n * share) - num(p.qty); if (q <= 0) continue;
    const pr = S.privateById.get(pid) || {}; const k = pr.supplier_id || ""; if (!bySup.has(k)) bySup.set(k, []);
    bySup.get(k).push({ product_id: pid, name: p.name, qty: q, unit_cost: num(pr.cost_usd) }); }
  for (const [sup, lines] of bySup) await core.saveOrder(null, { supplier_id: sup || null, note: t("planner"), status: "draft" }, lines);
  toast(t("saved")); go("orders");
});
function schModal(s) {
  const grades = s ? (s.school_grades || []).slice().sort((a, b) => a.sort - b.sort).map((g) => ({ name: g.name, students: g.students, books: (g.grade_books || []).map((b) => b.product_id) })) : [];
  openModal({ id: s?.id || null, d: { name: s?.name || "" }, grades, gi: null, q: "", wide: true, render: renderSchool });
}
function renderSchool(m) {
  const g = m.gi != null ? m.grades[m.gi] : null;
  const res = g ? (m.q ? core.searchProducts(m.q, 6) : S.products.filter((p) => p.category === "books" && p.active && !g.books.includes(p.id)).slice(0, 6)) : [];
  return sheetHead(m.id ? esc(m.d.name) : t("addSchool")) + `
  <div class="field"><label for="scN">${t("name")}</label><input class="input" id="scN" value="${esc(m.d.name)}" data-in="mField" data-k="name"></div>
  <div class="list">${m.grades.map((gr, i) => `<div class="li wrap-row">
    <input class="input grow" id="gn${i}" placeholder="${t("grade")}" value="${esc(gr.name)}" data-in="gField" data-i="${i}" data-k="name">
    <input class="input num" style="width:90px" id="gs${i}" inputmode="numeric" placeholder="${t("students")}" value="${esc(gr.students)}" data-in="gField" data-i="${i}" data-k="students">
    <button class="btn sm ${m.gi === i ? "primary" : ""}" data-a="gOpen" data-i="${i}">${t("books")} · ${gr.books.length}</button>
    <button class="iconbtn sm" data-a="gDel" data-i="${i}" aria-label="${t("delete")}">${ICON.x}</button>
    ${m.gi === i ? `<div class="full-row"><div class="row">${gr.books.map((pid) => `<span class="pill">${esc((S.byId.get(pid) || {}).name || "?")}<button class="pill-x" data-a="gUnlink" data-id="${pid}">×</button></span>`).join("")}</div>
      <input class="input" id="gQ" type="search" autocomplete="off" placeholder="${t("linkBook")}" value="${esc(m.q)}" data-in="gQ">
      ${res.length ? `<div class="results">${res.map((p) => `<button data-a="gLink" data-id="${p.id}"><span class="grow">${esc(p.name)}</span><span class="muted">${catName(p.category)}</span></button>`).join("")}</div>` : ""}</div>` : ""}
  </div>`).join("")}</div>
  <div class="row"><button class="btn sm" data-a="gAdd">${ICON.plus}${t("addGrade")}</button></div>
  <div class="sheet-f">${m.id ? `<button class="btn danger" data-a="schDel">${m.confirm ? t("confirmDelete") : t("delete")}</button>` : ""}<span class="grow"></span>
    <button class="btn" data-a="closeModal">${t("cancel")}</button><button class="btn primary" data-a="schSave">${t("save")}</button></div>`;
}
onInput("gField", (el) => { M.current.grades[+el.dataset.i][el.dataset.k] = el.value; });
onInput("gQ", (el) => { M.current.q = el.value; renderModal(); });
on("schNew", () => schModal(null));
on("schOpen", (el) => schModal(SC.list.find((s) => s.id === el.dataset.id)));
on("gAdd", () => { const m = M.current; m.grades.push({ name: "", students: "", books: [] }); m.gi = m.grades.length - 1; m.q = ""; renderModal(); });
on("gDel", (el) => { const m = M.current; m.grades.splice(+el.dataset.i, 1); m.gi = null; renderModal(); });
on("gOpen", (el) => { const m = M.current, i = +el.dataset.i; m.gi = m.gi === i ? null : i; m.q = ""; renderModal(); });
on("gLink", (el) => { const m = M.current, g = m.grades[m.gi]; if (!g.books.includes(el.dataset.id)) g.books.push(el.dataset.id); m.q = ""; renderModal(); });
on("gUnlink", (el) => { const m = M.current, g = m.grades[m.gi]; g.books = g.books.filter((x) => x !== el.dataset.id); renderModal(); });
on("schSave", async (el) => { const m = M.current; if (!String(m.d.name).trim()) return; el.disabled = true;
  try { await core.saveSchool(m.id, String(m.d.name).trim(), m.grades); SC.list = await core.loadSchools(); closeModal(); toast(t("saved")); rerender(); } finally { el.disabled = false; } });
on("schDel", async () => { const m = M.current; if (!confirmTwice(m, "confirm")) return; await core.deleteSchool(m.id); SC.list = await core.loadSchools(); closeModal(); rerender(); });

/* ---------------- team ---------------- */
view("team", {
  load: () => core.loadTeam(),
  render() {
    return `<section class="card"><div class="card-h"><h2>${t("team")}</h2><button class="btn primary sm" data-a="memNew">${ICON.plus}${t("addEmployee")}</button></div>
      <div class="list">${S.team.map((p) => `<button class="li" data-a="memOpen" data-id="${p.id}"><span class="main"><b>${esc(p.full_name || "—")}${p.id === S.user.id ? ` <small class="muted">(${t("you")})</small>` : ""}</b><small class="mono">${esc(p.username || "")}</small></span>
        <span class="pill ${p.role === "owner" ? "strong" : p.role === "staff" ? "ok" : ""}">${t("role_" + p.role)}</span>${p.active ? "" : `<span class="pill">${t("hidden")}</span>`}</button>`).join("")}</div></section>`;
  },
});
on("memNew", () => openModal({ d: { full_name: "", username: "", password: "", role: "staff" }, render: (m) => sheetHead(t("addEmployee")) + `
  <p class="muted small">${t("employeeHint")}</p>
  <div class="fgrid"><div class="field full"><label for="mN">${t("fullName")}</label><input class="input" id="mN" autofocus value="${esc(m.d.full_name)}" data-in="mField" data-k="full_name"></div>
  <div class="field"><label for="mU">${t("username")}</label><input class="input mono" id="mU" autocapitalize="none" autocomplete="off" value="${esc(m.d.username)}" data-in="mField" data-k="username"><small class="muted">${t("usernameRule")}</small></div>
  <div class="field"><label for="mP">${t("password")}</label><input class="input mono" id="mP" autocomplete="new-password" value="${esc(m.d.password)}" data-in="mField" data-k="password"><small class="muted">${t("pwdShort")}</small></div>
  <div class="field"><label for="mR">${t("role")}</label><select class="input" id="mR" data-ch="mField" data-k="role"><option value="staff" ${m.d.role === "staff" ? "selected" : ""}>${t("role_staff")}</option><option value="owner" ${m.d.role === "owner" ? "selected" : ""}>${t("role_owner")}</option></select></div></div>
  <div class="sheet-f"><button class="btn" data-a="closeModal">${t("cancel")}</button><button class="btn primary" data-a="memCreate">${t("createAccount")}</button></div>` }));
on("memCreate", async (el) => {
  const d = M.current.d, u = String(d.username).trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,}$/.test(u)) return toast(t("usernameRule"));
  if (String(d.password).length < 8) return toast(t("pwdShort"));
  if (!String(d.full_name).trim()) return document.getElementById("mN")?.focus();
  el.disabled = true;
  try { await core.createMember(u, d.password, String(d.full_name).trim(), d.role); await core.loadTeam(); closeModal(); toast(t("accountCreated") + ": " + u); rerender(); }
  finally { el.disabled = false; }
});
on("memOpen", (el) => {
  const p = S.team.find((x) => x.id === el.dataset.id); if (!p) return;
  const self = p.id === S.user.id;
  openModal({ id: p.id, d: { ...p }, render: (m) => sheetHead(esc(m.d.full_name || m.d.username || "")) + `
    <div class="fgrid"><div class="field full"><label for="eN">${t("fullName")}</label><input class="input" id="eN" value="${esc(m.d.full_name)}" data-in="mField" data-k="full_name"></div>
    <div class="field"><label for="eR">${t("role")}</label><select class="input" id="eR" data-ch="mField" data-k="role" ${self ? "disabled" : ""}>${["staff", "owner", "pending"].map((r) => `<option value="${r}" ${m.d.role === r ? "selected" : ""}>${t("role_" + r)}</option>`).join("")}</select></div>
    <label class="check"><input type="checkbox" data-ch="mField" data-k="active" ${m.d.active ? "checked" : ""} ${self ? "disabled" : ""}> ${t("active")}</label></div>
    <div class="sheet-f"><button class="btn" data-a="closeModal">${t("cancel")}</button><button class="btn primary" data-a="memSave">${t("save")}</button></div>` });
});
on("memSave", async () => { const m = M.current; await core.setMember(m.id, m.d.role, !!m.d.active, m.d.full_name); await core.loadTeam(); closeModal(); toast(t("saved")); rerender(); });

/* ---------------- settings ---------------- */
const ST = { d: null };
view("settings", {
  load: async () => { await core.loadSettings(); ST.d = { ...S.settings.shop, rate: S.settings.rate, book_share: S.settings.book_share }; },
  render() {
    const d = ST.d;
    return `<section class="card"><h2>${t("settings")}</h2><div class="fgrid">
      <div class="field full"><label for="stN">${t("shopName")}</label><input class="input" id="stN" value="${esc(d.name)}" data-in="stField" data-k="name"></div>
      <div class="field"><label for="stA">${t("address")}</label><input class="input" id="stA" value="${esc(d.address)}" data-in="stField" data-k="address"></div>
      <div class="field"><label for="stP">${t("phone")}</label><input class="input" id="stP" value="${esc(d.phone)}" data-in="stField" data-k="phone"></div>
      <div class="field full"><label for="stF">${t("footer")}</label><input class="input" id="stF" value="${esc(d.footer)}" data-in="stField" data-k="footer"></div>
      <div class="field"><label for="stR">${t("rate")}</label><input class="input num" id="stR" inputmode="numeric" value="${esc(d.rate)}" data-in="stField" data-k="rate"></div>
      <div class="field"><label for="stB">${t("bookShare")}</label><input class="input num" id="stB" inputmode="numeric" value="${esc(d.book_share)}" data-in="stField" data-k="book_share"></div>
      </div><div class="row"><button class="btn primary" data-a="stSave">${t("save")}</button></div></section>`;
  },
});
onInput("stField", (el) => { ST.d[el.dataset.k] = el.value; });
on("stSave", async () => {
  const d = ST.d;
  await core.saveSetting("shop", { name: String(d.name).trim() || "Librairie Samir Shoker", address: d.address || "", phone: d.phone || "", footer: d.footer || "" });
  await core.saveSetting("rate", num(d.rate) || 89500);
  await core.saveSetting("book_share", Math.min(Math.max(num(d.book_share), 0), 100));
  toast(t("saved")); rerender();
});

/* ---------------- more ---------------- */
export const MORE = ["customers", "receipts", "reports", "orders", "suppliers", "schools", "team", "settings"];
view("more", {
  render() {
    return `<section class="card"><h2>${t("more")}</h2><div class="moregrid">${MORE.map((k) => `<a class="morebtn" href="#${k}">${ICON[k] || ""}<span>${t(k)}</span></a>`).join("")}</div></section>`;
  },
});
