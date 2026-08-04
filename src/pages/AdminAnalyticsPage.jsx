import { useEffect, useMemo, useState } from "react";
import { analyticsApi } from "../api/governance";

const metricDefinitions = [
  { key: "customers", label: "All customers", detail: "customers", hint: "View customer names" },
  { key: "newCustomers", label: "New users", hint: "Registered in this period" },
  { key: "activeCustomers", label: "Active customers", hint: "Submitted a request in this period" },
  { key: "beneficiaries", label: "All beneficiaries", detail: "beneficiaries", hint: "View beneficiary names" },
  { key: "newBeneficiaries", label: "New beneficiaries", hint: "Added in this period" },
  { key: "requestsSubmitted", label: "Requests submitted" },
  { key: "requestsFulfilled", label: "Requests fulfilled" },
  { key: "paymentsConfirmed", label: "Payments confirmed" },
  { key: "quoteApprovalRate", label: "Quote approval rate", type: "percent" },
  { key: "repeatCustomerRate", label: "Repeat customer rate", type: "percent" },
  { key: "medianFulfillmentHours", label: "Median fulfillment time", type: "hours" },
];

function formatMetric(value, type, currency = "USD") {
  if (value === undefined || value === null) return "—";
  if (type === "percent") return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  if (type === "money") return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value));
  if (type === "hours") return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs`;
  return Number(value).toLocaleString();
}

function formatDate(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function Breakdown({ title, items = [] }) {
  return <section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">{title}</h2>{items.length ? <div className="mt-5 space-y-4">{items.map((item) => <div key={item.key || item.label}><div className="flex justify-between gap-4 text-sm"><span className="font-semibold text-slate-700">{item.label}</span><span className="font-bold">{Number(item.value || 0).toLocaleString()}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, Number(item.percent || 0)))}%` }} /></div></div>)}</div> : <p className="mt-4 text-sm text-slate-600">No aggregate data is available for this period.</p>}</section>;
}

function MetricCard({ definition, value, expanded, onOpen }) {
  const content = <><p className="text-sm font-semibold text-slate-500">{definition.label}</p><p className="mt-4 text-3xl font-bold">{formatMetric(value, definition.type)}</p>{definition.hint && <p className={`mt-3 text-xs font-semibold ${definition.detail ? "text-emerald-700" : "text-slate-500"}`}>{definition.hint}{definition.detail ? " →" : ""}</p>}</>;
  if (!definition.detail) return <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">{content}</article>;
  return <button className={`rounded-3xl border bg-white p-6 text-left shadow-sm transition hover:border-emerald-500 hover:shadow-md ${expanded ? "border-emerald-500 ring-4 ring-emerald-500/10" : "border-slate-200"}`} type="button" aria-expanded={expanded} aria-controls="analytics-detail-panel" onClick={() => onOpen(definition.detail)}>{content}</button>;
}

