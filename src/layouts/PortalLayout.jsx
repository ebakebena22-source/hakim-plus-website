import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Brand } from "../components/AuthShell";

const navigation = [
  { to: "/dashboard", label: "Dashboard", end: true },
  { to: "/dashboard/requests", label: "Requests" },
  { to: "/dashboard/orders", label: "Orders" },
  { to: "/dashboard/payments", label: "Payments" },
  { to: "/dashboard/notifications", label: "Notifications" },
  { to: "/dashboard/beneficiaries", label: "Beneficiaries" },
  { to: "/dashboard/profile", label: "Profile" },
  { to: "/dashboard/help", label: "Help" },
];

const mobileNavigation = navigation.filter((item) => ["Dashboard", "Requests", "Orders", "Beneficiaries", "Payments"].includes(item.label));

function navigationClass({ isActive }) {
  return `flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold transition ${isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`;
}

export default function PortalLayout() {
  const auth = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between"><Brand /><Link className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800" to="/dashboard/notifications">Notifications</Link></div>
      </header>
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-6 lg:flex lg:flex-col">
          <Brand />
          <p className="mt-10 px-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Your account</p>
          <nav className="mt-3 space-y-1" aria-label="Customer portal">{navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={navigationClass}>{item.label}</NavLink>)}</nav>
          <div className="mt-auto rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-xs text-slate-400">Signed in as</p>
            <p className="mt-1 truncate text-sm font-bold">{auth.user?.email}</p>
            <button className="mt-4 text-sm font-bold text-emerald-300 hover:text-emerald-200" type="button" onClick={handleLogout}>Log out</button>
          </div>
        </aside>
        <div id="main-content" className="min-w-0 flex-1 pb-24 lg:pb-0" tabIndex="-1"><Outlet /></div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white p-2 shadow-2xl lg:hidden" aria-label="Mobile portal navigation">
        {mobileNavigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `grid min-h-14 place-items-center rounded-xl text-xs font-bold ${isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-500"}`}>{item.label}</NavLink>)}
      </nav>
    </div>
  );
}
