// Data layer: Supabase client, login, and every read/write the apps make.
import { createClient } from "./vendor/supabase.js"; // @supabase/supabase-js 2.45.4
import { SUPABASE_URL, SUPABASE_ANON_KEY, USERNAME_DOMAIN, SHOP_TZ } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "ls-auth" },
});

export const S = {
  mode: "staff",            // "staff" | "owner" (which app is running)
  user: null, profile: null,
  settings: { shop: { name: "Librairie Samir Shoker", address: "", phone: "", footer: "" }, rate: 89500, book_share: 60 },
  products: [], byId: new Map(), productsAt: 0,
  privateById: new Map(),   // owner app only: cost + supplier
  suppliers: [], customers: [], balances: new Map(), team: [],
};
export const isOwner = () => S.profile?.role === "owner" && S.profile?.active;

/* ---------------- helpers ---------------- */
export const num = (v) => { const n = parseFloat(String(v ?? "").replace(/,/g, "").replace(/\s/g, "")); return Number.isFinite(n) ? n : 0; };
export const round2 = (v) => Math.round(num(v) * 100) / 100;
export const usd = (v) => "$" + round2(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const toLL = (v, rate) => Math.round(num(v) * (rate ?? S.settings.rate) / 1000) * 1000;
export const fmtLL = (v, unit) => Math.round(num(v)).toLocaleString("en-US") + " " + (unit || "LL");
export function todayISO(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function tzOffsetMin(date) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TZ, timeZoneName: "longOffset" }).formatToParts(date).find((p) => p.type === "timeZoneName");
  const m = part && part.value.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  return m ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : 0;
}
// Midnight in the shop's time zone, as a UTC timestamp.
export function dayStartUTC(iso) {
  const guess = new Date(iso + "T00:00:00Z");
  return new Date(guess.getTime() - tzOffsetMin(guess) * 60000).toISOString();
}
export function addDays(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function check(res) { if (res.error) throw res.error; return res.data; }

/* ---------------- auth ---------------- */
export function toEmail(login) {
  login = String(login || "").trim().toLowerCase();
  return login.includes("@") ? login : `${login}@${USERNAME_DOMAIN}`;
}
export async function signIn(login, password) {
  const { error } = await sb.auth.signInWithPassword({ email: toEmail(login), password });
  if (error) throw error;
  return loadSession();
}
export async function signOut() { await sb.auth.signOut(); S.user = null; S.profile = null; }
export async function loadSession() {
  const { data } = await sb.auth.getSession();
  S.user = data.session?.user || null;
  if (!S.user) { S.profile = null; return null; }
  S.profile = check(await sb.from("profiles").select("*").eq("id", S.user.id).maybeSingle());
  return S.profile;
}
// First owner: create an account, then claim ownership (works only while no owner exists).
export async function signUpOwner(email, password, fullName) {
  const { data, error } = await sb.auth.signUp({ email: toEmail(email), password, options: { data: { full_name: fullName } } });
  if (error) throw error;
  if (!data.session) await sb.auth.signInWithPassword({ email: toEmail(email), password });
  await sb.rpc("claim_owner");
  return loadSession();
}
// Owners create employee accounts without logging themselves out.
export async function createMember(username, password, fullName, role) {
  const tmp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "ls-tmp" } });
  const { data, error } = await tmp.auth.signUp({ email: toEmail(username), password, options: { data: { full_name: fullName, username } } });
  if (error) throw error;
  const id = data.user?.id;
  if (!id) throw new Error("no user");
  check(await sb.rpc("set_member", { p_user: id, p_role: role, p_active: true, p_full_name: fullName }));
  return id;
}
export async function setMember(id, role, active, fullName) {
  check(await sb.rpc("set_member", { p_user: id, p_role: role, p_active: active, p_full_name: fullName || "" }));
}