function DetailPanel({ detail, search, setSearch, onClose }) {
  const filteredItems = useMemo(() => {
    const items = detail.items || [];
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => Object.values(item).some((value) => typeof value === "string" && value.toLowerCase().includes(query)));
  }, [detail.items, search]);

  const title = detail.type === "customers" ? "Customer directory" : "Beneficiary directory";
  return <section id="analytics-detail-panel" className="mt-6 overflow-hidden rounded-[2rem] border border-emerald-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Admin-only details</p><h2 className="mt-2 text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-slate-600">Showing up to 500 records. “New” means added during the selected reporting period.</p></div><button className="self-start rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700" type="button" onClick={onClose}>Close</button></div>{detail.status === "loading" && <div className="m-6 h-36 animate-pulse rounded-2xl bg-slate-100" role="status" />}{detail.status === "error" && <p className="m-6 rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">{detail.error}</p>}{detail.status === "ready" && <><div className="p-5"><label className="block max-w-md text-sm font-bold text-slate-700">Search this list<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, country, or city" /></label></div><div className="overflow-x-auto">{detail.type === "customers" ? <table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Customer</th><th className="p-4">Country</th><th className="p-4">Beneficiaries</th><th className="p-4">Requests</th><th className="p-4">Joined</th><th className="p-4">Last activity</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredItems.map((customer) => <tr key={customer.id}><td className="p-4"><p className="font-bold">{customer.name}</p><p className="mt-1 text-xs text-slate-500">{customer.email}</p>{customer.newInPeriod && <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">NEW USER</span>}</td><td className="p-4"><p>{customer.country}</p><p className="mt-1 text-xs font-bold text-slate-500">{customer.currency}</p></td><td className="p-4 font-bold">{customer.beneficiaryCount}</td><td className="p-4 font-bold">{customer.requestCount}</td><td className="p-4 text-slate-600">{formatDate(customer.createdAt)}</td><td className="p-4 text-slate-600">{formatDate(customer.lastActivityAt)}</td></tr>)}{!filteredItems.length && <tr><td className="p-8 text-center text-slate-500" colSpan="6">No customers match this search.</td></tr>}</tbody></table> : <table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Beneficiary</th><th className="p-4">Customer</th><th className="p-4">Location</th><th className="p-4">Requests</th><th className="p-4">Status</th><th className="p-4">Added</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredItems.map((beneficiary) => <tr key={beneficiary.id}><td className="p-4"><p className="font-bold">{beneficiary.name}</p><p className="mt-1 text-xs text-slate-500">{beneficiary.relationship}</p>{beneficiary.newInPeriod && <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">NEW</span>}</td><td className="p-4"><p className="font-semibold">{beneficiary.customerName}</p><p className="mt-1 text-xs text-slate-500">{beneficiary.customerEmail}</p></td><td className="p-4">{beneficiary.city}</td><td className="p-4 font-bold">{beneficiary.requestCount}</td><td className="p-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${beneficiary.archived ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-800"}`}>{beneficiary.archived ? "Archived" : "Active"}</span></td><td className="p-4 text-slate-600">{formatDate(beneficiary.createdAt)}</td></tr>)}{!filteredItems.length && <tr><td className="p-8 text-center text-slate-500" colSpan="6">No beneficiaries match this search.</td></tr>}</tbody></table>}</div></>}</section>;
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState("30d");
  const [state, setState] = useState({ status: "loading", data: null, error: "" });
  const [detail, setDetail] = useState({ type: "", status: "idle", items: [], error: "" });
  const [detailSearch, setDetailSearch] = useState("");

  useEffect(() => {
    let active = true;
    analyticsApi.overview(range).then((result) => { if (active) setState({ status: "ready", data: result.analytics || result, error: "" }); }).catch((error) => { if (active) setState({ status: "error", data: null, error: error.message }); });
    return () => { active = false; };
  }, [range]);

  async function openDetails(type) {
    if (detail.type === type && detail.status !== "error") return setDetail({ type: "", status: "idle", items: [], error: "" });
    setDetailSearch("");
    setDetail({ type, status: "loading", items: [], error: "" });
    try {
      const result = await analyticsApi[type](range);
      setDetail({ type, status: "ready", items: result[type] || [], error: "" });
    } catch (error) {
      setDetail({ type, status: "error", items: [], error: error.message });
    }
  }

  const data = state.data || {};
  return <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-emerald-700">Business intelligence</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Operational analytics</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Monitor registrations, beneficiaries, requests, quotes, payments, and delivery outcomes.</p></div><label className="text-sm font-bold text-slate-700">Reporting period<select className="ml-3 rounded-xl border border-slate-300 bg-white px-4 py-3" value={range} onChange={(event) => { setState({ status: "loading", data: null, error: "" }); setDetail({ type: "", status: "idle", items: [], error: "" }); setRange(event.target.value); }}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="12m">Last 12 months</option></select></label></div><div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><strong>Privacy guardrail:</strong> summary cards are aggregated. Customer and beneficiary names are available only through the administrator-only directories and never include medication, prescription, or message content.</div>{state.status === "loading" && <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-3xl bg-white" />)}</div>}{state.status === "error" && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">{state.error}</div>}{state.status === "ready" && <><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metricDefinitions.map((definition) => <MetricCard key={definition.key} definition={definition} value={data.metrics?.[definition.key]} expanded={detail.type === definition.detail} onOpen={openDetails} />)}</section>{detail.type && <DetailPanel detail={detail} search={detailSearch} setSearch={setDetailSearch} onClose={() => setDetail({ type: "", status: "idle", items: [], error: "" })} />}<section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Average order value by currency</h2><p className="mt-2 text-sm text-slate-600">Values are kept separate because totals in different currencies must not be combined without an exchange-rate ledger.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.averageOrderValues?.length ? data.averageOrderValues.map((item) => <div key={item.currency} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{item.currency} · {item.orderCount} order(s)</p><p className="mt-2 text-xl font-bold">{new Intl.NumberFormat(undefined, { style: "currency", currency: item.currency }).format(item.amountMinor / 100)}</p></div>) : <p className="text-sm text-slate-600">No paid orders in this period.</p>}</div></section><section className="mt-6 grid gap-6 xl:grid-cols-2"><Breakdown title="Requests by customer country" items={data.requestsByCustomerCountry} /><Breakdown title="Fulfillment outcomes" items={data.fulfillmentOutcomes} /></section><p className="mt-6 text-xs text-slate-500">Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "by the secure reporting service"}. Transaction and status metrics are derived from authoritative server events.</p></> }</main>;
}
