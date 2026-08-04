import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { paymentsApi } from "../api/payments";
import { formatMinorAmount } from "../quotes/quoteSchema";
import BrandLogo from "../components/BrandLogo";

const pagePadding = "px-5 py-8 sm:px-8 lg:px-10 lg:py-10";
const acceptedTypes = ["image/jpeg", "image/png", "application/pdf"];
const maxReceiptSize = 2.5 * 1024 * 1024;

function formatDate(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("The selected receipt could not be read.")));
    reader.readAsDataURL(file);
  });
}

function Loading({ text = "Loading payment instructions…" }) {
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5" role="status"><p className="font-semibold text-slate-600">{text}</p></main>;
}

function ErrorMessage({ message }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">{message}</div>;
}

function QuoteSummary({ context }) {
  const quote = context.quote;
  return <section className="rounded-[2rem] border border-slate-200 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Amount to transfer</p><p className="mt-3 text-3xl font-bold">{formatMinorAmount(quote.grandTotalMinor, quote.currency)}</p><dl className="mt-6 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Quote</dt><dd className="font-bold">{quote.quoteNumber}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Request</dt><dd className="font-bold">{context.requestNumber}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Beneficiary</dt><dd className="font-bold">{context.beneficiaryName}</dd></div></dl><p className="mt-6 rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">Transfer the exact quoted amount and currency. Any bank or conversion fees are your responsibility.</p></section>;
}

