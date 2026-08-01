import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { notificationsApi } from "../api/notifications";

const pagePadding = "px-5 py-8 sm:px-8 lg:px-10 lg:py-10";

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function ErrorMessage({ message }) { return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">{message}</div>; }

export function NotificationsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState("all");
  const [state, setState] = useState({ status: "loading", notifications: [], nextCursor: "", error: "" });
  const [busy, setBusy] = useState(false);

  async function load(selectedView) {
    setView(selectedView);
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try { const result = await notificationsApi.list({ view: selectedView }); setState({ status: "ready", notifications: result.notifications || result.items || [], nextCursor: result.nextCursor || "", error: "" }); }
    catch (error) { setState({ status: "error", notifications: [], nextCursor: "", error: error.message }); }
  }

  useEffect(() => { let active = true; notificationsApi.list().then((result) => { if (active) setState({ status: "ready", notifications: result.notifications || result.items || [], nextCursor: result.nextCursor || "", error: "" }); }).catch((error) => { if (active) setState({ status: "error", notifications: [], nextCursor: "", error: error.message }); }); return () => { active = false; }; }, []);

  async function loadMore() {
    if (!state.nextCursor) return;
    setBusy(true);
    try { const result = await notificationsApi.list({ view, cursor: state.nextCursor }); setState((current) => ({ ...current, notifications: [...current.notifications, ...(result.notifications || result.items || [])], nextCursor: result.nextCursor || "" })); }
    catch (error) { setState((current) => ({ ...current, error: error.message })); }
    finally { setBusy(false); }
  }

  async function openNotification(notification) {
    if (!notification.readAt) {
      try { await notificationsApi.markRead(notification.publicId || notification.id); setState((current) => ({ ...current, notifications: current.notifications.map((item) => (item.publicId || item.id) === (notification.publicId || notification.id) ? { ...item, readAt: new Date().toISOString() } : item) })); }
      catch (error) { setState((current) => ({ ...current, error: error.message })); return; }
    }
    const target = notification.targetPath?.startsWith("/dashboard/") ? notification.targetPath : "/dashboard/notifications";
    navigate(target);
  }

  async function markAllRead() {
    setBusy(true);
    try { await notificationsApi.markAllRead(); setState((current) => ({ ...current, notifications: current.notifications.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })) })); }
    catch (error) { setState((current) => ({ ...current, error: error.message })); }
    finally { setBusy(false); }
  }

  const unread = state.notifications.filter((item) => !item.readAt).length;
  return <main className={pagePadding}><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-emerald-700">Account updates</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Notifications</h1><p className="mt-3 text-sm text-slate-600">See request, quote, payment, preparation, and delivery events in one place.</p></div><Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700" to="/dashboard/profile/communication">Communication preferences</Link></div><div className="mt-8 flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-xl bg-slate-200 p-1"><button className={`rounded-lg px-4 py-2 text-sm font-bold ${view === "all" ? "bg-white shadow-sm" : "text-slate-600"}`} type="button" onClick={() => load("all")}>All</button><button className={`rounded-lg px-4 py-2 text-sm font-bold ${view === "unread" ? "bg-white shadow-sm" : "text-slate-600"}`} type="button" onClick={() => load("unread")}>Unread</button></div><button className="text-sm font-bold text-emerald-700 disabled:text-slate-400" type="button" disabled={busy || unread === 0} onClick={markAllRead}>Mark all as read</button></div>{state.error && <div className="mt-6"><ErrorMessage message={state.error} /></div>}{state.status === "loading" && <div className="mt-6 h-48 animate-pulse rounded-[2rem] bg-white" />}{state.status === "ready" && state.notifications.length === 0 && <section className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-bold">{view === "unread" ? "You are all caught up" : "No notifications yet"}</h2><p className="mt-2 text-sm text-slate-600">Important account activity will appear here.</p></section>}{state.status === "ready" && state.notifications.length > 0 && <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white">{state.notifications.map((notification) => <button key={notification.publicId || notification.id} className={`flex w-full gap-4 border-b border-slate-100 p-5 text-left transition last:border-0 hover:bg-slate-50 ${notification.readAt ? "bg-white" : "bg-emerald-50/60"}`} type="button" onClick={() => openNotification(notification)}><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${notification.readAt ? "bg-slate-200" : "bg-emerald-600"}`} aria-label={notification.readAt ? "Read" : "Unread"} /><span className="min-w-0 flex-1"><span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><strong className="text-sm text-slate-950">{notification.title}</strong><span className="text-xs text-slate-500">{formatDate(notification.createdAt)}</span></span><span className="mt-2 block text-sm leading-6 text-slate-600">{notification.message}</span>{notification.actionLabel && <span className="mt-3 inline-block text-xs font-bold text-emerald-700">{notification.actionLabel} →</span>}</span></button>)}{state.nextCursor && <div className="p-4 text-center"><button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700" type="button" disabled={busy} onClick={loadMore}>{busy ? "Loading…" : "Load more"}</button></div>}</section>}<p className="mt-5 text-xs leading-5 text-slate-500">Email, SMS, and WhatsApp notifications should contain secure account links and minimal sensitive detail.</p>
  </main>;
}

export function CommunicationPreferencesPage() {
  const [state, setState] = useState({ status: "loading", preferences: null, error: "", message: "" });
  useEffect(() => { let active = true; notificationsApi.getPreferences().then((result) => { if (active) setState({ status: "ready", preferences: result.preferences || result, error: "", message: "" }); }).catch((error) => { if (active) setState({ status: "error", preferences: null, error: error.message, message: "" }); }); return () => { active = false; }; }, []);
  function update(name, value) { setState((current) => ({ ...current, preferences: { ...current.preferences, [name]: value }, message: "" })); }
  async function save(event) { event.preventDefault(); setState((current) => ({ ...current, status: "saving", error: "", message: "" })); try { const result = await notificationsApi.updatePreferences(state.preferences); setState({ status: "ready", preferences: result.preferences || result, error: "", message: "Preferences saved." }); } catch (error) { setState((current) => ({ ...current, status: "ready", error: error.message, message: "" })); } }
  if (state.status === "loading") return <main className="grid min-h-screen place-items-center bg-slate-50" role="status"><p className="font-semibold text-slate-600">Loading preferences…</p></main>;
  if (state.status === "error" && !state.preferences) return <main className={pagePadding}><ErrorMessage message={state.error} /></main>;
  const preferences = state.preferences;
  return <main className={pagePadding}><Link className="text-sm font-bold text-slate-500" to="/dashboard/profile">← Profile</Link><div className="mt-5"><p className="text-sm font-bold text-emerald-700">Communication</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Notification preferences</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Choose how Hakim Plus contacts you. Essential security and in-app transaction records remain available in your account.</p></div>{state.error && <div className="mt-6"><ErrorMessage message={state.error} /></div>}{state.message && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900" role="status">{state.message}</div>}<form className="mt-8 max-w-3xl space-y-6" onSubmit={save}><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Delivery channels</h2><div className="mt-5 space-y-4">{[["emailEnabled","Email","Verification, quotes, payments, and delivery links"],["smsEnabled","SMS","Short account alerts without medication details"],["whatsappEnabled","WhatsApp","Account alerts when an approved integration is available"]].map(([name,label,description]) => <label key={name} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4"><input className="mt-1 h-5 w-5 accent-emerald-600" type="checkbox" checked={Boolean(preferences[name])} onChange={(event) => update(name, event.target.checked)} /><span><strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span></label>)}</div></section><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Language and timing</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold">Preferred language<select className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" value={preferences.preferredLanguage || "en"} onChange={(event) => update("preferredLanguage", event.target.value)}><option value="en">English</option><option value="am">Amharic</option><option value="om">Afaan Oromo</option></select></label><label className="text-sm font-bold">Time zone<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" value={preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} onChange={(event) => update("timezone", event.target.value)} /></label></div></section><button className="min-h-12 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white disabled:bg-slate-300" type="submit" disabled={state.status === "saving"}>{state.status === "saving" ? "Saving…" : "Save preferences"}</button></form>
  </main>;
}
