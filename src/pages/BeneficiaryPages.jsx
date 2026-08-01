import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { beneficiariesApi } from "../api/beneficiaries";
import { Field, primaryButtonClass } from "../components/AuthShell";
import { emptyBeneficiary, validateBeneficiary } from "../beneficiaries/beneficiarySchema";

const pagePadding = "px-5 py-8 sm:px-8 lg:px-10 lg:py-10";

function PageHeader({ eyebrow, title, description, action }) {
  return <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-emerald-700">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>}</div>{action}</div>;
}

function LoadingState() {
  return <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-8" role="status"><div className="h-5 w-40 animate-pulse rounded bg-slate-200" /><div className="mt-5 h-24 animate-pulse rounded-2xl bg-slate-100" /></div>;
}

function ErrorState({ message, onRetry }) {
  return <div className="mt-8 rounded-[2rem] border border-red-200 bg-red-50 p-6" role="alert"><h2 className="font-bold text-red-950">We could not load beneficiary information</h2><p className="mt-2 text-sm text-red-800">{message}</p>{onRetry && <button className="mt-4 rounded-xl bg-red-800 px-4 py-2 text-sm font-bold text-white" type="button" onClick={onRetry}>Try again</button>}</div>;
}

export function BeneficiariesPage() {
  const [state, setState] = useState({ status: "loading", beneficiaries: [], error: "" });

  async function load() {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const result = await beneficiariesApi.list();
      setState({ status: "ready", beneficiaries: result.beneficiaries || result.items || [], error: "" });
    } catch (error) {
      setState({ status: "error", beneficiaries: [], error: error.message });
    }
  }

  useEffect(() => {
    let active = true;
    beneficiariesApi.list().then((result) => {
      if (active) setState({ status: "ready", beneficiaries: result.beneficiaries || result.items || [], error: "" });
    }).catch((error) => {
      if (active) setState({ status: "error", beneficiaries: [], error: error.message });
    });
    return () => { active = false; };
  }, []);

  return <main className={pagePadding}>
    <PageHeader eyebrow="Your loved ones" title="Beneficiaries" description="Save contact and delivery details once, then select the right person when creating a medication request." action={<Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20" to="/dashboard/beneficiaries/new">Add beneficiary</Link>} />
    {state.status === "loading" && <LoadingState />}
    {state.status === "error" && <ErrorState message={state.error} onRetry={load} />}
    {state.status === "ready" && state.beneficiaries.length === 0 && <section className="mt-8 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-2xl font-bold text-emerald-700">+</div><h2 className="mt-5 text-xl font-bold">You haven&apos;t added anyone yet</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Add the person in Ethiopia you want Hakim Plus to support.</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white" to="/dashboard/beneficiaries/new">Add your first beneficiary</Link></section>}
    {state.status === "ready" && state.beneficiaries.length > 0 && <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{state.beneficiaries.map((beneficiary) => <article key={beneficiary.id || beneficiary.publicId} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xl font-bold">{beneficiary.fullName}</p><p className="mt-1 text-sm text-slate-500">{beneficiary.relationship}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{beneficiary.activeRequestCount || 0} active</span></div><dl className="mt-6 space-y-3 text-sm"><div><dt className="text-slate-500">Phone</dt><dd className="mt-1 font-semibold">{beneficiary.phone}</dd></div><div><dt className="text-slate-500">Location</dt><dd className="mt-1 font-semibold">{[beneficiary.city, beneficiary.country].filter(Boolean).join(", ")}</dd></div></dl><div className="mt-6 flex gap-3"><Link className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-bold text-slate-700" to={`/dashboard/beneficiaries/${encodeURIComponent(beneficiary.publicId || beneficiary.id)}`}>View</Link><Link className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-center text-sm font-bold text-white" to={`/dashboard/requests/new?beneficiary=${encodeURIComponent(beneficiary.publicId || beneficiary.id)}`}>Create request</Link></div></article>)}</section>}
  </main>;
}

function TextAreaField({ id, label, error, ...props }) {
  return <label className="block text-sm font-semibold text-slate-800" htmlFor={id}>{label}<textarea id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-100" {...props} />{error && <span id={`${id}-error`} className="mt-2 block text-xs font-medium text-red-700">{error}</span>}</label>;
}

function SelectField({ id, label, children, ...props }) {
  return <label className="block text-sm font-semibold text-slate-800" htmlFor={id}>{label}<select id={id} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10" {...props}>{children}</select></label>;
}

function Section({ title, description, children }) {
  return <section className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">{title}</h2>{description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}<div className="mt-6 grid gap-5 sm:grid-cols-2">{children}</div></section>;
}

export function BeneficiaryFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyBeneficiary);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(editing ? "loading" : "ready");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!editing) return;
    beneficiariesApi.get(id).then((result) => { setForm({ ...emptyBeneficiary, ...(result.beneficiary || result) }); setStatus("ready"); }).catch((error) => { setSubmitError(error.message); setStatus("error"); });
  }, [editing, id]);

  function update(name, value) { setForm((current) => ({ ...current, [name]: value })); }

  async function handleSubmit(event) {
    event.preventDefault();
    const result = validateBeneficiary(form);
    setErrors(result.errors);
    setSubmitError("");
    if (!result.valid) { document.getElementById(Object.keys(result.errors)[0])?.focus(); return; }
    const payload = result.beneficiary.preferNotToProvideMedicalInfo ? { ...result.beneficiary, knownAllergies: "", currentMedications: "", chronicConditions: "", medicalNotes: "" } : result.beneficiary;
    setStatus("saving");
    try {
      const saved = editing ? await beneficiariesApi.update(id, payload) : await beneficiariesApi.create(payload);
      const savedId = saved.beneficiary?.publicId || saved.beneficiary?.id || saved.publicId || saved.id || id;
      navigate(`/dashboard/beneficiaries/${encodeURIComponent(savedId)}`, { replace: true });
    } catch (error) {
      setSubmitError(error.message);
      setStatus("ready");
    }
  }

  if (status === "loading") return <main className={pagePadding}><LoadingState /></main>;
  if (status === "error") return <main className={pagePadding}><ErrorState message={submitError} /></main>;

  return <main className={pagePadding}><PageHeader eyebrow="Beneficiary profile" title={editing ? "Edit beneficiary" : "Add a beneficiary"} description="Only provide information Hakim Plus needs to verify requests, contact the beneficiary, and arrange delivery." />
    <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
      {submitError && <ErrorState message={submitError} />}
      <Section title="Basic information"><Field id="fullName" label="Full name" required value={form.fullName} error={errors.fullName} onChange={(event) => update("fullName", event.target.value)} /><Field id="relationship" label="Relationship to you" required placeholder="Mother, father, sibling…" value={form.relationship} error={errors.relationship} onChange={(event) => update("relationship", event.target.value)} /><Field id="dateOfBirth" label="Date of birth (if known)" type="date" value={form.dateOfBirth || ""} onChange={(event) => update("dateOfBirth", event.target.value)} /><Field id="age" label="Approximate age" inputMode="numeric" value={form.age || ""} error={errors.age} onChange={(event) => update("age", event.target.value)} /><SelectField id="sex" label="Sex" value={form.sex} onChange={(event) => update("sex", event.target.value)}><option value="female">Female</option><option value="male">Male</option><option value="prefer-not-to-provide">Prefer not to provide</option></SelectField><Field id="email" label="Email (optional)" type="email" value={form.email || ""} onChange={(event) => update("email", event.target.value)} /></Section>
      <Section title="Contact information"><Field id="phone" label="Phone number" type="tel" required value={form.phone} error={errors.phone} onChange={(event) => update("phone", event.target.value)} /><Field id="alternativePhone" label="Alternative phone (optional)" type="tel" value={form.alternativePhone || ""} onChange={(event) => update("alternativePhone", event.target.value)} /></Section>
      <Section title="Delivery location" description="Country defaults to Ethiopia. Add enough detail for Hakim Plus to confirm serviceability and delivery."><Field id="country" label="Country" value={form.country} onChange={(event) => update("country", event.target.value)} /><Field id="city" label="City" required value={form.city} error={errors.city} onChange={(event) => update("city", event.target.value)} /><Field id="subCity" label="Sub-city" value={form.subCity || ""} onChange={(event) => update("subCity", event.target.value)} /><Field id="woreda" label="Woreda" value={form.woreda || ""} onChange={(event) => update("woreda", event.target.value)} /><Field id="neighborhood" label="Neighborhood" value={form.neighborhood || ""} onChange={(event) => update("neighborhood", event.target.value)} /><Field id="landmark" label="Nearby landmark" value={form.landmark || ""} onChange={(event) => update("landmark", event.target.value)} /><div className="sm:col-span-2"><TextAreaField id="deliveryAddress" label="Delivery address" required value={form.deliveryAddress} error={errors.deliveryAddress} onChange={(event) => update("deliveryAddress", event.target.value)} /></div><div className="sm:col-span-2"><TextAreaField id="deliveryInstructions" label="Delivery instructions (optional)" value={form.deliveryInstructions || ""} onChange={(event) => update("deliveryInstructions", event.target.value)} /></div></Section>
      <Section title="Relevant medical information" description="This information is optional. Provide only what may help the pharmacy safely review future requests."><label className="sm:col-span-2 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><input className="mt-1 h-4 w-4 accent-emerald-600" type="checkbox" checked={form.preferNotToProvideMedicalInfo} onChange={(event) => update("preferNotToProvideMedicalInfo", event.target.checked)} /><span><strong className="block text-slate-900">Prefer not to provide medical information</strong>These optional fields will be omitted from the saved record.</span></label><TextAreaField id="knownAllergies" label="Known allergies" disabled={form.preferNotToProvideMedicalInfo} value={form.knownAllergies || ""} onChange={(event) => update("knownAllergies", event.target.value)} /><TextAreaField id="currentMedications" label="Current medications" disabled={form.preferNotToProvideMedicalInfo} value={form.currentMedications || ""} onChange={(event) => update("currentMedications", event.target.value)} /><TextAreaField id="chronicConditions" label="Relevant chronic conditions" disabled={form.preferNotToProvideMedicalInfo} value={form.chronicConditions || ""} onChange={(event) => update("chronicConditions", event.target.value)} /><TextAreaField id="medicalNotes" label="Important medical notes" disabled={form.preferNotToProvideMedicalInfo} value={form.medicalNotes || ""} onChange={(event) => update("medicalNotes", event.target.value)} /></Section>
      <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6"><label className="flex items-start gap-3 text-sm leading-6 text-emerald-950"><input id="contactConsent" className="mt-1 h-5 w-5 shrink-0 accent-emerald-600" type="checkbox" checked={form.contactConsent} onChange={(event) => update("contactConsent", event.target.checked)} /><span><strong className="block">Contact authorization</strong>I authorize Hakim Plus Pharmacy to contact this beneficiary regarding medication requests I submit on their behalf.</span></label>{errors.contactConsent && <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{errors.contactConsent}</p>}<p className="mt-3 text-xs leading-5 text-emerald-800">The server must record the customer ID, consent text version, and timestamp when this form is saved.</p></section>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700" to={editing ? `/dashboard/beneficiaries/${encodeURIComponent(id)}` : "/dashboard/beneficiaries"}>Cancel</Link><button className={`${primaryButtonClass} sm:w-auto`} type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving securely…" : editing ? "Save changes" : "Add beneficiary"}</button></div>
    </form>
  </main>;
}

