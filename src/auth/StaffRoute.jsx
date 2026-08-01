import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { canAccessStaffPortal, staffRoles } from "./staffRoles";

export default function StaffRoute({ children, allowedRoles = staffRoles }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "loading") {
    return <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-white" role="status"><p className="font-semibold">Checking staff access…</p></main>;
  }
  if (!auth.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!canAccessStaffPortal(auth.user, allowedRoles)) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center"><div className="max-w-md"><p className="text-sm font-bold text-red-700">Access denied</p><h1 className="mt-3 text-3xl font-semibold">Staff permission required</h1><p className="mt-3 text-sm leading-6 text-slate-600">Your signed-in account does not have permission to access Hakim Plus pharmacy operations.</p><Link className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white" to="/dashboard">Return to customer dashboard</Link></div></main>;
  }
  return children;
}
