import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";

export function Brand({ compact = false }) {
  return (
    <Link to="/" className="inline-flex items-center gap-3 text-slate-950" aria-label="Hakim Plus home">
      <BrandLogo className="h-11 w-11 rounded-2xl shadow-lg shadow-emerald-900/15" />
      {!compact && (
        <span>
          <span className="block text-sm font-extrabold leading-none">Hakim Plus</span>
          <span className="mt-1 block text-xs text-slate-500">Diaspora Care</span>
        </span>
      )}
    </Link>
  );
}

export function AuthShell({ eyebrow, title, description, children, footer }) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <Brand />
        <div className="mt-10 grid overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="relative overflow-hidden bg-slate-950 p-8 text-white lg:p-12">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Care from anywhere</p>
              <h2 className="mt-5 max-w-sm text-3xl font-semibold leading-tight">Support your loved ones in Ethiopia with clarity at every step.</h2>
              <ol className="mt-10 space-y-5 text-sm text-slate-300">
                {["Add your beneficiary", "Send a medication request", "Review the pharmacy quote", "Pay and follow delivery"].map((item, index) => (
                  <li key={item} className="flex items-center gap-4">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 font-bold text-emerald-300">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-slate-400">
                Hakim Plus reviews every medication request before payment. This portal does not diagnose or prescribe.
              </p>
            </div>
          </aside>
          <section className="p-6 sm:p-10 lg:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{description}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-600">{footer}</div>}
          </section>
        </div>
      </div>
    </main>
  );
}

export function Field({ label, id, error, ...props }) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <label className="block text-sm font-semibold text-slate-800" htmlFor={id}>
      {label}
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
        {...props}
      />
      {error && <span id={errorId} className="mt-2 block text-xs font-medium text-red-700">{error}</span>}
    </label>
  );
}

export function ConfigurationNotice() {
  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="status">
      <p className="font-bold">Secure account service is not connected yet.</p>
      <p className="mt-1">The account screens are ready, but registration and login remain disabled until Hakim Plus selects and configures its production identity service.</p>
    </div>
  );
}

export function LocalPreviewNotice() {
  return (
    <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950" role="status">
      <p className="font-bold">Local preview account</p>
      <p className="mt-1">Signup works on this computer only. Account details stay in this browser and are not a production Hakim Plus account. Do not enter real beneficiary or medical information.</p>
    </div>
  );
}

export const primaryButtonClass =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none";
