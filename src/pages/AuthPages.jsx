import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { authClient } from "../auth/authClient";
import { AuthShell, ConfigurationNotice, Field, LocalPreviewNotice, primaryButtonClass } from "../components/AuthShell";
import CountryPicker from "../components/CountryPicker";
import { emailError, phoneError } from "../validation/contact";

function FormError({ message }) {
  if (!message) return null;
  return <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{message}</p>;
}

function SocialAuthButtons({ disabled = false, onError }) {
  const [busy, setBusy] = useState(false);

  async function continueWithGoogle() {
    onError?.("");
    setBusy(true);
    try {
      const result = await authClient.socialSignIn("google");
      window.location.assign(result.url);
    } catch (error) {
      onError?.(error.message);
      setBusy(false);
    }
  }

  return <button className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100" type="button" disabled={disabled || busy} onClick={continueWithGoogle}><span className="text-base font-black text-blue-600" aria-hidden="true">G</span>{busy ? "Connecting…" : "Continue with Google"}</button>;
}

function AuthDivider() {
  return <div className="my-6 flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-slate-200" /><span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">or use email</span><span className="h-px flex-1 bg-slate-200" /></div>;
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await auth.signIn(form);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Customer portal" title="Welcome back" description="Sign in to manage requests, quotes, payments, and delivery updates." footer={<p>New to Hakim Plus? <Link className="font-bold text-emerald-700 hover:underline" to="/signup">Create an account</Link></p>}>
      {!auth.configured && <ConfigurationNotice />}
      {auth.mode === "local-preview" && <LocalPreviewNotice />}
      <SocialAuthButtons disabled={!auth.configured} onError={setError} />
      <AuthDivider />
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormError message={error} />
        <Field id="login-email" label="Email address" type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <Field id="login-password" label="Password" type="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <div className="flex justify-end"><Link className="text-sm font-semibold text-emerald-700 hover:underline" to="/forgot-password">Forgot password?</Link></div>
        <button className={primaryButtonClass} type="submit" disabled={!auth.configured || busy}>{busy ? "Signing in…" : auth.mode === "local-preview" ? "Sign in to local preview" : "Sign in securely"}</button>
      </form>
    </AuthShell>
  );
}

export function SignupPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", countryCode: "", password: "", confirmPassword: "", termsAccepted: false, privacyAccepted: false });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => current[name] ? { ...current, [name]: "" } : current);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const contactErrors = { email: emailError(form.email), phone: phoneError(form.phone) };
    const invalidContacts = Object.fromEntries(Object.entries(contactErrors).filter(([, message]) => message));
    setFieldErrors(invalidContacts);
    if (Object.keys(invalidContacts).length) return;
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    if (!form.termsAccepted || !form.privacyAccepted) return setError("You must accept the Terms of Use and Privacy Policy.");
    setBusy(true);
    try {
      const result = await auth.signUp(form);
      navigate(result.requiresVerification === false ? "/onboarding" : "/verify-email", { state: { email: form.email } });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Create account" title="Start supporting your loved ones" description="Your beneficiary does not need an account. You stay in control of requests, quotes, payments, and updates." footer={<p>Already registered? <Link className="font-bold text-emerald-700 hover:underline" to="/login">Sign in</Link></p>}>
      {!auth.configured && <ConfigurationNotice />}
      {auth.mode === "local-preview" && <LocalPreviewNotice />}
      <SocialAuthButtons disabled={!auth.configured} onError={setError} />
      <p className="mt-3 text-xs leading-5 text-slate-500">After Google sign-in, you will complete your profile and accept the Terms of Use and Privacy Policy.</p>
      <AuthDivider />
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormError message={error} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="first-name" label="First name" autoComplete="given-name" required value={form.firstName} onChange={(event) => update("firstName", event.target.value)} />
          <Field id="last-name" label="Last name" autoComplete="family-name" required value={form.lastName} onChange={(event) => update("lastName", event.target.value)} />
        </div>
        <Field id="signup-email" label="Email address" type="email" autoComplete="email" required value={form.email} error={fieldErrors.email} onBlur={(event) => setFieldErrors((current) => ({ ...current, email: emailError(event.target.value) }))} onChange={(event) => update("email", event.target.value)} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="phone" label="Phone number" type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 202 555 0123" required value={form.phone} error={fieldErrors.phone} onBlur={(event) => setFieldErrors((current) => ({ ...current, phone: phoneError(event.target.value) }))} onChange={(event) => update("phone", event.target.value)} />
          <CountryPicker id="country" required value={form.countryCode} onChange={(value) => update("countryCode", value)} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="signup-password" label="Password" type="password" autoComplete="new-password" minLength="12" required value={form.password} onChange={(event) => update("password", event.target.value)} />
          <Field id="confirm-password" label="Confirm password" type="password" autoComplete="new-password" minLength="12" required value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} />
        </div>
        <p className="text-xs leading-5 text-slate-500">Use at least 12 characters. Final password rules will be enforced by the selected identity provider.</p>
        <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"><input className="mt-1 h-4 w-4 shrink-0 accent-emerald-600" type="checkbox" checked={form.termsAccepted && form.privacyAccepted} onChange={(event) => { update("termsAccepted", event.target.checked); update("privacyAccepted", event.target.checked); }} /><span>By creating an account, you agree to our <Link className="font-bold text-emerald-700 hover:underline" to="/terms">Terms of Use</Link> and <Link className="font-bold text-emerald-700 hover:underline" to="/privacy">Privacy Policy</Link>.</span></label>
        <button className={primaryButtonClass} type="submit" disabled={!auth.configured || busy}>{busy ? "Creating account…" : auth.mode === "local-preview" ? "Create local preview account" : "Create secure account"}</button>
      </form>
    </AuthShell>
  );
}

