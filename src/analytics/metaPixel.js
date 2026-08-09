const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || "1614464439742591";

let initialized = false;
let pageViewTracked = false;

function initializeMetaPixel() {
  if (initialized) return true;
  if (typeof window === "undefined" || !META_PIXEL_ID) return false;

  if (!window.fbq) {
    const fbq = function (...args) {
      fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  // This is a health-service landing page. Disable Meta's automatic event
  // discovery so only the explicitly approved PageView and Lead events fire.
  window.fbq("set", "autoConfig", false, META_PIXEL_ID);
  window.fbq("init", META_PIXEL_ID);
  initialized = true;
  return true;
}

export function trackDiasporaCarePageView() {
  if (pageViewTracked || !initializeMetaPixel()) return;
  window.fbq("track", "PageView");
  pageViewTracked = true;
}

export function trackDiasporaCareLead(eventId) {
  if (!eventId || !initializeMetaPixel()) return;
  // No phone, care description, URL parameters, or customer identifiers are
  // included. eventID enables browser/server deduplication if CAPI is enabled.
  window.fbq("track", "Lead", {}, { eventID: eventId });
}
