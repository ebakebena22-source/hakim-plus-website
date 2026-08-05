import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { requestsApi } from "../api/requests";
import CustomerOrderTracker from "../components/CustomerOrderTracker";

const pagePadding = "px-5 py-8 sm:px-8 lg:px-10 lg:py-10";
const requestFilterOptions = [["all","All"],["active","Active"],["needs_action","Needs action"],["completed","Completed"],["cancelled","Cancelled"]];
const requestFilterValues = new Set(requestFilterOptions.map(([value]) => value));

const statusLabels = {
  request_submitted: "Request submitted",
  pharmacy_review: "Pharmacy review",
  payment: "Payment",
  delivery: "Delivery",
  submitted: "Request submitted",
  under_pharmacy_review: "Pharmacy review",
  additional_information_required: "Additional information required",
  contacting_beneficiary: "Contacting beneficiary",
  prescription_verification: "Prescription verification",
  checking_availability: "Checking availability",
  quote_ready: "Quote ready",
  awaiting_customer_approval: "Awaiting your approval",
  awaiting_payment: "Awaiting payment",
  payment_confirmed: "Payment confirmed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  partially_fulfilled: "Partially fulfilled",
  cancelled: "Cancelled",
  unable_to_fulfill: "Unable to fulfill",
};

const requestEmptyStates = {
  all: {
    title: "No medication requests yet",
    description: "When you submit a medication request, it will appear here.",
    actionLabel: "Create your first request",
  },
  active: {
    title: "No active requests",
    description: "Your requests still in pharmacy review, payment, or delivery will appear here.",
  },
  needs_action: {
    title: "Nothing needs your attention",
    description: "Requests that need you to review a quote, make a payment, or provide information will appear here.",
  },
  completed: {
    title: "No completed requests",
    description: "Your medication requests will appear here after delivery is completed.",
  },
  cancelled: {
    title: "No cancelled requests",
    description: "Cancelled requests and requests Hakim Plus could not fulfill will appear here.",
  },
};

