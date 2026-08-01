import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/admin";

const metricDefinitions = [
  ["newRequests", "New requests", "/admin/requests?queue=new"],
  ["awaitingReview", "Awaiting review", "/admin/requests?queue=awaiting_review"],
  ["beneficiaryContact", "Need beneficiary contact", "/admin/requests?queue=beneficiary_contact"],
  ["awaitingQuote", "Awaiting quote", "/admin/requests?queue=awaiting_quote"],
  ["awaitingApproval", "Awaiting customer approval", "/admin/requests?queue=awaiting_approval"],
  ["paymentsReceived", "Payments received", "/admin/orders?queue=active"],
  ["preparingOrders", "Orders being prepared", "/admin/orders?queue=preparing"],
  ["awaitingDelivery", "Awaiting delivery", "/admin/orders?queue=ready_for_delivery"],
  ["outForDelivery", "Out for delivery", "/admin/orders?queue=out_for_delivery"],
];

export default function AdminDashboardPage() {
  const [state, setState] = useState({ status: "loading", dashboard: null, error: "" });
  useEffect(() => { let active = true; adminApi.dashboard().then((result) => { if (active) setState({ status: "ready", dashboard: result.dashboard || result, error: "" }); }).catch((error) => { if (active) setState({ status: "error", dashboard: null, error: error.message }); }); return () => { active = false; }; }, []);

  return <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-emerald-700">Pharmacy operations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Operational dashboard</h1><p className="mt-3 text-sm text-slate-600">Prioritize requests requiring review, contact, quoting, or fulfillment action.</p></div><Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-bold text-white" to="/admin/requests">Open request queue</Link></div>{state.status === "loading" && <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-3xl bg-white" />)}</div>}{state.status === "error" && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">{state.error}</div>}{state.status === "ready" && <><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metricDefinitions.map(([key,label,path]) => <Link key={key} className={`rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${state.dashboard.overdueByQueue?.[key] ? "border-red-300" : "border-slate-200"}`} to={path}><div className="flex items-start justify-between"><p className="text-sm font-semibold text-slate-600">{label}</p>{state.dashboard.overdueByQueue?.[key] > 0 && <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">{state.dashboard.overdueByQueue[key]} overdue</span>}</div><p className="mt-4 text-4xl font-bold">{state.dashboard.metrics?.[key] ?? state.dashboard[key] ?? 0}</p></Link>)}</section><section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Service-level attention</h2><p className="mt-2 text-sm text-slate-600">Overdue flags must come from server-configured pharmacy response targets, not browser time calculations.</p><div className="mt-5 flex flex-wrap gap-3"><span className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700">{state.dashboard.totalOverdue || 0} overdue requests</span><span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800">{state.dashboard.urgentRequests || 0} urgent flags</span></div></section></>}
  </main>;
}
