// Receipts and repair tickets as 80 mm PDFs (the width of a till receipt).
import { t, getLang } from "./i18n.js";
import { S, usd, toLL, fmtLL, num } from "./core.js";
import { esc, loadScript, toast } from "./ui.js";

const LIB = new URL("./vendor/html2pdf.bundle.min.js", import.meta.url).href; // html2pdf.js 0.10.2
const W = 302; // px ≈ 80 mm

function stamp(ts) {
  const d = new Date(ts);
  return d.toLocaleString("en-GB", { timeZone: "Asia/Beirut", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function head() {
  const sh = S.settings.shop;
  return `<div class="r-c"><div class="r-shop">${esc(sh.name)}</div>${sh.address ? `<div>${esc(sh.address)}</div>` : ""}${sh.phone ? `<div>${esc(sh.phone)}</div>` : ""}</div><div class="r-rule"></div>`;
}
const CSS = `
.r{width:${W}px;padding:14px 12px;background:#fff;color:#111;font:12px/1.45 "IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif}
.r-c{text-align:center}.r-shop{font-size:16px;font-weight:700}.r-rule{border-top:1px dashed #555;margin:8px 0}
.r-row{display:flex;justify-content:space-between;gap:8px}.r-b{font-weight:700}.r-big{font-size:16px;font-weight:700}
.r-ln{margin-bottom:4px}.r-ln .r-row span:first-child{color:#444}.r-muted{color:#555;font-size:11px}`;

export function receiptHTML({ sale, lines, customer, sellerName }) {
  const unit = t("ll"), rate = num(sale.rate) || S.settings.rate;
  const paid = num(sale.paid_usd) + num(sale.paid_lbp) / rate;
  const change = Math.max(paid - num(sale.total_usd), 0);
  const dir = getLang() === "ar" ? "rtl" : "ltr";
  return `<div class="r" dir="${dir}"><style>${CSS}</style>${head()}
  <div class="r-row"><span>${t("receiptNo")} #${sale.receipt_no}</span><span>${stamp(sale.created_at)}</span></div>
  ${sellerName ? `<div class="r-muted">${t("seller")}: ${esc(sellerName)}</div>` : ""}
  ${customer ? `<div>${t("customer")}: ${esc(customer.name)}${customer.phone ? " · " + esc(customer.phone) : ""}</div>` : ""}
  ${sale.voided ? `<div class="r-b r-c">${t("voided").toUpperCase()}</div>` : ""}
  <div class="r-rule"></div>
  ${lines.map((l) => `<div class="r-ln"><div>${esc(l.name)}</div><div class="r-row"><span>${num(l.qty)} × ${usd(l.unit_price)}</span><span>${usd(num(l.qty) * num(l.unit_price))}</span></div></div>`).join("")}
  <div class="r-rule"></div>
  <div class="r-row"><span>${t("subtotal")}</span><span>${usd(sale.subtotal)}</span></div>
  ${num(sale.discount) ? `<div class="r-row"><span>${t("discount")}</span><span>−${usd(sale.discount)}</span></div>` : ""}
  <div class="r-row r-big"><span>${t("total")}</span><span>${usd(sale.total_usd)}</span></div>
  <div class="r-row"><span></span><span>${fmtLL(toLL(sale.total_usd, rate), unit)}</span></div>
  <div class="r-muted">$1 = ${fmtLL(rate, unit)}</div>
  ${num(sale.paid_usd) ? `<div class="r-row"><span>${t("paidUsd")}</span><span>${usd(sale.paid_usd)}</span></div>` : ""}
  ${num(sale.paid_lbp) ? `<div class="r-row"><span>${t("paidLbp")}</span><span>${fmtLL(sale.paid_lbp, unit)}</span></div>` : ""}
  ${change > 0.004 && !num(sale.on_account) ? `<div class="r-row"><span>${t("change")}</span><span>${fmtLL(toLL(change, rate), unit)}</span></div>` : ""}
  ${num(sale.on_account) ? `<div class="r-row r-b"><span>${t("balance")}</span><span>${usd(sale.on_account)}</span></div>` : ""}
  <div class="r-rule"></div><div class="r-c">${esc(S.settings.shop.footer || "")}</div></div>`;
}

export function ticketHTML(job, customer) {
  const dir = getLang() === "ar" ? "rtl" : "ltr";
  const parts = job.repair_parts || [];
  const est = num(job.labour_usd) + parts.reduce((a, p) => a + num(p.qty) * num(p.unit_price), 0);
  return `<div class="r" dir="${dir}"><style>${CSS}</style>${head()}
  <div class="r-c r-big">${t("ticket")} #${job.job_no}</div>
  <div class="r-c">${stamp(job.created_at)}</div><div class="r-rule"></div>
  ${customer ? `<div>${t("customer")}: ${esc(customer.name)}${customer.phone ? " · " + esc(customer.phone) : ""}</div>` : ""}
  <div>${t("bike")}: ${esc(job.bike)}</div><div>${t("problem")}: ${esc(job.problem)}</div>
  ${est ? `<div class="r-rule"></div><div class="r-row r-b"><span>${t("estimate")}</span><span>${usd(est)}</span></div>` : ""}
  <div class="r-rule"></div><div class="r-c">${esc(S.settings.shop.footer || "")}</div></div>`;
}

// Build the PDF; share it (WhatsApp etc.) where the phone allows, otherwise download.
export async function exportPdf(html, filename) {
  await loadScript(LIB);
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;left:-10000px;top:0;background:#fff";
  box.innerHTML = html;
  document.body.appendChild(box);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const el = box.firstElementChild;
    const hmm = Math.ceil((el.offsetHeight * 80) / W) + 4;
    const worker = window.html2pdf().set({
      margin: 0, filename, image: { type: "jpeg", quality: 0.96 },
      html2canvas: { scale: 2.5, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: [80, hmm], orientation: "portrait" },
    }).from(el);
    const blob = await worker.outputPdf("blob");
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return; } catch (e) { if (e?.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  } catch (e) {
    console.error(e); toast(t("errSave"));
  } finally { box.remove(); }
}