function DetailItem({ label, value, sensitive = false }) {
  return <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</dt><dd className={`mt-2 whitespace-pre-wrap text-sm font-semibold ${sensitive ? "text-slate-700" : "text-slate-950"}`}>{value || "Not provided"}</dd></div>;
}

export function BeneficiaryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", beneficiary: null, error: "" });

  useEffect(() => { beneficiariesApi.get(id).then((result) => setState({ status: "ready", beneficiary: result.beneficiary || result, error: "" })).catch((error) => setState({ status: "error", beneficiary: null, error: error.message })); }, [id]);

  async function archiveBeneficiary() {
    if (!window.confirm("Archive this beneficiary? Their previous request and order records will remain available.")) return;
    try { await beneficiariesApi.archive(id); navigate("/dashboard/beneficiaries", { replace: true }); } catch (error) { setState((current) => ({ ...current, error: error.message })); }
  }

  if (state.status === "loading") return <main className={pagePadding}><LoadingState /></main>;
  if (state.status === "error") return <main className={pagePadding}><ErrorState message={state.error} /></main>;
  const beneficiary = state.beneficiary;
  return <main className={pagePadding}><PageHeader eyebrow="Beneficiary profile" title={beneficiary.fullName} description={`${beneficiary.relationship} · ${[beneficiary.city, beneficiary.country].filter(Boolean).join(", ")}`} action={<div className="flex gap-3"><Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700" to={`/dashboard/beneficiaries/${encodeURIComponent(id)}/edit`}>Edit</Link><Link className="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white" to={`/dashboard/requests/new?beneficiary=${encodeURIComponent(id)}`}>New request</Link></div>} />
    {state.error && <ErrorState message={state.error} />}
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><div className="space-y-6"><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Contact and delivery</h2><dl className="mt-6 grid gap-6 sm:grid-cols-2"><DetailItem label="Phone" value={beneficiary.phone} /><DetailItem label="Alternative phone" value={beneficiary.alternativePhone} /><DetailItem label="Delivery address" value={beneficiary.deliveryAddress} /><DetailItem label="Landmark" value={beneficiary.landmark} /><DetailItem label="Delivery instructions" value={beneficiary.deliveryInstructions} /></dl></section><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Relevant medical information</h2><dl className="mt-6 grid gap-6 sm:grid-cols-2"><DetailItem sensitive label="Known allergies" value={beneficiary.preferNotToProvideMedicalInfo ? "Prefer not to provide" : beneficiary.knownAllergies} /><DetailItem sensitive label="Current medications" value={beneficiary.preferNotToProvideMedicalInfo ? "Prefer not to provide" : beneficiary.currentMedications} /><DetailItem sensitive label="Chronic conditions" value={beneficiary.preferNotToProvideMedicalInfo ? "Prefer not to provide" : beneficiary.chronicConditions} /><DetailItem sensitive label="Important notes" value={beneficiary.preferNotToProvideMedicalInfo ? "Prefer not to provide" : beneficiary.medicalNotes} /></dl></section></div><aside className="space-y-6"><section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Contact permission</p><p className="mt-3 font-bold text-emerald-950">{beneficiary.contactConsent ? "Authorized" : "Not authorized"}</p><p className="mt-2 text-sm leading-6 text-emerald-900">{beneficiary.contactConsent ? "Hakim Plus may contact this beneficiary about requests submitted by the customer." : "Hakim Plus must not contact this beneficiary until consent is recorded."}</p></section><section className="rounded-[2rem] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Requests and orders</h2><p className="mt-3 text-sm leading-6 text-slate-600">Active requests and previous orders will appear here after the medication-request phase is connected.</p></section><button className="w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50" type="button" onClick={archiveBeneficiary}>Archive beneficiary</button></aside></div>
  </main>;
}
