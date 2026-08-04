import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminTransfersApi } from "../api/payments";
import { formatMinorAmount } from "../quotes/quoteSchema";

function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not provided";
}

export default function AdminTransfersPage() {
  const [filter, setFilter] = useState("pending");
  const [state, setState] = useState({ status: "loading", transfers: [], error: "", message: "" });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: "", message: "" }));
    try {
      const result = await adminTransfersApi.list(filter);
      setState({ status: "ready", transfers: result.transfers || [], error: "", message: "" });
    } catch (error) { setState({ status: "error", transfers: [], error: error.message, message: "" }); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function approve(transfer) {
    if (!window.confirm(`Confirm that ${formatMinorAmount(transfer.amountMinor, transfer.currency)} was received? This creates the fulfillment order. The combined payment-confirmed/order-dispatched email will be sent when the order is dispatched.`)) return;
    try { await adminTransfersApi.approve(transfer.id); setState((current) => ({ ...current, message: "Transfer approved and fulfillment order created." })); await load(); }
    catch (error) { setState((current) => ({ ...current, error: error.message })); }
  }

  async function reject(transfer) {
    const reason = window.prompt("Why is this transfer being rejected? The customer will see this reason.");
    if (!reason?.trim()) return;
    if (!window.confirm("Reject this transfer and email the reason to the customer?")) return;
    try { await adminTransfersApi.reject(transfer.id, reason.trim()); setState((current) => ({ ...current, message: "Transfer rejected and the customer was notified in the portal." })); await load(); }
    catch (error) { setState((current) => ({ ...current, error: error.message })); }
  }

  return <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10"><div><p className="text-sm font-bold text-emerald-700">Payment operations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Bank transfer receipts</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Compare the receipt with the Commercial Bank of Ethiopia account activity. Approve only after the exact amount and currency are received.</p></div><div className="mt-7 flex flex-wrap gap-2">{[["pending","Awaiting review"],["approved","Approved"],["rejected","Rejected"],["all","All"]].map(([value,label]) => <button key={value} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === value ? "bg-slate-950 text-white" : "bg-white text-slate-600"}`} type="button" onClick={() => setFilter(value)}>{label}</button>)}</div>{state.error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{state.error}</div>}{state.message && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900" role="status">{state.message}</div>}{state.status === "loading" && <p className="mt-8 text-sm font-semibold text-slate-600" role="status">Loading private receipts…</p>}{state.status === "ready" && state.transfers.length === 0 && <section className="mt-8 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-bold">No transfers in this queue</h2></section>}{state.status === "ready" && state.transfers.length > 0 && <section className="mt-8 space-y-4">{state.transfers.map((transfer) => <article key={transfer.id} className="rounded-[2rem] border border-slate-200 bg-white p-6"><div className="grid gap-6 lg:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{transfer.transferNumber}</p><span className={`rounded-full px-3 py-1 text-xs font-bold ${transfer.status === "approved" ? "bg-emerald-50 text-emerald-800" : transfer.status === "rejected" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>{transfer.statusLabel}</span></div><h2 className="mt-3 text-xl font-bold">{formatMinorAmount(transfer.amountMinor, transfer.currency)}</h2><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Customer</dt><dd className="mt-1 font-bold">{transfer.customerName} · {transfer.customerEmail}</dd></div><div><dt className="text-slate-500">Beneficiary</dt><dd className="mt-1 font-bold">{transfer.beneficiaryName}</dd></div><div><dt className="text-slate-500">Request</dt><dd className="mt-1 font-bold">{transfer.requestNumber}</dd></div><div><dt className="text-slate-500">Bank reference</dt><dd className="mt-1 font-bold">{transfer.transferReference || "Not provided"}</dd></div><div><dt className="text-slate-500">Customer transfer date</dt><dd className="mt-1 font-bold">{transfer.transferDate || "Not provided"}</dd></div><div><dt className="text-slate-500">Submitted</dt><dd className="mt-1 font-bold">{formatDate(transfer.createdAt)}</dd></div></dl>{transfer.rejectionReason && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{transfer.rejectionReason}</p>}</div><div className="flex min-w-48 flex-col gap-3"><a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700" href={adminTransfersApi.receiptUrl(transfer.id)} target="_blank" rel="noreferrer">View private receipt</a>{transfer.status === "pending" && <><button className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white" type="button" onClick={() => approve(transfer)}>Approve transfer</button><button className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700" type="button" onClick={() => reject(transfer)}>Reject</button></>}</div></div></article>)}</section>}</main>;
}

