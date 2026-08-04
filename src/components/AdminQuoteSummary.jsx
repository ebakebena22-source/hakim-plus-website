import { Link } from "react-router-dom";
import { formatMinorAmount } from "../quotes/quoteSchema";

function formatDate(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status) {
  return String(status || "draft").replaceAll("_", " ");
}

export default function AdminQuoteSummary({ quote, requestId, locked, busy, onDelete }) {
  return <section className="rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-700">Pharmacy quote</p>
        <h2 className="mt-2 text-xl font-bold">{quote.quoteNumber || "Generated quote"}</h2>
        <p className="mt-2 text-sm text-slate-500">Updated {formatDate(quote.updatedAt || quote.sentAt || quote.createdAt)}</p>
      </div>
      <span className="self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-800">{statusLabel(quote.status)}</span>
    </div>

    <div className="mt-6 space-y-3">
      {(quote.items || []).map((item, index) => <article key={item.id || `${item.medicationName}-${index}`} className="rounded-2xl bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold">{item.medicationName}</h3>
            <p className="mt-1 text-sm text-slate-600">{[item.strength, item.dosageForm, item.quotedQuantity ? `Qty ${item.quotedQuantity} ${item.unitLabel || "item"}` : ""].filter(Boolean).join(" · ")}</p>
            <p className="mt-2 text-xs font-bold capitalize text-emerald-700">{statusLabel(item.availability)}</p>
          </div>
          <p className="shrink-0 font-bold">{formatMinorAmount(item.lineTotalMinor, quote.currency)}</p>
        </div>
        {item.pharmacyNote && <p className="mt-3 text-sm text-slate-600">{item.pharmacyNote}</p>}
      </article>)}
    </div>

    <dl className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-sm">
      <div className="flex justify-between gap-4"><dt className="text-slate-500">Items subtotal</dt><dd className="font-bold">{formatMinorAmount(quote.subtotalMinor, quote.currency)}</dd></div>
      <div className="flex justify-between gap-4"><dt className="text-slate-500">Delivery fee</dt><dd>{formatMinorAmount(quote.deliveryFeeMinor, quote.currency)}</dd></div>
      <div className="flex justify-between gap-4"><dt className="text-slate-500">Service fee</dt><dd>{formatMinorAmount(quote.serviceFeeMinor, quote.currency)}</dd></div>
      <div className="flex justify-between gap-4"><dt className="text-slate-500">Tax</dt><dd>{formatMinorAmount(quote.taxMinor, quote.currency)}</dd></div>
      <div className="flex justify-between gap-4 text-emerald-700"><dt>Discount</dt><dd>-{formatMinorAmount(quote.discountMinor, quote.currency)}</dd></div>
      <div className="flex justify-between gap-4 border-t border-slate-200 pt-4 text-lg"><dt className="font-bold">Quote total</dt><dd className="font-extrabold">{formatMinorAmount(quote.grandTotalMinor, quote.currency)}</dd></div>
    </dl>

    <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
      <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Valid until</p><p className="mt-2 font-semibold">{formatDate(quote.expiresAt)}</p></div>
      <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Currency</p><p className="mt-2 font-semibold">{quote.currency}</p></div>
    </div>
    {quote.pharmacyNotes && <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950"><strong className="block">Pharmacy note</strong><p className="mt-2 whitespace-pre-wrap">{quote.pharmacyNotes}</p></div>}

    {quote.bankTransfer && <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-amber-800">Bank transfer receipt</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-bold text-amber-950">{quote.bankTransfer.transferNumber}</p><p className="mt-1 text-sm capitalize text-amber-900">{quote.bankTransfer.statusLabel || statusLabel(quote.bankTransfer.status)}</p></div>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-900 px-4 text-sm font-bold text-white" to={`/admin/bank-transfers/${encodeURIComponent(quote.bankTransfer.id)}`}>{quote.bankTransfer.status === "pending" ? "Review bank transfer" : "View bank transfer"}</Link>
      </div>
    </div>}

    {locked ? <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">This quote is locked because payment or fulfillment has started.</p> : <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
      <Link className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white" to={`/admin/requests/${encodeURIComponent(requestId)}/quote`}>Edit quote</Link>
      <button className="min-h-11 flex-1 rounded-xl border border-red-300 px-4 text-sm font-bold text-red-700" type="button" disabled={busy} onClick={onDelete}>{busy ? "Deleting…" : "Delete quote"}</button>
    </div>}
  </section>;
}
