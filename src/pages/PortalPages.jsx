import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { beneficiariesApi } from "../api/beneficiaries";
import { notificationsApi } from "../api/notifications";
import { ordersApi } from "../api/orders";
import { requestsApi } from "../api/requests";
import { profileApi } from "../api/profile";
import { useAuth } from "../auth/AuthContext";
import { Field } from "../components/AuthShell";
import CountryPicker from "../components/CountryPicker";
import { profileCountry } from "../profile/countries";
import { phoneError } from "../validation/contact";
import { WhatsAppIcon } from "../components/SocialIcons";

const pagePadding = "px-5 py-8 sm:px-8 lg:px-10 lg:py-10";

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.profile?.firstName || user?.firstName || "there";
  const [state, setState] = useState({ status: "loading", beneficiaries: [], requests: [], orders: [], notifications: [], error: "" });

  useEffect(() => {
    let active = true;
    Promise.all([beneficiariesApi.list(), requestsApi.list(), ordersApi.list({ view: "active" }), notificationsApi.list()])
      .then(([beneficiariesResult, requestsResult, ordersResult, notificationsResult]) => {
        if (!active) return;
        setState({ status: "ready", beneficiaries: beneficiariesResult.beneficiaries || [], requests: requestsResult.requests || [], orders: ordersResult.orders || [], notifications: notificationsResult.notifications || [], error: "" });
      })
      .catch((error) => { if (active) setState((current) => ({ ...current, status: "error", error: error.message })); });
    return () => { active = false; };
  }, []);

  const actionRequests = state.requests.filter((request) => request.actionRequired);
  const unreadNotifications = state.notifications.filter((notification) => !notification.readAt);
  const recentActivity = state.notifications.slice(0, 3);
  return (
    <main className={pagePadding}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-bold text-emerald-700">Customer dashboard</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {firstName}</h1><p className="mt-3 text-sm text-slate-600">See what needs your attention and what Hakim Plus is working on.</p></div>
        <Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white" to="/dashboard/requests/new">New medication request</Link>
      </div>
      {state.error && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{state.error}</div>}
      <section className="mt-8 rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-800">Action required</p>
        {state.status === "loading" ? <p className="mt-3 text-sm font-semibold text-amber-900" role="status">Checking your account…</p> : actionRequests.length || unreadNotifications.length ? <><h2 className="mt-3 text-xl font-bold text-amber-950">{actionRequests.length + unreadNotifications.length} update(s) need your attention</h2><div className="mt-4 flex flex-wrap gap-3">{actionRequests.length > 0 && <Link className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white" to="/dashboard/requests?status=needs_action">Review requests</Link>}{unreadNotifications.length > 0 && <Link className="rounded-xl border border-amber-500 bg-white px-4 py-2 text-sm font-bold text-amber-900" to="/dashboard/notifications">Read notifications</Link>}</div></> : <><h2 className="mt-3 text-xl font-bold text-amber-950">Nothing needs your attention</h2><p className="mt-2 text-sm text-amber-900">Quotes, payment requests, and information requests will appear here.</p></>}
      </section>
      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {[["Beneficiaries", state.beneficiaries.length], ["Active requests", state.requests.filter((request) => !request.completed && !["cancelled", "unable_to_fulfill"].includes(request.status)).length], ["Active orders", state.orders.length]].map(([label, value]) => <div key={label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold">{state.status === "loading" ? "—" : value}</p></div>)}
      </div>
      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Beneficiaries</p><h2 className="mt-3 text-xl font-bold">Manage your loved ones</h2><p className="mt-2 text-sm leading-6 text-slate-600">Save contact, consent, and delivery details securely for each person you support.</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-emerald-600 px-4 text-sm font-bold text-emerald-700" to="/dashboard/beneficiaries">View beneficiaries</Link></div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Recent activity</p>{recentActivity.length ? <div className="mt-4 space-y-3">{recentActivity.map((notification) => <div key={notification.id} className="rounded-xl bg-slate-50 p-4"><h2 className="text-sm font-bold">{notification.title}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{notification.message}</p>{notification.actionPath && <Link className="mt-2 inline-flex text-xs font-bold text-emerald-700" to={notification.actionPath}>{notification.actionLabel || "View update"} →</Link>}</div>)}</div> : <><h2 className="mt-3 text-xl font-bold">No account activity yet</h2><p className="mt-2 text-sm leading-6 text-slate-600">Request, quote, payment, and delivery updates will be recorded here.</p></>}</div>
      </section>
    </main>
  );
}

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const selectedCountry = profileCountry(user?.profile);
  const [form, setForm] = useState({ firstName: user?.profile?.firstName || "", lastName: user?.profile?.lastName || "", phone: user?.profile?.phone || "", countryCode: selectedCountry?.code || "" });
  const [action, setAction] = useState({ busy: false, message: "", error: "" });
  const [fieldErrors, setFieldErrors] = useState({});

  async function saveProfile(event) {
    event.preventDefault();
    const invalidPhone = phoneError(form.phone);
    setFieldErrors(invalidPhone ? { phone: invalidPhone } : {});
    if (invalidPhone) return;
    setAction({ busy: true, message: "", error: "" });
    try {
      const result = await profileApi.update(form);
      updateUser(result.user);
      setAction({ busy: false, message: "Profile saved. Your default currency applies to future quotes.", error: "" });
    } catch (error) {
      setAction({ busy: false, message: "", error: error.message });
    }
  }

  return <main className={pagePadding}><p className="text-sm font-bold text-emerald-700">Account</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Profile and security</h1><div className="mt-8 grid gap-6 xl:grid-cols-2"><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Personal information</h2><p className="mt-2 text-sm leading-6 text-slate-600">Your country sets the currency for future pharmacy quotes. Existing paid transactions keep their original currency.</p>{action.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{action.error}</p>}{action.message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{action.message}</p>}<form className="mt-5 space-y-4" onSubmit={saveProfile} noValidate><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">First name<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></label><label className="text-sm font-bold">Last name<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></label></div><label className="block text-sm font-bold">Email<input className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 font-normal text-slate-500" value={user?.email || ""} disabled /></label><Field id="profile-phone" label="Phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 202 555 0123" value={form.phone} error={fieldErrors.phone} onBlur={(event) => setFieldErrors({ phone: phoneError(event.target.value) })} onChange={(event) => { setForm({ ...form, phone: event.target.value }); setFieldErrors({}); }} required /><CountryPicker id="profile-country" value={form.countryCode} onChange={(countryCode) => setForm({ ...form, countryCode })} required /><button className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:bg-slate-300" type="submit" disabled={action.busy}>{action.busy ? "Saving…" : "Save profile"}</button></form></section><div className="space-y-6"><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Security</h2><p className="mt-3 text-sm leading-6 text-slate-600">Password changes, social sign-in, and active-session controls are managed by the secure account service.</p><Link className="mt-5 inline-flex rounded-xl border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-700" to="/dashboard/profile/activity">View account activity</Link></section><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Communication preferences</h2><p className="mt-3 text-sm leading-6 text-slate-600">Choose email, SMS, WhatsApp, language, and time-zone preferences.</p><Link className="mt-5 inline-flex rounded-xl border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-700" to="/dashboard/profile/communication">Manage preferences</Link></section></div></div></main>;
}

export function HelpPage() {
  return <main className={pagePadding}><p className="text-sm font-bold text-emerald-700">Support</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">How can we help?</h1><div className="mt-8 grid gap-5 md:grid-cols-2"><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">How medication requests work</h2><p className="mt-3 text-sm leading-6 text-slate-600">Hakim Plus reviews your request, confirms availability and pricing, then sends a quote. You pay only after approval.</p></section><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Contact Hakim Plus</h2><p className="mt-3 text-sm leading-6 text-slate-600">For general support, contact Hakim Plus on WhatsApp. Do not send prescriptions or sensitive medical details through unsecured channels.</p><a className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white" href="https://wa.me/251971818802" target="_blank" rel="noreferrer"><WhatsAppIcon variant="white" />Open WhatsApp</a></section></div></main>;
}

export function OnboardingPage() {
  const { user, updateUser } = useAuth();
  const nameParts = String(user?.name || "").trim().split(/\s+/);
  const selectedCountry = profileCountry(user?.profile);
  const [form, setForm] = useState({ firstName: user?.profile?.firstName || nameParts[0] || "", lastName: user?.profile?.lastName || nameParts.slice(1).join(" "), phone: user?.profile?.phone || "", countryCode: selectedCountry?.code || "", legalAccepted: Boolean(user?.profile?.legalAcceptedAt) });
  const [action, setAction] = useState({ busy: false, error: "" });
  const [fieldErrors, setFieldErrors] = useState({});

  async function completeProfile(event) {
    event.preventDefault();
    const invalidPhone = phoneError(form.phone);
    setFieldErrors(invalidPhone ? { phone: invalidPhone } : {});
    if (invalidPhone) return;
    setAction({ busy: true, error: "" });
    try {
      const result = await profileApi.update(form);
      updateUser(result.user);
      window.location.assign("/dashboard/beneficiaries/new");
    } catch (error) {
      setAction({ busy: false, error: error.message });
    }
  }

  return <main className="min-h-screen bg-slate-50 px-5 py-10"><div className="mx-auto max-w-3xl"><p className="text-sm font-bold text-emerald-700">Step 1 of 4</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-1/4 rounded-full bg-emerald-600" /></div><section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5"><h1 className="text-3xl font-semibold tracking-tight">Complete your profile</h1><p className="mt-4 text-base leading-7 text-slate-600">Your country determines the currency used for future Hakim Plus quotes.</p>{action.error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{action.error}</p>}<form className="mt-7 space-y-5" onSubmit={completeProfile} noValidate><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold">First name<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></label><label className="text-sm font-bold">Last name<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></label></div><Field id="onboarding-phone" label="Phone number" type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 202 555 0123" value={form.phone} error={fieldErrors.phone} onBlur={(event) => setFieldErrors({ phone: phoneError(event.target.value) })} onChange={(event) => { setForm({ ...form, phone: event.target.value }); setFieldErrors({}); }} required /><CountryPicker id="onboarding-country" value={form.countryCode} onChange={(countryCode) => setForm({ ...form, countryCode })} required /><label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"><input className="mt-1 h-4 w-4 shrink-0 accent-emerald-600" type="checkbox" checked={form.legalAccepted} onChange={(event) => setForm({ ...form, legalAccepted: event.target.checked })} required /><span>By creating an account, you agree to our <Link className="font-bold text-emerald-700" to="/terms">Terms of Use</Link> and <Link className="font-bold text-emerald-700" to="/privacy">Privacy Policy</Link>.</span></label><button className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:bg-slate-300" type="submit" disabled={action.busy || !form.legalAccepted}>{action.busy ? "Saving…" : "Save and add beneficiary"}</button></form></section></div></main>;
}

export function NotFoundPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center"><div><p className="text-sm font-bold text-emerald-700">404</p><h1 className="mt-3 text-3xl font-semibold">We could not find that page</h1><Link className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white" to="/">Return home</Link></div></main>;
}