function labelStatus(status, fallback) {
  return statusLabels[status] || fallback || String(status || "Submitted").replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Loading() {
  return <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-8" role="status"><div className="h-6 w-48 animate-pulse rounded bg-slate-200" /><div className="mt-5 h-28 animate-pulse rounded-2xl bg-slate-100" /></div>;
}

function ErrorMessage({ message, onRetry }) {
  return <div className="mt-8 rounded-[2rem] border border-red-200 bg-red-50 p-6" role="alert"><h2 className="font-bold text-red-950">We could not load this request</h2><p className="mt-2 text-sm text-red-800">{message}</p>{onRetry && <button className="mt-4 rounded-xl bg-red-800 px-4 py-2 text-sm font-bold text-white" type="button" onClick={onRetry}>Try again</button>}</div>;
}

export function RequestsPage() {
  const [searchParams] = useSearchParams();
  const requestedFilter = searchParams.get("status") || "all";
  const initialFilter = requestFilterValues.has(requestedFilter) ? requestedFilter : "all";
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [state, setState] = useState({ status: "loading", requests: [], error: "" });

  async function load(selectedFilter = filter, selectedSearch = search) {
    setAppliedSearch(selectedSearch.trim());
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const result = await requestsApi.list({ status: selectedFilter, search: selectedSearch });
      setState({ status: "ready", requests: result.requests || result.items || [], error: "" });
    } catch (error) {
      setState({ status: "error", requests: [], error: error.message });
    }
  }

  useEffect(() => {
    let active = true;
    requestsApi.list({ status: initialFilter }).then((result) => { if (active) setState({ status: "ready", requests: result.requests || result.items || [], error: "" }); }).catch((error) => { if (active) setState({ status: "error", requests: [], error: error.message }); });
    return () => { active = false; };
  }, [initialFilter]);

  function applyFilter(value) { setFilter(value); load(value, search); }
  function handleSearch(event) { event.preventDefault(); load(filter, search); }

  const emptyState = appliedSearch
    ? {
        title: "No matching requests",
        description: "No requests match your search. Try another request number, beneficiary, or medication.",
      }
    : requestEmptyStates[filter] || requestEmptyStates.all;

  return <main className={pagePadding}><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-emerald-700">Care requests</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Medication requests</h1><p className="mt-3 text-sm text-slate-600">Track each request through pharmacy review, payment, and delivery.</p></div><Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white" to="/dashboard/requests/new">New medication request</Link></div>
    <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-4"><div className="flex flex-wrap gap-2">{requestFilterOptions.map(([value,label]) => <button key={value} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === value ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`} type="button" onClick={() => applyFilter(value)}>{label}</button>)}</div><form className="mt-4 flex gap-2" onSubmit={handleSearch}><label className="sr-only" htmlFor="request-search">Search requests</label><input id="request-search" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm" placeholder="Search request number, beneficiary, or medication" value={search} onChange={(event) => setSearch(event.target.value)} /><button className="rounded-xl bg-slate-950 px-5 text-sm font-bold text-white" type="submit">Search</button></form></div>
    {state.status === "loading" && <Loading />}{state.status === "error" && <ErrorMessage message={state.error} onRetry={() => load()} />}{state.status === "ready" && state.requests.length === 0 && <section className="mt-8 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-bold">{emptyState.title}</h2><p className="mt-2 text-sm text-slate-600">{emptyState.description}</p>{emptyState.actionLabel && <Link className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white" to="/dashboard/requests/new">{emptyState.actionLabel}</Link>}</section>}{state.status === "ready" && state.requests.length > 0 && <section className="mt-8 space-y-4">{state.requests.map((request) => { const id = request.publicId || request.id; return <article key={id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{request.requestNumber || id}</p><h2 className="mt-2 text-lg font-bold">{request.beneficiary?.fullName || request.beneficiaryName}</h2><p className="mt-1 text-sm text-slate-500">Submitted {formatDate(request.submittedAt || request.createdAt)} · {request.medicationCount || 0} medication(s)</p></div><div className="sm:text-right"><span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{labelStatus(request.status, request.statusLabel)}</span>{request.actionRequired && <p className="mt-2 text-xs font-bold text-amber-700">Action required</p>}</div></div><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><p className="text-sm text-slate-600">{request.latestUpdate || "Hakim Plus will post updates here."}</p><Link className="ml-4 shrink-0 text-sm font-bold text-emerald-700" to={`/dashboard/requests/${encodeURIComponent(id)}`}>View details</Link></div></article>; })}</section>}
  </main>;
}

function useRequest(id) {
  const [state, setState] = useState({ status: "loading", request: null, error: "" });
  useEffect(() => { let active = true; requestsApi.get(id).then((result) => { if (active) setState({ status: "ready", request: result.request || result, error: "" }); }).catch((error) => { if (active) setState({ status: "error", request: null, error: error.message }); }); return () => { active = false; }; }, [id]);
  return state;
}

export function RequestConfirmationPage() {
  const { id } = useParams();
  const state = useRequest(id);
  if (state.status === "loading") return <main className={pagePadding}><Loading /></main>;
  if (state.status === "error") return <main className={pagePadding}><ErrorMessage message={state.error} /></main>;
  const request = state.request;
  return <main className={pagePadding}><div className="mx-auto max-w-3xl rounded-[2rem] border border-emerald-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5 sm:p-12"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">✓</div><p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">Request received</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Your request has been received</h1><p className="mt-3 text-lg font-bold text-slate-700">{request.requestNumber}</p><dl className="mx-auto mt-8 grid max-w-xl gap-4 rounded-2xl bg-slate-50 p-6 text-left text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Beneficiary</dt><dd className="mt-1 font-bold">{request.beneficiary?.fullName || request.beneficiaryName}</dd></div><div><dt className="text-slate-500">Submitted</dt><dd className="mt-1 font-bold">{formatDate(request.submittedAt || request.createdAt)}</dd></div><div><dt className="text-slate-500">Status</dt><dd className="mt-1 font-bold">{labelStatus(request.status, request.statusLabel)}</dd></div><div><dt className="text-slate-500">Next step</dt><dd className="mt-1 font-bold">Pharmacy review</dd></div></dl><p className="mx-auto mt-8 max-w-2xl text-sm leading-6 text-slate-600">Our pharmacy team will review your request, confirm medication availability and pricing, and contact you if additional information is required. You will only be asked to pay after your request has been reviewed and confirmed.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white" to={`/dashboard/requests/${encodeURIComponent(id)}`}>View request</Link><Link className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700" to="/dashboard">Back to dashboard</Link></div></div></main>;
}

export function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const state = useRequest(id);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelAction, setCancelAction] = useState({ busy: false, error: "" });

  async function cancelRequest() {
    if (!window.confirm("Cancel this medication request? This action cannot be undone.")) return;
    setCancelAction({ busy: true, error: "" });
    try {
      await requestsApi.cancel(id, cancelReason.trim());
      navigate("/dashboard/requests?status=cancelled", { replace: true });
    } catch (error) {
      setCancelAction({ busy: false, error: error.message });
    }
  }

  if (state.status === "loading") return <main className={pagePadding}><Loading /></main>;
  if (state.status === "error") return <main className={pagePadding}><ErrorMessage message={state.error} /></main>;
  const request = state.request;
  const terminal = ["cancelled", "unable_to_fulfill"].includes(request.status);
  return <main className={pagePadding}><Link className="text-sm font-bold text-slate-500 hover:text-emerald-700" to="/dashboard/requests">← All requests</Link><div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-emerald-700">Medication request</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{request.requestNumber || id}</h1><p className="mt-2 text-sm text-slate-600">{request.beneficiary?.fullName || request.beneficiaryName} · Submitted {formatDate(request.submittedAt || request.createdAt)}</p></div><span className={`inline-flex self-start rounded-full px-4 py-2 text-sm font-bold ${terminal ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{labelStatus(request.status, request.statusLabel)}</span></div>
    {request.paymentState === "quote_available" && <section className="mt-8 rounded-[2rem] border border-amber-300 bg-amber-50 p-6 sm:flex sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Action required</p><h2 className="mt-2 text-xl font-bold text-amber-950">Your pharmacy quote is ready</h2><p className="mt-2 text-sm text-amber-900">Review availability, pricing, fees, and expiration before deciding.</p></div><Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-amber-800 px-5 text-sm font-bold text-white sm:mt-0" to={`/dashboard/requests/${encodeURIComponent(id)}/quote`}>Review quote</Link></section>}
    {request.paymentState === "required" && <section className="mt-8 rounded-[2rem] border border-emerald-300 bg-emerald-50 p-6 sm:flex sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Action required</p><h2 className="mt-2 text-xl font-bold text-emerald-950">Payment is required</h2><p className="mt-2 text-sm text-emerald-900">Transfer the quoted amount and upload your bank receipt for verification.</p></div><Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white sm:mt-0" to={`/dashboard/requests/${encodeURIComponent(id)}/payment`}>Continue to payment</Link></section>}
    {(request.orderPath || request.order?.publicId || request.order?.id) && request.completed && <section className="mt-8 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 sm:flex sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Completed</p><h2 className="mt-2 text-xl font-bold text-emerald-950">Order delivered</h2><p className="mt-2 text-sm text-emerald-900">Your request is complete and the order has been delivered.</p></div><Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white sm:mt-0" to={request.orderPath || `/dashboard/orders/${encodeURIComponent(request.order.publicId || request.order.id)}`}>View completed order</Link></section>}
    {(request.orderPath || request.order?.publicId || request.order?.id) && !request.completed && <section className="mt-8 rounded-[2rem] border border-blue-200 bg-blue-50 p-6 sm:flex sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-800">Paid order</p><h2 className="mt-2 text-xl font-bold text-blue-950">Follow delivery</h2><p className="mt-2 text-sm text-blue-900">Payment is confirmed and the delivery record is ready.</p></div><Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-5 text-sm font-bold text-white sm:mt-0" to={request.orderPath || `/dashboard/orders/${encodeURIComponent(request.order.publicId || request.order.id)}`}>Track delivery</Link></section>}
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"><h2 className="text-lg font-bold">Request progress</h2>{terminal && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{request.statusNote || "Hakim Plus could not continue this request. Contact support if you need help."}</p>}<CustomerOrderTracker status={request.trackerStage || request.status} failed={terminal} completed={request.completed} /></section>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Request details</h2><dl className="mt-6 grid gap-6 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Submission method</dt><dd className="mt-1 font-bold">{request.submissionMethodLabel || request.submissionMethod}</dd></div><div><dt className="text-slate-500">Preferred contact</dt><dd className="mt-1 font-bold">{request.preferredContactMethod || "Not provided"}</dd></div><div className="sm:col-span-2"><dt className="text-slate-500">Notes</dt><dd className="mt-1 whitespace-pre-wrap font-semibold">{request.additionalNotes || request.description || "No additional notes"}</dd></div></dl>{request.medications?.length > 0 && <div className="mt-6 border-t border-slate-100 pt-6"><h3 className="font-bold">Medications submitted for review</h3><ul className="mt-3 space-y-3">{request.medications.map((item,index) => <li key={item.id || index} className="rounded-xl bg-slate-50 p-4 text-sm"><strong>{item.medicationName}</strong><span className="ml-2 text-slate-500">{item.strength} · {item.dosageForm} · {item.quantity}</span></li>)}</ul></div>}</section><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Updates</h2>{request.statusHistory?.length ? <ol className="mt-6 space-y-5">{request.statusHistory.map((event,index) => <li key={event.id || index} className="relative border-l-2 border-emerald-200 pl-5"><span className="absolute -left-2 top-0 h-3.5 w-3.5 rounded-full bg-emerald-600" /><p className="text-xs text-slate-500">{formatDate(event.createdAt || event.timestamp)}</p><p className="mt-1 text-sm font-bold">{event.customerLabel || labelStatus(event.status)}</p>{event.note && <p className="mt-1 text-sm leading-6 text-slate-600">{event.note}</p>}</li>)}</ol> : <p className="mt-4 text-sm text-slate-600">The request submission is the first activity. Pharmacy updates will appear here.</p>}</section></div>
    {request.canCancel && <section className="mt-6 rounded-[2rem] border border-red-200 bg-red-50 p-6"><h2 className="text-lg font-bold text-red-950">Cancel this request</h2><p className="mt-2 text-sm leading-6 text-red-800">You can cancel before payment processing or fulfillment starts.</p><label className="mt-4 block text-sm font-bold text-red-950">Reason (optional)<textarea className="mt-2 min-h-20 w-full rounded-xl border border-red-300 bg-white p-3 font-normal" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label>{cancelAction.error && <p className="mt-3 text-sm font-semibold text-red-800" role="alert">{cancelAction.error}</p>}<button className="mt-4 rounded-xl bg-red-800 px-5 py-3 text-sm font-bold text-white disabled:bg-red-300" type="button" disabled={cancelAction.busy} onClick={cancelRequest}>{cancelAction.busy ? "Cancelling…" : "Cancel request"}</button></section>}
    <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Need help with this request?</h2><p className="mt-2 text-sm text-slate-600">Send a secure request-specific message and keep every reply attached to this request.</p><div className="mt-4 flex flex-wrap gap-3"><Link className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white" to={`/dashboard/requests/${encodeURIComponent(id)}/messages`}>Message Hakim Plus</Link><Link className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700" to="/dashboard/help">View help</Link></div></section>
  </main>;
}
