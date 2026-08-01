import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const pagePadding = "px-5 py-8 sm:px-8 lg:px-10 lg:py-10";

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.profile?.firstName || user?.firstName || "there";
  return (
    <main className={pagePadding}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-bold text-emerald-700">Customer dashboard</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {firstName}</h1><p className="mt-3 text-sm text-slate-600">See what needs your attention and what Hakim Plus is working on.</p></div>
        <Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white" to="/dashboard/requests/new">New medication request</Link>
      </div>
      <section className="mt-8 rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-800">Action required</p>
        <h2 className="mt-3 text-xl font-bold text-amber-950">Nothing needs your attention</h2>
        <p className="mt-2 text-sm text-amber-900">Quotes, payment requests, and information requests will appear here.</p>
      </section>
      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {[['Beneficiaries', '0'], ['Active requests', '0'], ['Active orders', '0']].map(([label, value]) => <div key={label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold">{value}</p></div>)}
      </div>
      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Beneficiaries</p><h2 className="mt-3 text-xl font-bold">Manage your loved ones</h2><p className="mt-2 text-sm leading-6 text-slate-600">Save contact, consent, and delivery details securely for each person you support.</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-emerald-600 px-4 text-sm font-bold text-emerald-700" to="/dashboard/beneficiaries">View beneficiaries</Link></div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Recent activity</p><h2 className="mt-3 text-xl font-bold">No account activity yet</h2><p className="mt-2 text-sm leading-6 text-slate-600">Request, quote, payment, and delivery updates will be recorded here.</p></div>
      </section>
    </main>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  return <main className={pagePadding}><p className="text-sm font-bold text-emerald-700">Account</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Profile and security</h1><div className="mt-8 grid gap-6 xl:grid-cols-2"><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Personal information</h2><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-slate-500">Name</dt><dd className="mt-1 font-semibold">{user?.name || [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(' ') || 'Not provided'}</dd></div><div><dt className="text-slate-500">Email</dt><dd className="mt-1 font-semibold">{user?.email}</dd></div><div><dt className="text-slate-500">Phone</dt><dd className="mt-1 font-semibold">{user?.profile?.phone || 'Not provided'}</dd></div></dl></section><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Security</h2><p className="mt-3 text-sm leading-6 text-slate-600">Password changes, two-factor authentication, and active-session controls will be provided by the production identity service.</p><Link className="mt-5 inline-flex rounded-xl border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-700" to="/dashboard/profile/activity">View account activity</Link></section><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Communication preferences</h2><p className="mt-3 text-sm leading-6 text-slate-600">Choose email, SMS, WhatsApp, language, and time-zone preferences.</p><Link className="mt-5 inline-flex rounded-xl border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-700" to="/dashboard/profile/communication">Manage preferences</Link></section></div></main>;
}

export function HelpPage() {
  return <main className={pagePadding}><p className="text-sm font-bold text-emerald-700">Support</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">How can we help?</h1><div className="mt-8 grid gap-5 md:grid-cols-2"><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">How medication requests work</h2><p className="mt-3 text-sm leading-6 text-slate-600">Hakim Plus reviews your request, confirms availability and pricing, then sends a quote. You pay only after approval.</p></section><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Contact Hakim Plus</h2><p className="mt-3 text-sm leading-6 text-slate-600">For general support, contact Hakim Plus on WhatsApp. Do not send prescriptions or sensitive medical details through unsecured channels.</p><a className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white" href="https://wa.me/251971818802" target="_blank" rel="noreferrer">Open WhatsApp</a></section></div></main>;
}

export function OnboardingPage() {
  return <main className="min-h-screen bg-slate-50 px-5 py-10"><div className="mx-auto max-w-3xl"><p className="text-sm font-bold text-emerald-700">Step 1 of 4</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-1/4 rounded-full bg-emerald-600" /></div><section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5"><h1 className="text-3xl font-semibold tracking-tight">Welcome to Hakim Plus</h1><p className="mt-4 text-base leading-7 text-slate-600">Manage and pay for medication requests for your loved ones in Ethiopia.</p><ol className="mt-8 grid gap-4 text-sm sm:grid-cols-3"><li className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-900">Complete your profile</li><li className="rounded-2xl bg-slate-50 p-4 font-semibold text-slate-700">Add a beneficiary</li><li className="rounded-2xl bg-slate-50 p-4 font-semibold text-slate-700">Create a request</li></ol><Link className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white" to="/dashboard">Continue to dashboard</Link></section></div></main>;
}

export function NotFoundPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center"><div><p className="text-sm font-bold text-emerald-700">404</p><h1 className="mt-3 text-3xl font-semibold">We could not find that page</h1><Link className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white" to="/">Return home</Link></div></main>;
}
