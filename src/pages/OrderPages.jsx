import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ordersApi } from "../api/orders";
import { formatMinorAmount } from "../quotes/quoteSchema";

const pagePadding = "px-5 py-8 sm:px-8 lg:px-10 lg:py-10";
const orderStages = [
  ["payment_confirmed", "Payment confirmed"],
  ["preparing_order", "Preparing order"],
  ["ready_for_delivery", "Ready for delivery"],
  ["out_for_delivery", "Out for delivery"],
  ["delivered", "Delivered"],
  ["completed", "Completed"],
];
const stageIndex = Object.fromEntries(orderStages.map(([status], index) => [status, index]));

function formatDate(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Loading() { return <main className="grid min-h-screen place-items-center bg-slate-50" role="status"><p className="font-semibold text-slate-600">Loading order information…</p></main>; }
function ErrorMessage({ message }) { return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">{message}</div>; }

export function OrdersPage() {
  const [view, setView] = useState("active");
  const [state, setState] = useState({ status: "loading", orders: [], error: "" });

  async function load(selectedView) {
    setView(selectedView);
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try { const result = await ordersApi.list({ view: selectedView }); setState({ status: "ready", orders: result.orders || result.items || [], error: "" }); }
    catch (error) { setState({ status: "error", orders: [], error: error.message }); }
  }

  useEffect(() => { let active = true; ordersApi.list().then((result) => { if (active) setState({ status: "ready", orders: result.orders || result.items || [], error: "" }); }).catch((error) => { if (active) setState({ status: "error", orders: [], error: error.message }); }); return () => { active = false; }; }, []);

  return <main className={pagePadding}><div><p className="text-sm font-bold text-emerald-700">Fulfillment</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Orders</h1><p className="mt-3 text-sm text-slate-600">Follow paid medication orders through preparation and delivery.</p></div><div className="mt-8 inline-flex rounded-xl bg-slate-200 p-1"><button className={`rounded-lg px-4 py-2 text-sm font-bold ${view === "active" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} type="button" onClick={() => load("active")}>Active orders</button><button className={`rounded-lg px-4 py-2 text-sm font-bold ${view === "past" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} type="button" onClick={() => load("past")}>Past orders</button></div>{state.status === "loading" && <div className="mt-8 h-44 animate-pulse rounded-[2rem] bg-white" />}{state.status === "error" && <div className="mt-8"><ErrorMessage message={state.error} /></div>}{state.status === "ready" && state.orders.length === 0 && <section className="mt-8 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-bold">{view === "active" ? "No active orders" : "No past orders"}</h2><p className="mt-2 text-sm text-slate-600">{view === "active" ? "Paid medication orders will appear here after verified payment." : "Completed and cancelled orders will appear here."}</p></section>}{state.status === "ready" && state.orders.length > 0 && <section className="mt-8 grid gap-5 xl:grid-cols-2">{state.orders.map((order) => { const id = order.publicId || order.id; return <article key={id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{order.orderNumber || id}</p><h2 className="mt-2 text-lg font-bold">{order.beneficiary?.fullName || order.beneficiaryName}</h2><p className="mt-1 text-sm text-slate-500">Created {formatDate(order.createdAt)}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{order.statusLabel || String(order.status).replaceAll("_", " ")}</span></div><dl className="mt-6 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-500">Amount</dt><dd className="mt-1 font-bold">{formatMinorAmount(order.amountMinor, order.currency)}</dd></div><div><dt className="text-slate-500">Delivery</dt><dd className="mt-1 font-bold">{order.deliveryStatusLabel || "Preparing"}</dd></div></dl><Link className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white" to={`/dashboard/orders/${encodeURIComponent(id)}`}>Track order</Link></article>; })}</section>}
  </main>;
}

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", order: null, error: "" });
  const [reordering, setReordering] = useState(false);

  useEffect(() => { let active = true; ordersApi.get(id).then((result) => { if (active) setState({ status: "ready", order: result.order || result, error: "" }); }).catch((error) => { if (active) setState({ status: "error", order: null, error: error.message }); }); return () => { active = false; }; }, [id]);

  async function requestAgain() {
    if (!window.confirm("Create a new medication request based on this order? Hakim Plus must review it again and you will not be charged now.")) return;
    setReordering(true);
    try { const result = await ordersApi.requestAgain(id); navigate(result.nextPath || result.requestPath || "/dashboard/requests", { replace: true }); }
    catch (error) { setState((current) => ({ ...current, error: error.message })); setReordering(false); }
  }

  if (state.status === "loading") return <Loading />;
  if (state.status === "error" && !state.order) return <main className={pagePadding}><ErrorMessage message={state.error} /></main>;
  const order = state.order;
  const currentStage = stageIndex[order.status] ?? 0;
  const failed = ["cancelled", "delivery_failed"].includes(order.status);
  return <main className={pagePadding}><Link className="text-sm font-bold text-slate-500 hover:text-emerald-700" to="/dashboard/orders">← Orders</Link>{state.error && <div className="mt-5"><ErrorMessage message={state.error} /></div>}<div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-emerald-700">Medication order</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{order.orderNumber || id}</h1><p className="mt-2 text-sm text-slate-600">For {order.beneficiary?.fullName || order.beneficiaryName}</p></div><span className={`self-start rounded-full px-4 py-2 text-sm font-bold ${failed ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{order.statusLabel || String(order.status).replaceAll("_", " ")}</span></div><section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"><h2 className="text-lg font-bold">Fulfillment progress</h2>{failed ? <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{order.customerStatusNote || "Hakim Plus could not complete this delivery. Support will provide the next step."}</p> : <ol className="mt-6 grid gap-3 sm:grid-cols-6">{orderStages.map(([status,label],index) => <li key={status} className={`rounded-xl p-3 text-xs font-bold ${index < currentStage ? "bg-emerald-600 text-white" : index === currentStage ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-950" : "bg-slate-100 text-slate-400"}`}><span className="block text-[10px] opacity-70">{index < currentStage ? "Complete" : index === currentStage ? "Current" : `Step ${index + 1}`}</span><span className="mt-1 block">{label}</span></li>)}</ol>}</section><div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Order items</h2><div className="mt-5 divide-y divide-slate-100">{order.items?.map((item,index) => <div key={item.id || index} className="flex justify-between gap-4 py-4 text-sm"><div><p className="font-bold">{item.medicationName}</p><p className="mt-1 text-slate-500">{item.strength} · {item.quantity} {item.unitLabel}</p></div><p className="font-bold">{formatMinorAmount(item.lineTotalMinor, order.currency)}</p></div>)}</div><div className="mt-5 flex justify-between border-t border-slate-200 pt-5 text-lg font-bold"><span>Total paid</span><span>{formatMinorAmount(order.amountMinor, order.currency)}</span></div></section><aside className="space-y-6"><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Delivery information</h2><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-slate-500">Beneficiary</dt><dd className="mt-1 font-bold">{order.beneficiary?.fullName || order.beneficiaryName}</dd></div><div><dt className="text-slate-500">Address</dt><dd className="mt-1 whitespace-pre-wrap font-bold">{order.delivery?.address || order.deliveryAddress}</dd></div><div><dt className="text-slate-500">Instructions</dt><dd className="mt-1 whitespace-pre-wrap font-semibold">{order.delivery?.instructions || "None"}</dd></div></dl>{order.delivery?.proofViewUrl && <a className="mt-5 inline-flex rounded-xl border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-700" href={order.delivery.proofViewUrl} target="_blank" rel="noreferrer">View delivery confirmation</a>}</section><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Order updates</h2>{order.timeline?.length ? <ol className="mt-5 space-y-4">{order.timeline.map((event,index) => <li key={event.id || index} className="border-l-2 border-emerald-200 pl-4"><p className="text-xs text-slate-500">{formatDate(event.createdAt || event.timestamp)}</p><p className="mt-1 text-sm font-bold">{event.customerLabel || event.label}</p>{event.note && <p className="mt-1 text-sm text-slate-600">{event.note}</p>}</li>)}</ol> : <p className="mt-3 text-sm text-slate-600">Payment confirmation is the first order event.</p>}</section></aside></div>{["delivered", "completed"].includes(order.status) && <section className="mt-6 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6"><h2 className="text-lg font-bold text-emerald-950">Need the same medications again?</h2><p className="mt-2 text-sm leading-6 text-emerald-900">This creates a new request for pharmacy review. It never repeats the charge or automatically reuses an old prescription.</p><button className="mt-5 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white" type="button" disabled={reordering} onClick={requestAgain}>{reordering ? "Creating new request…" : "Request again"}</button></section>}
  </main>;
}