/* ---------------- settings ---------------- */
export async function loadSettings() {
  const rows = check(await sb.from("settings").select("key,value"));
  for (const r of rows) {
    if (r.key === "shop") S.settings.shop = { ...S.settings.shop, ...r.value };
    else if (r.key === "rate") S.settings.rate = num(r.value) || 89500;
    else if (r.key === "book_share") S.settings.book_share = num(r.value);
  }
}
export async function saveSetting(key, value) {
  check(await sb.from("settings").upsert({ key, value }));
  await loadSettings();
}

/* ---------------- products ---------------- */
const PRODUCT_COLS = "id,name,barcode,category,kind,price_usd,qty,min_qty,active,updated_at";
export async function loadProducts(force) {
  if (!force && Date.now() - S.productsAt < 20000 && S.products.length) return S.products;
  const all = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(await sb.from("products").select(PRODUCT_COLS).order("name").range(from, from + 999));
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  S.products = all; S.byId = new Map(all.map((p) => [p.id, p])); S.productsAt = Date.now();
  if (S.mode === "owner" && isOwner()) {
    const priv = [];
    for (let from = 0; ; from += 1000) {
      const rows = check(await sb.from("product_private").select("product_id,cost_usd,supplier_id,notes").range(from, from + 999));
      priv.push(...rows);
      if (rows.length < 1000) break;
    }
    S.privateById = new Map(priv.map((r) => [r.product_id, r]));
  }
  return all;
}
export const isLow = (p) => p.kind === "item" && p.active && (num(p.qty) <= 0 || (num(p.min_qty) > 0 && num(p.qty) <= num(p.min_qty)));
export const findBarcode = (code) => { code = String(code || "").trim(); return code ? S.products.find((p) => (p.barcode || "") === code) : null; };
export function searchProducts(q, limit = 8, opts = {}) {
  q = String(q || "").trim().toLowerCase(); if (!q) return [];
  const out = [];
  for (const p of S.products) {
    if (!opts.includeHidden && !p.active) continue;
    if (p.name.toLowerCase().includes(q) || (p.barcode || "").startsWith(q)) { out.push(p); if (out.length >= limit) break; }
  }
  return out;
}
export async function saveProduct(id, fields, priv) {
  const row = {
    name: String(fields.name).trim(), barcode: String(fields.barcode || "").trim() || null,
    category: fields.category || "other", kind: fields.kind || "item",
    price_usd: round2(fields.price_usd), min_qty: num(fields.min_qty),
  };
  if (fields.active !== undefined) row.active = !!fields.active;
  let pid = id;
  if (id) {
    const before = S.byId.get(id);
    if (!isOwner() && before && num(before.price_usd) === row.price_usd) delete row.price_usd;
    check(await sb.from("products").update(row).eq("id", id));
  } else {
    row.qty = num(fields.qty);
    pid = check(await sb.from("products").insert(row).select("id").single()).id;
  }
  if (priv && isOwner()) {
    check(await sb.from("product_private").upsert({ product_id: pid, cost_usd: round2(priv.cost_usd), supplier_id: priv.supplier_id || null }));
  }
  await loadProducts(true);
  return pid;
}
// Owner bulk import: creates products whose barcode (or name, when there is no barcode) isn't already in the catalogue.
export async function importProducts(items) {
  await loadProducts(true);
  const haveBc = new Set(S.products.map((p) => p.barcode).filter(Boolean)), haveName = new Set(S.products.map((p) => p.name.toLowerCase()));
  const supByName = new Map(S.suppliers.map((s) => [s.name.toLowerCase(), s.id]));
  const fresh = []; let skipped = 0; const seen = new Set();
  for (const it of items) {
    const key = it.barcode || "n:" + it.name.toLowerCase();
    if ((it.barcode && haveBc.has(it.barcode)) || (!it.barcode && haveName.has(it.name.toLowerCase())) || seen.has(key)) { skipped++; continue; }
    seen.add(key); fresh.push(it);
  }
  for (let i = 0; i < fresh.length; i += 300) {
    const chunk = fresh.slice(i, i + 300);
    const made = check(await sb.from("products").insert(chunk.map((it) => ({ name: it.name, barcode: it.barcode || null, category: it.category,
      kind: it.category === "services" ? "service" : "item", price_usd: round2(it.price_usd), qty: num(it.qty), min_qty: num(it.min_qty) }))).select("id,barcode,name"));
    const priv = made.map((m, j) => ({ product_id: m.id, cost_usd: round2(chunk[j].cost_usd), supplier_id: supByName.get(String(chunk[j].supplier || "").toLowerCase()) || null }))
      .filter((r) => r.cost_usd > 0 || r.supplier_id);
    if (priv.length) check(await sb.from("product_private").upsert(priv));
  }
  await loadProducts(true);
  return { created: fresh.length, skipped };
}
export async function deleteProduct(id) { check(await sb.from("products").delete().eq("id", id)); await loadProducts(true); }
export async function adjustStock(id, mode, qty, note) {
  const q = check(await sb.rpc("adjust_stock", { p_product: id, p_mode: mode, p_qty: num(qty), p_note: note || "" }));
  const p = S.byId.get(id); if (p) p.qty = q;
  return q;
}
export async function stockHistory(id) {
  return check(await sb.from("stock_movements").select("delta,qty_after,reason,note,user_id,created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(30));
}

/* ---------------- customers ---------------- */
export async function loadCustomers() {
  S.customers = check(await sb.from("customers").select("id,name,phone,notes,created_at").order("name").limit(5000));
  const bal = check(await sb.rpc("customer_balances"));
  S.balances = new Map(bal.map((b) => [b.customer_id, num(b.balance)]));
  return S.customers;
}
export async function saveCustomer(id, f) {
  const row = { name: String(f.name).trim(), phone: String(f.phone || "").trim(), notes: String(f.notes || "") };
  const r = id ? check(await sb.from("customers").update(row).eq("id", id).select().single())
               : check(await sb.from("customers").insert(row).select().single());
  await loadCustomers();
  return r;
}
export async function addPayment(customerId, amount, note) {
  check(await sb.from("customer_payments").insert({ customer_id: customerId, amount_usd: round2(amount), note: note || "", received_by: S.user.id }));
  await loadCustomers();
}
export function searchCustomers(q, limit = 6) {
  q = String(q || "").trim().toLowerCase(); if (!q) return [];
  return S.customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone || "").replace(/\s/g, "").includes(q.replace(/\s/g, ""))).slice(0, limit);
}

