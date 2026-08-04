import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getRoleNames } from "../auth/staffRoles";

const cardDefinitions = [
  { key: "medicationRequests", label: "Medication requests", path: "/admin/requests", area: "requests", detail: "requiring pharmacy action" },
  { key: "bankTransfers", label: "Bank transfers", path: "/admin/bank-transfers", area: "transfers", detail: "awaiting verification" },
  { key: "ordersDelivery", label: "Orders & delivery", path: "/admin/orders", area: "orders", detail: "requiring fulfillment action" },
  { key: "completedOrders", label: "Completed orders", path: "/admin/completed-orders", area: "orders", detail: "in the completed archive" },
];

export default function AdminDashboardPage() {
  const auth = useAuth();
  const roles = getRoleNames(auth.user);
  const canManageRequests = roles.some((role) => ["admin", "pharmacist", "customer_support"].includes(role));
  const canManageTransfers = roles.some((role) => ["admin", "pharmacist"].includes(role));
  const canManageOrders = roles.some((role) => ["admin", "pharmacist", "fulfillment", "delivery_operations"].includes(role));
  const visibleCards = cardDefinitions.filter(({ area }) => (
    area === "requests" ? canManageRequests : area === "transfers" ? canManageTransfers : canManageOrders
  ));
  const { actionCounts, actionCountsStatus, actionCountsError } = useOutletContext();

  return <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
    <div>
      <p className="text-sm font-bold text-emerald-700">Pharmacy operations</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Operational dashboard</h1>
      <p className="mt-3 text-sm text-slate-600">Open a queue to review the items that need attention.</p>
    </div>
    {actionCountsStatus === "loading" && <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading operation counts">{Array.from({ length: visibleCards.length }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-3xl bg-white" />)}</section>}
    {actionCountsStatus === "error" && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">{actionCountsError}</div>}
    {actionCountsStatus === "ready" && <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Operational queues">
      {visibleCards.map(({ key, label, path, detail }) => <Link key={key} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-lg" to={path}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-slate-700">{label}</h2>
          <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-emerald-100 px-3 py-1 text-lg font-extrabold text-emerald-900" aria-label={`${actionCounts[key] || 0} ${detail}`}>{actionCounts[key] || 0}</span>
        </div>
        <p className="mt-5 text-sm text-slate-500">{detail}</p>
      </Link>)}
    </section>}
  </main>;
}
