import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminApi } from "../api/admin";
import { adminQuotesApi } from "../api/quotes";
import { calculateQuotePreview, createQuotePayload, emptyQuote, emptyQuoteItem, formatMinorAmount, validateQuote } from "../quotes/quoteSchema";

function defaultQuoteExpiry() {
  const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const local = new Date(future.getTime() - future.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function initialQuoteForRequest(request, existingQuote) {
  if (existingQuote) return {
    ...emptyQuote,
    ...existingQuote,
    items: existingQuote.items?.length ? existingQuote.items : [{ ...emptyQuoteItem }],
    expiresAt: toLocalDateTimeInput(existingQuote.expiresAt),
  };
  const medications = request.medications || [];
  return {
    ...emptyQuote,
    currency: request.currency || "USD",
    expiresAt: defaultQuoteExpiry(),
    items: medications.length ? medications.map((item) => ({ ...emptyQuoteItem, medicationName: item.medicationName || "", strength: item.strength || "", dosageForm: item.dosageForm || "", quotedQuantity: String(item.quotedQuantity || Number.parseInt(item.quantity, 10) || 1) })) : [{ ...emptyQuoteItem }],
  };
}

export default function AdminQuotePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", request: null, quote: null, error: "" });
  const [quote, setQuote] = useState(emptyQuote);
  const [errors, setErrors] = useState({});
  const [action, setAction] = useState({ busy: false, message: "", error: "" });
  const totals = useMemo(() => calculateQuotePreview(quote), [quote]);

  useEffect(() => {
    let active = true;
    Promise.all([adminApi.getRequest(id), adminQuotesApi.getForRequest(id)]).then(([requestResult, quoteResult]) => {
      if (!active) return;
      const request = requestResult.request || requestResult;
      const existingQuote = quoteResult.quote || null;
      setQuote(initialQuoteForRequest(request, existingQuote));
      setState({ status: "ready", request, quote: existingQuote, error: "" });
    }).catch((error) => { if (active) setState({ status: "error", request: null, quote: null, error: error.message }); });
    return () => { active = false; };
  }, [id]);

  function update(name, value) { setQuote((current) => ({ ...current, [name]: value })); }
  function updateItem(index, name, value) { setQuote((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [name]: value } : item) })); }
  function addItem() { setQuote((current) => ({ ...current, items: [...current.items, { ...emptyQuoteItem }] })); }
  function removeItem(index) { setQuote((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) })); }

  async function saveDraft(showSuccess = true) {
    const validationErrors = validateQuote(quote);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return null;
    setAction({ busy: true, message: "", error: "" });
    try {
      const result = await adminQuotesApi.saveDraft(id, createQuotePayload(quote));
      const savedQuote = result.quote || result;
      setState((current) => ({ ...current, quote: savedQuote }));
      setAction({ busy: false, message: showSuccess ? "Quote draft saved. Customer has not been notified." : "", error: "" });
      return savedQuote;
    } catch (error) {
      setAction({ busy: false, message: "", error: error.message });
      return null;
    }
  }

  async function sendQuote() {
    const saved = await saveDraft(false);
    if (!saved) return;
    if (!window.confirm("Send this quote and an email to the customer? The email will include the itemized quote and payment instructions.")) return setAction({ busy: false, message: "Quote draft saved but not sent.", error: "" });
    setAction({ busy: true, message: "", error: "" });
    try { await adminQuotesApi.send(id); setAction({ busy: false, message: "Quote sent to the customer.", error: "" }); navigate(`/admin/requests/${encodeURIComponent(id)}`, { replace: true }); }
    catch (error) { setAction({ busy: false, message: "", error: error.message }); }
  }

  if (state.status === "loading") return <main className="grid min-h-screen place-items-center bg-slate-100" role="status"><p className="font-semibold text-slate-600">Loading quote workspace…</p></main>;
  if (state.status === "error") return <main className="p-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800" role="alert">{state.error}</div></main>;
  const request = state.request;
  const hasPartialItems = quote.items.some((item) => item.availability !== "available");
  return <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10"><Link className="text-sm font-bold text-slate-500 hover:text-emerald-700" to={`/admin/requests/${encodeURIComponent(id)}`}>← Request {request.requestNumber || id}</Link><div className="mt-5"><p className="text-sm font-bold text-emerald-700">Pharmacist quote</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Create itemized quote</h1><p className="mt-3 text-sm text-slate-600">Confirm products, availability, pricing, fees, and expiration. The server must recalculate every total before saving or sending.</p></div>{action.error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{action.error}</div>}{action.message && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900" role="status">{action.message}</div>}
    <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px]"><div className="space-y-5"><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Quote items</h2><p className="mt-1 text-sm text-slate-600">Unavailable items remain visible with an explanation and zero price.</p></div><button className="rounded-xl border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-700" type="button" onClick={addItem}>Add item</button></div>{errors.items && <p className="mt-3 text-sm text-red-700">{errors.items}</p>}<div className="mt-6 space-y-5">{quote.items.map((item,index) => <fieldset key={item.id || index} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><legend className="px-2 text-sm font-bold">Item {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Medication or product<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" value={item.medicationName} onChange={(event) => updateItem(index, "medicationName", event.target.value)} />{errors[`item-${index}-name`] && <span className="mt-1 block text-xs text-red-700">{errors[`item-${index}-name`]}</span>}</label><label className="text-sm font-bold">Availability<select className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" value={item.availability} onChange={(event) => updateItem(index, "availability", event.target.value)}><option value="available">Fully available</option><option value="partial">Partially available</option><option value="unavailable">Unavailable</option></select></label><label className="text-sm font-bold">Strength<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" value={item.strength} onChange={(event) => updateItem(index, "strength", event.target.value)} /></label><label className="text-sm font-bold">Dosage form<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" value={item.dosageForm} onChange={(event) => updateItem(index, "dosageForm", event.target.value)} /></label><label className="text-sm font-bold">Quoted quantity<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" type="number" min="0" step="1" disabled={item.availability === "unavailable"} value={item.quotedQuantity} onChange={(event) => updateItem(index, "quotedQuantity", event.target.value)} /></label><label className="text-sm font-bold">Unit label<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" placeholder="tablet, bottle, box" value={item.unitLabel} onChange={(event) => updateItem(index, "unitLabel", event.target.value)} /></label><label className="text-sm font-bold sm:col-span-2">Unit price ({quote.currency})<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" type="number" min="0" step="0.01" disabled={item.availability === "unavailable"} value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} />{errors[`item-${index}-pricing`] && <span className="mt-1 block text-xs text-red-700">{errors[`item-${index}-pricing`]}</span>}</label><label className="text-sm font-bold sm:col-span-2">Customer-facing item note<textarea className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder={item.availability === "available" ? "Optional" : "Explain what is unavailable or partially available"} value={item.pharmacyNote} onChange={(event) => updateItem(index, "pharmacyNote", event.target.value)} />{errors[`item-${index}-note`] && <span className="mt-1 block text-xs text-red-700">{errors[`item-${index}-note`]}</span>}</label></div>{quote.items.length > 1 && <button className="mt-4 text-sm font-bold text-red-700" type="button" onClick={() => removeItem(index)}>Remove item</button>}</fieldset>)}</div></section>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Fees, discount, and expiration</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Customer currency<input className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 font-normal uppercase text-slate-600" value={quote.currency} disabled /><span className="mt-1 block text-xs font-normal text-slate-500">Set by the customer&apos;s country profile.</span>{errors.currency && <span className="mt-1 block text-xs text-red-700">{errors.currency}</span>}</label><label className="text-sm font-bold">Quote expires<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" type="datetime-local" value={quote.expiresAt} onChange={(event) => update("expiresAt", event.target.value)} />{errors.expiresAt && <span className="mt-1 block text-xs text-red-700">{errors.expiresAt}</span>}</label>{[["deliveryFee","Delivery fee"],["serviceFee","Service fee"],["discount","Discount"],["tax","Tax"]].map(([name,label]) => <label key={name} className="text-sm font-bold">{label}<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" type="number" min="0" step="0.01" value={quote[name]} onChange={(event) => update(name, event.target.value)} /></label>)}<label className="text-sm font-bold sm:col-span-2">Pharmacy notes to customer<textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 font-normal" value={quote.pharmacyNotes} onChange={(event) => update("pharmacyNotes", event.target.value)} /></label></div></section></div>
      <aside><div className="sticky top-6 space-y-5"><section className="rounded-[2rem] bg-slate-950 p-6 text-white"><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">Quote preview</p>{hasPartialItems && <p className="mt-4 rounded-xl bg-amber-400/10 p-3 text-xs font-bold text-amber-300">Contains partial or unavailable items</p>}<dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-slate-400">Items subtotal</dt><dd className="font-bold">{formatMinorAmount(totals.itemSubtotalMinor, quote.currency)}</dd></div><div className="flex justify-between"><dt className="text-slate-400">Delivery</dt><dd>{quote.deliveryFee}</dd></div><div className="flex justify-between"><dt className="text-slate-400">Service</dt><dd>{quote.serviceFee}</dd></div><div className="flex justify-between"><dt className="text-slate-400">Tax</dt><dd>{quote.tax}</dd></div><div className="flex justify-between text-emerald-300"><dt>Discount</dt><dd>-{quote.discount}</dd></div><div className="flex justify-between border-t border-white/10 pt-4 text-lg"><dt className="font-bold">Estimated total</dt><dd className="font-bold">{formatMinorAmount(totals.grandTotalMinor, quote.currency)}</dd></div></dl><p className="mt-4 text-[11px] leading-5 text-slate-400">Preview only. The API must calculate and return authoritative line totals and grand total.</p></section><button className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800" type="button" disabled={action.busy} onClick={() => saveDraft()}>{action.busy ? "Saving…" : "Save draft"}</button><button className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white" type="button" disabled={action.busy} onClick={sendQuote}>Save and send quote</button><p className="text-xs leading-5 text-slate-500">Sending creates a customer-visible status event and notification. Payment is not collected in this phase.</p></div></aside></div>
  </main>;
}
