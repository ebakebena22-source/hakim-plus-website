import { useEffect, useMemo, useState } from "react";
import { trackDiasporaCareLead } from "../analytics/metaPixel";
import { createDiasporaCareRequest, landingAttribution } from "../api/diasporaCare";
import BrandLogo from "../components/BrandLogo";

const initialForm = {
  diasporaPhone: "",
  patientPhone: "+251 ",
  careNeed: "",
  website: "",
};

function validate(form) {
  const errors = {};
  if (!form.diasporaPhone.trim()) errors.diasporaPhone = "የእርስዎን ስልክ ቁጥር ያስገቡ።";
  if (!form.patientPhone.trim() || form.patientPhone.trim() === "+251") errors.patientPhone = "የታካሚውን ስልክ ቁጥር ያስገቡ።";
  if (!form.careNeed.trim()) errors.careNeed = "የሚያስፈልገውን እንክብካቤ በአጭሩ ይጻፉ።";
  return errors;
}

function FieldError({ id, children }) {
  if (!children) return null;
  return <p id={id} className="mt-1.5 text-sm font-medium text-red-700" role="alert">{children}</p>;
}

export default function DiasporaCareLandingPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: "idle", message: "" });
  const attribution = useMemo(() => landingAttribution(), []);

  useEffect(() => {
    document.documentElement.lang = "am";
    document.title = "Hakim+ Diaspora Care";
    return () => {
      document.documentElement.lang = "en";
      document.title = "Hakim Plus Pharmacy";
    };
  }, []);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    if (state.status === "sending") return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setState({ status: "sending", message: "" });
    try {
      const result = await createDiasporaCareRequest({ ...form, ...attribution });
      if (result.created && result.eventId) trackDiasporaCareLead(result.eventId);
      setState({ status: "success", message: "" });
    } catch (error) {
      setErrors(error?.details || {});
      setState({ status: "error", message: "ጥያቄዎን መላክ አልተቻለም። እንደገና ይሞክሩ።" });
    }
  }

  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

  return (
    <main className="min-h-screen bg-[#f4f8f6] px-4 py-5 text-slate-950 sm:px-6 sm:py-8" lang="am">
      <div className="mx-auto w-full max-w-[540px]">
        <header className="mb-5 flex items-center gap-3" aria-label="Hakim+ Diaspora Care">
          <BrandLogo className="h-11 w-11 rounded-xl" alt="" />
          <div>
            <p className="text-lg font-black leading-none tracking-tight">Hakim+</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Diaspora Care</p>
          </div>
        </header>

        <section className="rounded-[1.5rem] border border-emerald-950/10 bg-white p-5 shadow-[0_12px_40px_rgba(15,52,41,0.08)] sm:p-7">
          <h1 className="text-[1.7rem] font-black leading-[1.25] tracking-tight sm:text-3xl">ቤተሰብዎ ኢትዮጵያ ውስጥ የጤና እንክብካቤ ያስፈልገዋል?</h1>
          <p className="mt-3 text-[0.98rem] leading-7 text-slate-600">እርስዎ ከውጭ ሆነው ይጠይቁ። እኛ ቤተሰብዎን እናገኛለን እና የሚያስፈልጋቸውን እንክብካቤ እናስተባብራለን።</p>

          {state.status === "success" ? (
            <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-8 text-center" role="status" aria-live="polite">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-700 text-2xl font-black text-white" aria-hidden="true">✓</span>
              <h2 className="mt-4 text-2xl font-black text-emerald-950">ጥያቄዎ ደርሶናል ✓</h2>
              <p className="mt-3 leading-7 text-emerald-950">የHakim+ ቡድን እርስዎን እና ቤተሰብዎን ያነጋግራል።</p>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              <div>
                <label className="block text-sm font-bold text-slate-800" htmlFor="diaspora-phone">የእርስዎ የWhatsApp ስልክ ቁጥር</label>
                <p className="mt-1 text-xs leading-5 text-slate-500">ከውጭ የሚገኙበት ስልክ ቁጥር</p>
                <input id="diaspora-phone" className={inputClass} type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 202 555 0123" value={form.diasporaPhone} onChange={(event) => update("diasporaPhone", event.target.value)} aria-invalid={Boolean(errors.diasporaPhone)} aria-describedby={errors.diasporaPhone ? "diaspora-phone-error" : undefined} required />
                <FieldError id="diaspora-phone-error">{errors.diasporaPhone}</FieldError>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800" htmlFor="patient-phone">የታካሚው ስልክ ቁጥር</label>
                <p className="mt-1 text-xs leading-5 text-slate-500">ኢትዮጵያ ውስጥ ያለው የቤተሰብዎ ስልክ ቁጥር</p>
                <input id="patient-phone" className={inputClass} type="tel" inputMode="tel" autoComplete="tel" value={form.patientPhone} onChange={(event) => update("patientPhone", event.target.value)} aria-invalid={Boolean(errors.patientPhone)} aria-describedby={errors.patientPhone ? "patient-phone-error" : undefined} required />
                <FieldError id="patient-phone-error">{errors.patientPhone}</FieldError>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800" htmlFor="care-need">ምን እንክብካቤ ያስፈልጋቸዋል?</label>
                <textarea id="care-need" className={`${inputClass} min-h-[92px] resize-y`} rows="3" maxLength="800" placeholder="ለምሳሌ፦ መድሃኒት ያስፈልጋቸዋል፣ ሐኪም ማማከር ይፈልጋሉ..." value={form.careNeed} onChange={(event) => update("careNeed", event.target.value)} aria-invalid={Boolean(errors.careNeed)} aria-describedby={errors.careNeed ? "care-need-error" : undefined} required />
                <FieldError id="care-need-error">{errors.careNeed}</FieldError>
              </div>

              <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor="diaspora-care-website">Website</label>
                <input id="diaspora-care-website" name="website" tabIndex="-1" autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} />
              </div>

              {state.status === "error" && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium leading-6 text-red-800" role="alert">{state.message}</p>}

              <button className="min-h-12 w-full rounded-xl bg-emerald-800 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-emerald-900 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-wait disabled:bg-emerald-600" type="submit" disabled={state.status === "sending"}>
                {state.status === "sending" ? "በመላክ ላይ..." : "የእንክብካቤ ጥያቄ ላክ"}
              </button>
            </form>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4 text-center text-xs leading-5 text-slate-500">
            <p>Hakim+ ቡድን ጥያቄዎን ከተቀበለ በኋላ እርስዎን እና ቤተሰብዎን ያነጋግራል።</p>
            <p className="mt-1">🔒 የሚሰጡን መረጃ በጥንቃቄ ይያዛል።</p>
          </div>
        </section>
      </div>
    </main>
  );
}
