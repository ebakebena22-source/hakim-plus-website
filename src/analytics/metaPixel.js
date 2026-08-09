export function trackDiasporaCareLead() {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return false;
  // The Pixel and PageView are initialized once in diaspora-care.html.
  // Do not include phone numbers, care details, or other customer data.
  window.fbq("track", "Lead");
  return true;
}
