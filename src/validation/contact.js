export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isPlausibleEmail(value) {
  const email = normalizeEmail(value);
  if (!email || email.length > 254 || email.includes("..")) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || !domain || domain.length > 253) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  const labels = domain.split(".");
  return labels.length >= 2 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

export function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isPlausiblePhone(value) {
  const raw = String(value || "").trim();
  if (!raw || !/^\+?[0-9\s().-]+$/.test(raw)) return false;
  if ((raw.match(/\+/g) || []).length > 1 || (raw.includes("+") && !raw.startsWith("+"))) return false;
  const digits = phoneDigits(raw);
  if (digits.length < 7 || digits.length > 15) return false;
  return new Set(digits).size > 1;
}

export function emailError(value, { required = true } = {}) {
  if (!String(value || "").trim()) return required ? "Enter an email address." : "";
  return isPlausibleEmail(value) ? "" : "Enter a valid email address, such as name@example.com.";
}

export function phoneError(value, { required = true } = {}) {
  if (!String(value || "").trim()) return required ? "Enter a phone number." : "";
  return isPlausiblePhone(value) ? "" : "Enter a valid phone number with 7 to 15 digits. You may include +, spaces, or dashes.";
}