export function PaymentCheckoutPage() {
  const { id } = useParams();
  const [state, setState] = useState({ status: "loading", context: null, error: "", success: "" });
  const [form, setForm] = useState({ transferReference: "", transferDate: new Date().toISOString().slice(0, 10), receipt: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    paymentsApi.getCheckoutContext(id).then((result) => {
      if (active) setState({ status: "ready", context: result.paymentContext || result, error: "", success: "" });
    }).catch((error) => { if (active) setState({ status: "error", context: null, error: error.message, success: "" }); });
    return () => { active = false; };
  }, [id]);

  async function submit(event) {
    event.preventDefault();
    setState((current) => ({ ...current, error: "", success: "" }));
    if (!form.receipt) return setState((current) => ({ ...current, error: "Attach your bank transfer receipt." }));
    if (!acceptedTypes.includes(form.receipt.type)) return setState((current) => ({ ...current, error: "Use a JPG, PNG, or PDF receipt." }));
    if (form.receipt.size > maxReceiptSize) return setState((current) => ({ ...current, error: "The receipt must be 2.5 MB or smaller." }));
    setBusy(true);
    try {
      const dataUrl = await readAsDataUrl(form.receipt);
      await paymentsApi.submitBankTransfer(id, {
        transferReference: form.transferReference.trim(),
        transferDate: form.transferDate,
        receipt: { fileName: form.receipt.name, contentType: form.receipt.type, size: form.receipt.size, dataUrl },
      });
      setState((current) => ({ ...current, success: "Receipt submitted securely. Hakim Plus will verify the transfer before fulfillment begins." }));
      setForm((current) => ({ ...current, receipt: null }));
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally { setBusy(false); }
  }

  if (state.status === "loading") return <Loading />;
  if (!state.context) return <main className={pagePadding}><ErrorMessage message={state.error} /></main>;
  const bank = state.context.bankTransfer;
  return <main className={pagePadding}><div className="mx-auto max-w-5xl"><Link className="text-sm font-bold text-slate-500 hover:text-emerald-700" to={`/dashboard/requests/${encodeURIComponent(id)}/quote`}>← Return to quote</Link><div className="mt-6"><p className="text-sm font-bold text-emerald-700">Bank transfer</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Pay your approved quote</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Send the quoted total to the account below, then upload the receipt. Fulfillment starts only after Hakim Plus confirms the transfer.</p></div>{state.error && <div className="mt-6"><ErrorMessage message={state.error} /></div>}{state.success && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-950" role="status">{state.success}<div className="mt-4"><Link className="font-bold text-emerald-800 underline" to="/dashboard/payments">View payment status</Link></div></div>}<div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><div className="space-y-6"><QuoteSummary context={state.context} /><section className="rounded-[2rem] bg-slate-950 p-6 text-white"><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">Bank details</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-slate-400">Bank</dt><dd className="mt-1 font-bold">{bank.bankName}</dd></div><div><dt className="text-slate-400">Account name</dt><dd className="mt-1 font-bold">{bank.accountName}</dd></div><div><dt className="text-slate-400">Account number</dt><dd className="mt-1 break-all text-lg font-bold tracking-wide">{bank.accountNumber}</dd></div><div><dt className="text-slate-400">SWIFT</dt><dd className="mt-1 font-bold">{bank.swift}</dd></div></dl></section></div><form className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8" onSubmit={submit}><h2 className="text-xl font-bold">Submit transfer receipt</h2><p className="mt-2 text-sm leading-6 text-slate-600">Receipts are kept in private storage and can only be viewed by authorized Hakim Plus staff.</p><div className="mt-6 space-y-5"><label className="block text-sm font-bold">Transfer reference (optional)<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" value={form.transferReference} onChange={(event) => setForm({ ...form, transferReference: event.target.value })} placeholder="Bank reference or transaction ID" /></label><label className="block text-sm font-bold">Transfer date<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" type="date" required value={form.transferDate} onChange={(event) => setForm({ ...form, transferDate: event.target.value })} /></label><label className="block text-sm font-bold">Receipt file<input className="mt-2 block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-normal" type="file" required accept="image/jpeg,image/png,application/pdf" onChange={(event) => setForm({ ...form, receipt: event.target.files?.[0] || null })} /><span className="mt-2 block text-xs font-normal text-slate-500">JPG, PNG, or PDF · maximum 2.5 MB</span></label></div><button className="mt-7 min-h-12 w-full rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:bg-slate-300" type="submit" disabled={busy || Boolean(state.success)}>{busy ? "Uploading receipt securely…" : state.success ? "Receipt submitted" : "Submit receipt for verification"}</button></form></div></div></main>;
}

export function PaymentsPage() {
  const [state, setState] = useState({ status: "loading", payments: [], error: "" });
  useEffect(() => { let active = true; paymentsApi.list().then((result) => { if (active) setState({ status: "ready", payments: result.payments || [], error: "" }); }).catch((error) => { if (active) setState({ status: "error", payments: [], error: error.message }); }); return () => { active = false; }; }, []);
  if (state.status === "loading") return <Loading text="Loading transfer records…" />;
  return <main className={pagePadding}><div><p className="text-sm font-bold text-emerald-700">Account records</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Payments</h1><p className="mt-3 text-sm text-slate-600">Track bank-transfer verification and view receipts for confirmed payments.</p></div>{state.error && <div className="mt-8"><ErrorMessage message={state.error} /></div>}{!state.error && state.payments.length === 0 && <section className="mt-8 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-bold">No payments yet</h2><p className="mt-2 text-sm text-slate-600">Submitted transfers and verified payments will appear here.</p></section>}{state.payments.length > 0 && <section className="mt-8 space-y-4">{state.payments.map((payment) => <article key={payment.id} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{payment.paymentNumber || payment.transferNumber}</p><h2 className="mt-2 font-bold">Request {payment.requestNumber}</h2><p className="mt-1 text-sm text-slate-500">{formatDate(payment.createdAt)} · Bank transfer</p></div><div className="sm:text-right"><p className="text-lg font-bold">{formatMinorAmount(payment.amountMinor, payment.currency)}</p><span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${payment.status === "confirmed" ? "bg-emerald-50 text-emerald-800" : payment.status === "rejected" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>{payment.statusLabel}</span></div></div>{payment.receiptAvailable && <div className="mt-5 border-t border-slate-100 pt-4"><Link className="text-sm font-bold text-emerald-700" to={`/dashboard/payments/${encodeURIComponent(payment.id)}/receipt`}>View verified payment receipt</Link></div>}{payment.rejectionReason && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{payment.rejectionReason}</p>}</article>)}</section>}</main>;
}

export function ReceiptPage() {
  const { paymentId } = useParams();
  const [state, setState] = useState({ status: "loading", receipt: null, error: "" });
  useEffect(() => { let active = true; paymentsApi.getReceipt(paymentId).then((result) => { if (active) setState({ status: "ready", receipt: result.receipt || result, error: "" }); }).catch((error) => { if (active) setState({ status: "error", receipt: null, error: error.message }); }); return () => { active = false; }; }, [paymentId]);
  if (state.status === "loading") return <Loading text="Loading verified receipt…" />;
  if (!state.receipt) return <main className={pagePadding}><ErrorMessage message={state.error} /></main>;
  const receipt = state.receipt;
  return <main className={pagePadding}><div className="mx-auto max-w-3xl"><Link className="text-sm font-bold text-slate-500" to="/dashboard/payments">← Payments</Link><section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10"><div className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:justify-between"><div><div className="flex items-center gap-3"><BrandLogo className="h-11 w-11 rounded-xl" /><p className="text-sm font-extrabold">Hakim Plus Pharmacy</p></div><h1 className="mt-3 text-3xl font-semibold">Payment receipt</h1><p className="mt-2 text-sm text-slate-500">{receipt.receiptNumber}</p></div><div className="sm:text-right"><p className="text-xs font-bold uppercase text-slate-400">Verified</p><p className="mt-2 font-bold">{formatDate(receipt.paidAt)}</p></div></div><dl className="mt-7 grid gap-6 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Payment ID</dt><dd className="mt-1 font-bold">{receipt.paymentNumber}</dd></div><div><dt className="text-slate-500">Request</dt><dd className="mt-1 font-bold">{receipt.requestNumber}</dd></div><div><dt className="text-slate-500">Beneficiary</dt><dd className="mt-1 font-bold">{receipt.beneficiaryName}</dd></div><div><dt className="text-slate-500">Payment method</dt><dd className="mt-1 font-bold">Bank transfer</dd></div></dl><div className="mt-8 flex justify-between border-t border-slate-200 pt-6 text-xl font-bold"><span>Amount verified</span><span>{formatMinorAmount(receipt.amountMinor, receipt.currency)}</span></div><p className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">This portal receipt confirms that Hakim Plus verified the submitted bank transfer.</p></section></div></main>;
}