export function AdminTransferDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState({ status: "loading", transfer: null, error: "", message: "" });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const result = await adminTransfersApi.get(id);
      setState((current) => ({ status: "ready", transfer: result.transfer, error: "", message: current.message }));
    } catch (error) {
      setState({ status: "error", transfer: null, error: error.message, message: "" });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function approve() {
    const transfer = state.transfer;
    if (!window.confirm(`Confirm that ${formatMinorAmount(transfer.amountMinor, transfer.currency)} was received? This creates the fulfillment order. The customer will receive the combined payment-confirmed/order-dispatched email when the order is dispatched.`)) return;
    try {
      await adminTransfersApi.approve(id);
      setState((current) => ({ ...current, message: "Transfer approved and fulfillment order created." }));
      await load();
    } catch (error) { setState((current) => ({ ...current, error: error.message })); }
  }

  async function reject() {
    const reason = window.prompt("Why is this transfer being rejected? The customer will see this reason.");
    if (!reason?.trim()) return;
    if (!window.confirm("Reject this transfer and email the reason to the customer?")) return;
    try {
      await adminTransfersApi.reject(id, reason.trim());
      setState((current) => ({ ...current, message: "Transfer rejected and the customer was notified." }));
      await load();
    } catch (error) { setState((current) => ({ ...current, error: error.message })); }
  }

  if (state.status === "loading" && !state.transfer) return <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10"><p className="text-sm font-semibold text-slate-600" role="status">Loading private transfer details…</p></main>;
  if (state.status === "error" && !state.transfer) return <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800" role="alert">{state.error}</div></main>;
  const transfer = state.transfer;
  return <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10"><Link className="text-sm font-bold text-slate-500 hover:text-emerald-700" to={`/admin/requests/${encodeURIComponent(transfer.requestId)}`}>← Medication request</Link><div className="mt-5"><p className="text-sm font-bold text-emerald-700">Bank transfer detail</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{transfer.transferNumber}</h1><p className="mt-3 text-sm text-slate-600">Confirm the matching bank deposit before approving this payment.</p></div>{state.error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{state.error}</div>}{state.message && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900" role="status">{state.message}</div>}<section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Amount submitted</p><p className="mt-2 text-3xl font-extrabold">{formatMinorAmount(transfer.amountMinor, transfer.currency)}</p></div><span className={`self-start rounded-full px-3 py-1 text-xs font-bold ${transfer.status === "approved" ? "bg-emerald-50 text-emerald-800" : transfer.status === "rejected" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>{transfer.statusLabel}</span></div><dl className="mt-7 grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Customer</dt><dd className="mt-1 font-bold">{transfer.customerName} · {transfer.customerEmail}</dd></div><div><dt className="text-slate-500">Beneficiary</dt><dd className="mt-1 font-bold">{transfer.beneficiaryName}</dd></div><div><dt className="text-slate-500">Request</dt><dd className="mt-1 font-bold">{transfer.requestNumber}</dd></div><div><dt className="text-slate-500">Quote</dt><dd className="mt-1 font-bold">{transfer.quoteNumber}</dd></div><div><dt className="text-slate-500">Bank reference</dt><dd className="mt-1 font-bold">{transfer.transferReference || "Not provided"}</dd></div><div><dt className="text-slate-500">Customer transfer date</dt><dd className="mt-1 font-bold">{transfer.transferDate || "Not provided"}</dd></div><div><dt className="text-slate-500">Submitted</dt><dd className="mt-1 font-bold">{formatDate(transfer.createdAt)}</dd></div>{transfer.reviewedAt && <div><dt className="text-slate-500">Reviewed</dt><dd className="mt-1 font-bold">{formatDate(transfer.reviewedAt)}</dd></div>}</dl>{transfer.rejectionReason && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800"><strong>Rejection reason:</strong> {transfer.rejectionReason}</p>}<div className="mt-7 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row"><a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700" href={adminTransfersApi.receiptUrl(transfer.id)} target="_blank" rel="noreferrer">View private receipt</a>{transfer.status === "pending" && <><button className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white" type="button" onClick={approve}>Approve payment</button><button className="min-h-11 rounded-xl border border-red-200 px-5 text-sm font-bold text-red-700" type="button" onClick={reject}>Reject receipt</button></>}</div></section></main>;
}