/* ---------------- sales ---------------- */
export async function createSale(payload) {
  const r = check(await sb.rpc("create_sale", { p: payload }));
  await loadProducts(true);
  return r;
}
export async function loadSale(id) {
  const sale = check(await sb.from("sales").select("*").eq("id", id).single());
  const lines = check(await sb.from("sale_lines").select("id,product_id,name,qty,unit_price").eq("sale_id", id));
  let customer = null;
  if (sale.customer_id) customer = check(await sb.from("customers").select("id,name,phone").eq("id", sale.customer_id).maybeSingle());
  return { sale, lines, customer, sellerName: teamName(sale.seller_id) };
}
export async function listSales({ from, to, limit = 200, customerId } = {}) {
  let q = sb.from("sales").select("id,receipt_no,created_at,seller_id,customer_id,total_usd,on_account,voided,repair_id").order("created_at", { ascending: false }).limit(limit);
  if (from) q = q.gte("created_at", dayStartUTC(from));
  if (to) q = q.lt("created_at", dayStartUTC(addDays(to, 1)));
  if (customerId) q = q.eq("customer_id", customerId);
  return check(await q);
}
export async function voidSale(id) { check(await sb.rpc("void_sale", { p_sale: id })); await loadProducts(true); }

/* ---------------- team ---------------- */
export async function loadTeam() { S.team = check(await sb.from("profiles").select("id,full_name,username,role,active,created_at").order("created_at")); return S.team; }
export const teamName = (id) => (S.team.find((p) => p.id === id) || {}).full_name || "";