export function SocialAuthCompletePage() {
  const { refreshSession, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oauthError = Boolean(searchParams.get("error"));
  const verifier = searchParams.get("neon_auth_session_verifier");
  const completionStarted = useRef(false);
  const [error, setError] = useState(oauthError ? "Social sign-in could not be completed. Try again or use email and password." : "");

  useEffect(() => {
    let active = true;
    if (oauthError || completionStarted.current) return () => { active = false; };
    completionStarted.current = true;
    const completion = verifier
      ? authClient.completeSocialSignIn(verifier).then((result) => {
          updateUser(result.user);
          return result.user;
        })
      : refreshSession();
    completion.then((user) => {
      if (!active) return;
      if (!user) return setError("The social account was verified, but a Hakim Plus session could not be created. Try again.");
      navigate(user.profile?.countryCode ? "/dashboard" : "/onboarding", { replace: true });
    }).catch((sessionError) => { if (active) setError(sessionError.message); });
    return () => { active = false; };
  }, [navigate, oauthError, refreshSession, updateUser, verifier]);

  return <AuthShell eyebrow="Secure sign-in" title={error ? "Sign-in needs attention" : "Finishing your sign-in"} description="We are securely connecting your account to Hakim Plus." footer={<Link className="font-bold text-emerald-700 hover:underline" to="/login">Return to sign in</Link>}><FormError message={error} />{!error && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900" role="status">Checking your account…</p>}</AuthShell>;
}

export function ForgotPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await authClient.requestPasswordReset(email);
      setMessage("If an account exists for this email, a secure reset link has been sent.");
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <AuthShell eyebrow="Account recovery" title="Reset your password" description="Enter your email and we will send a secure, time-limited reset link." footer={<Link className="font-bold text-emerald-700 hover:underline" to="/login">Return to sign in</Link>}>
      {!auth.configured && <ConfigurationNotice />}
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormError message={error} />
        {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{message}</p>}
        <Field id="recovery-email" label="Email address" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <button className={primaryButtonClass} type="submit" disabled={!auth.configured}>Send reset link</button>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    try {
      await authClient.resetPassword({ token: searchParams.get("token"), password: form.password });
      setMessage("Your password has been updated. You can now sign in.");
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <AuthShell eyebrow="Account security" title="Choose a new password" description="Your reset link must be valid and unused." footer={<Link className="font-bold text-emerald-700 hover:underline" to="/login">Return to sign in</Link>}>
      {!auth.configured && <ConfigurationNotice />}
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormError message={error} />
        {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{message}</p>}
        <Field id="new-password" label="New password" type="password" autoComplete="new-password" minLength="12" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <Field id="new-password-confirmation" label="Confirm new password" type="password" autoComplete="new-password" minLength="12" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
        <button className={primaryButtonClass} type="submit" disabled={!auth.configured}>Update password</button>
      </form>
    </AuthShell>
  );
}

export function VerifyEmailPage() {
  const location = useLocation();
  return (
    <AuthShell eyebrow="Verify email" title="Check your inbox" description="Email verification protects your account and beneficiary information." footer={<Link className="font-bold text-emerald-700 hover:underline" to="/login">Continue to sign in</Link>}>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950">
        <p className="font-bold">Verification required</p>
        <p className="mt-2">Follow the secure link sent to {location.state?.email || "your email address"}. The account service will control link expiry and resend limits.</p>
      </div>
    </AuthShell>
  );
}
