import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import BrandLogo from "../components/BrandLogo";

function navClass({ isActive }) {
  return `flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold transition ${isActive ? "bg-emerald-500 text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"}`;
}

export default function AdminLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const roles = (auth.user?.staffRoles || auth.user?.roles || []).map((role) => typeof role === "string" ? role : role.name || role.code).filter(Boolean);
  const canManageRequests = roles.some((role) => ["admin", "pharmacist", "customer_support"].includes(role));
  const canManageOrders = roles.some((role) => ["admin", "pharmacist", "fulfillment", "delivery_operations"].includes(role));
  const isAdmin = roles.includes("admin");
  const navigation = [
    { to: "/admin", label: "Operations dashboard", end: true },
    ...(canManageRequests ? [{ to: "/admin/requests", label: "Medication requests" }] : []),
    ...(canManageOrders ? [{ to: "/admin/orders", label: "Orders & delivery" }] : []),
    ...(roles.some((role) => ["admin", "pharmacist"].includes(role)) ? [{ to: "/admin/bank-transfers", label: "Bank transfers" }] : []),
    ...(isAdmin ? [{ to: "/admin/analytics", label: "Analytics" }, { to: "/admin/audit-logs", label: "Audit logs" }, { to: "/admin/security", label: "Security" }] : []),
  ];

  async function logout() {
    await auth.signOut();
    navigate("/login", { replace: true });
  }

  return <div className="min-h-screen bg-slate-100 text-slate-950">
    <a className="skip-link" href="#admin-main-content">Skip to main content</a>
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 px-5 py-4 text-white lg:hidden"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><BrandLogo className="h-10 w-10 rounded-xl" /><div><p className="text-sm font-extrabold">Hakim Plus</p><p className="text-xs text-emerald-300">Pharmacy operations</p></div></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">Staff</span></div></header>
    <div className="mx-auto flex min-h-screen max-w-[1700px]"><aside className="hidden w-72 shrink-0 bg-slate-950 p-6 text-white lg:flex lg:flex-col"><div className="flex items-center gap-3"><BrandLogo className="h-12 w-12 rounded-2xl" /><div><p className="text-lg font-extrabold">Hakim Plus</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Pharmacy operations</p></div></div><nav className="mt-10 space-y-2" aria-label="Staff operations">{navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>{item.label}</NavLink>)}</nav><div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">Signed in as</p><p className="mt-1 truncate text-sm font-bold">{auth.user?.email}</p><p className="mt-2 text-xs capitalize text-emerald-300">{roles.join(", ").replaceAll("_", " ")}</p><button className="mt-4 text-sm font-bold text-white hover:text-emerald-300" type="button" onClick={logout}>Log out</button></div></aside><div id="admin-main-content" className="min-w-0 flex-1 pb-20 lg:pb-0" tabIndex="-1"><Outlet /></div></div>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-slate-800 bg-slate-950 p-2 lg:hidden" style={{ gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))` }} aria-label="Mobile staff navigation">{navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `grid min-h-14 place-items-center rounded-xl px-1 text-center text-[11px] font-bold ${isActive ? "bg-emerald-500 text-slate-950" : "text-slate-300"}`}>{item.label}</NavLink>)}</nav>
  </div>;
}