/* ---------------- repairs ---------------- */
export async function listRepairs() {
  return check(await sb.from("repairs").select("*, repair_parts(id,product_id,name,qty,unit_price)").order("created_at", { ascending: false }).limit(300));
}
export async function saveRepair(id, f, parts) {
  const row = { customer_id: f.customer_id || null, bike: f.bike || "", problem: f.problem || "", status: f.status || "received",
    labour_usd: round2(f.labour_usd), notes: f.notes || "", updated_at: new Date().toISOString() };
  if (f.status === "ready" && !f.ready_at) row.ready_at = new Date().toISOString();
  const r = id ? check(await sb.from("repairs").update(row).eq("id", id).select().single())
               : check(await sb.from("repairs").insert(row).select().single());
  if (parts) {
    check(await sb.from("repair_parts").delete().eq("repair_id", r.id));
    if (parts.length) check(await sb.from("repair_parts").insert(parts.map((p) => ({ repair_id: r.id, product_id: p.product_id || null, name: p.name, qty: num(p.qty) || 1, unit_price: round2(p.unit_price) }))));
  }
  return r;
}

/* ---------------- owner: suppliers, orders, reports, schools ---------------- */
export async function loadSuppliers() { S.suppliers = check(await sb.from("suppliers").select("*").order("name")); return S.suppliers; }
export async function saveSupplier(id, f) {
  const row = { name: String(f.name).trim(), phone: f.phone || "", city: f.city || "", notes: f.notes || "" };
  if (id) check(await sb.from("suppliers").update(row).eq("id", id)); else check(await sb.from("suppliers").insert(row));
  return loadSuppliers();
}
export async function deleteSupplier(id) { check(await sb.from("suppliers").delete().eq("id", id)); return loadSuppliers(); }
export async function listOrders() {
  return check(await sb.from("purchase_orders").select("*, purchase_order_lines(id,product_id,name,qty,unit_cost)").order("created_at", { ascending: false }).limit(200));
}
export async function saveOrder(id, f, lines) {
  const row = { supplier_id: f.supplier_id || null, note: f.note || "", status: f.status || "ordered" };
  const o = id ? check(await sb.from("purchase_orders").update(row).eq("id", id).select().single())
               : check(await sb.from("purchase_orders").insert(row).select().single());
  check(await sb.from("purchase_order_lines").delete().eq("po_id", o.id));
  if (lines.length) check(await sb.from("purchase_order_lines").insert(lines.map((l) => ({ po_id: o.id, product_id: l.product_id, name: l.name, qty: num(l.qty) || 1, unit_cost: round2(l.unit_cost) }))));
  return o;
}
export async function deleteOrder(id) { check(await sb.from("purchase_orders").delete().eq("id", id)); }
export async function receiveOrder(id) { check(await sb.rpc("receive_po", { p_po: id })); await loadProducts(true); }
export async function reports(from, to) {
  const [daily, products, sellers] = await Promise.all([
    sb.rpc("report_daily", { p_from: from, p_to: to }),
    sb.rpc("report_products", { p_from: from, p_to: to }),
    sb.rpc("report_sellers", { p_from: from, p_to: to }),
  ]);
  return { daily: check(daily), products: check(products), sellers: check(sellers) };
}
export async function stockValue() { return num(check(await sb.rpc("stock_value"))); }
export async function loadSchools() {
  return check(await sb.from("schools").select("id,name, school_grades(id,name,students,sort, grade_books(product_id))").order("name"));
}
export async function saveSchool(id, name, grades) {
  const s = id ? check(await sb.from("schools").update({ name }).eq("id", id).select().single())
               : check(await sb.from("schools").insert({ name }).select().single());
  check(await sb.from("school_grades").delete().eq("school_id", s.id));
  for (const [i, g] of grades.entries()) {
    const gr = check(await sb.from("school_grades").insert({ school_id: s.id, name: g.name || "", students: Math.max(0, Math.round(num(g.students))), sort: i }).select("id").single());
    if (g.books.length) check(await sb.from("grade_books").insert(g.books.map((pid) => ({ grade_id: gr.id, product_id: pid }))));
  }
  return s;
}
export async function deleteSchool(id) { check(await sb.from("schools").delete().eq("id", id)); }

/* ---------------- CSV ---------------- */
export function toCsv(rows) {
  const cell = (v) => { v = String(v ?? ""); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
export function downloadText(filename, text, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
