import { useEffect, useState } from "react";
import { analyticsApi } from "../api/governance";

const metricDefinitions = [
  ["customers", "Customers"],
  ["beneficiaries", "Beneficiaries"],
  ["requestsSubmitted", "Requests submitted"],
  ["requestsFulfilled", "Requests fulfilled"],
  ["quoteApprovalRate", "Quote approval rate", "percent"],
  ["repeatCustomerRate", "Repeat customer rate", "percent"],
  ["averageOrderValue", "Average order value", "money"],
  ["medianFulfillmentHours", "Median fulfillment time", "hours"],
];

function formatMetric(value, type, currency = "USD") {
  if (value === undefined || value === null) return "—";
  if (type === "percent") return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  if (type === "money") return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value));
  if (type === "hours") return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs`;
  return Number(value).toLocaleString();
}

function Breakdown({ title, items = [] }) {
  return <section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">{title}</h2>{items.length ? <div className="mt-5 space-y-4">{items.map((item) => <div key={item.key || item.label}><div className="flex justify-between gap-4 text-sm"><span className="font-semibold text-slate-700">{item.label}</span><span className="font-bold">{Number(item.value || 0).toLocaleString()}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, Number(item.percent || 0)))}%` }} /></div></div>)}</div> : <p className="mt-4 text-sm text-slate-600">No aggregate data is available for this period.</p>}</section>;
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState("30d");
  const [state, setState] = useState({ status: "loading", data: null, error: "" });

  useEffect(() => {
    let active = true;
    analyticsApi.overview(range).then((result) => { if (active) setState({ status: "ready", data: result.analytics || result, error: "" }); }).catch((error) => { if (active) setState({ status: "error", data: null, error: error.message }); });
    return () => { active = false; };
  }, [range]);

  const data = state.data || {};
  return <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-emerald-700">Business intelligence</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Operational analytics</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Aggregate service performance without beneficiary names, medication details, prescriptions, or message content.</p></div><label className="text-sm font-bold text-slate-700">Reporting period<select className="ml-3 rounded-xl border border-slate-300 bg-white px-4 py-3" value={range} onChange={(event) => { setState({ status: "loading", data: null, error: "" }); setRange(event.target.value); }}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="12m">Last 12 months</option></select></label></div><div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><strong>Privacy guardrail:</strong> values are server-aggregated. Small groups should be suppressed by the API to prevent re-identification.</div>{state.status === "loading" && <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-3xl bg-white" />)}</div>}{state.status === "error" && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">{state.error}</div>}{state.status === "ready" && <><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metricDefinitions.map(([key, label, type]) => <article key={key} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-4 text-3xl font-bold">{formatMetric(data.metrics?.[key], type, data.currency)}</p></article>)}</section><section className="mt-6 grid gap-6 xl:grid-cols-2"><Breakdown title="Requests by customer country" items={data.requestsByCustomerCountry} /><Breakdown title="Fulfillment outcomes" items={data.fulfillmentOutcomes} /></section><p className="mt-6 text-xs text-slate-500">Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "by the secure reporting service"}. Transaction and status metrics should be derived from authoritative server events.</p></> }</main>;
}
