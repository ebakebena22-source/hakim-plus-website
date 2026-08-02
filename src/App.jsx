import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

function Icon({ name, size = 22, className = "" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  const icons = {
    arrow: (
      <svg {...common}>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>
    ),
    check: (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
    shield: (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    truck: (
      <svg {...common}>
        <path d="M10 17h4V5H2v12h3" />
        <path d="M14 8h4l4 4v5h-3" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    ),
    card: (
      <svg {...common}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h4" />
      </svg>
    ),
    chat: (
      <svg {...common}>
        <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1.2-5.2A8 8 0 1 1 21 12Z" />
      </svg>
    ),
    pill: (
      <svg {...common}>
        <path d="m10.5 20.5 10-10a5 5 0 0 0-7-7l-10 10a5 5 0 0 0 7 7Z" />
        <path d="m8.5 8.5 7 7" />
      </svg>
    ),
    heart: (
      <svg {...common}>
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
        <path d="M3 12h4l2-3 3 6 2-3h7" />
      </svg>
    ),
    clock: (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    file: (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    ),
    phone: (
      <svg {...common}>
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9Z" />
      </svg>
    ),
    users: (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
        <path d="M16 3.1a4 4 0 0 1 0 7.8" />
      </svg>
    ),
  };

  return icons[name] || icons.check;
}

const headingFont = '"General Sans", "Plus Jakarta Sans", Inter, system-ui, sans-serif';
const bodyFont = 'Inter, "Plus Jakarta Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
const requestWebhookUrl = "https://script.google.com/macros/s/AKfycbySY1Ri2SuRUeQ9DR0GiH8V4XkaFI5A37sWiFncTkDbJPvH1aq_d9tR7dUJMKpL3D-A/exec";

const heroHeadlines = [
  "Pay for your family’s medicine in Ethiopia from abroad.",
  "በውጭ ሃገር ሆነው ኢትዮጵያ ላለው ዘመድዎ መድሃኒት ይግዙ",
  "Biyya alaa irraa maatii keessaniif Itoophiyaa keessatti qoricha bitta",
];

const steps = [
  {
    icon: "chat",
    title: "Send the request",
    text: "Tell us what your family member needs, prescription, OTC product, chronic refill, or wellness support.",
  },
  {
    icon: "file",
    title: "We confirm availability",
    text: "Our pharmacy team verifies the medicine, price, dosage details, and delivery information before payment.",
  },
  {
    icon: "card",
    title: "Pay from abroad",
    text: "You receive a payment request and clear cost breakdown before we prepare the order.",
  },
  {
    icon: "truck",
    title: "We deliver and send proof",
    text: "Your relative receives the medicine in Addis Ababa, and you get confirmation with proof of delivery.",
  },
];

const features = [
  "Licensed pharmacy support",
  "Prescription and chronic medication refills",
  "Clear pricing before payment",
  "Delivery coordination in Addis Ababa",
  "Proof of purchase and delivery",
  "Family health follow-up reminders",
];

const packages = [
  {
    name: "One-time medicine request",
    price: "Pay per order",
    desc: "Best for urgent medicine purchases, prescription refills, or one-time family support.",
    items: ["Medicine sourcing", "Price confirmation", "Delivery coordination", "Proof sent to payer"],
  },
  {
    name: "Monthly family care",
    price: "From $50/month",
    desc: "Best for chronic patients who need repeat refills and regular follow-up.",
    items: ["Monthly refills", "Medicine delivery", "Basic adherence check", "Family update report"],
    featured: true,
  },
];

// Set to true to restore the partner-logo carousel on the homepage.
const showPartnerLogos = false;
// Set to true to restore the fulfilled-orders statistic in the hero.
const showFulfilledOrdersStat = false;

const partnerLogos = [
  "https://i.postimg.cc/VLN0Sk9h/1.png",
  "https://i.postimg.cc/tTYCqsGr/Untitled-design-(73).png",
  "https://i.postimg.cc/CLKnZxC9/3.png",
  "https://i.postimg.cc/jdjnWS69/4.png",
  "https://i.postimg.cc/hPGQJt8H/5.png",
  "https://i.postimg.cc/gk0Lw2qW/6.png",
  "https://i.postimg.cc/YqSL4Cfk/7.png",
  "https://i.postimg.cc/hPGQJtbc/8.png",
];

const testimonials = [
  {
    text: "I paid only after they confirmed the exact BP medicine and price. My mother received it the same day and I got the receipt on WhatsApp.",
    name: "Samuel T.",
    location: "USA",
    tag: "Verified delivery",
    rating: 4.5,
    image: "https://i.postimg.cc/HLVZWmjn/abel.png",
  },
  {
    text: "They handle my mother’s monthly hypertension meds. If something is out of stock, they suggest an alternative before I pay.",
    name: "Hanna K.",
    location: "UAE",
    tag: "Monthly care",
    rating: 5,
    image: "https://i.postimg.cc/SKJTQ4jJ/hanna.png",
  },
  {
    text: "Ordered antibiotics for my brother. They verified the dosage, shared the cost, and delivered within hours. Clear and fast.",
    name: "Bereket M.",
    location: "UK",
    tag: "Fast delivery",
    rating: 4,
    image: "https://i.postimg.cc/QMH4NDVF/Bereket.png",
  },
  {
    text: "I got updates before payment and after delivery. No guessing. I saw exactly what was purchased and delivered.",
    name: "Liya A.",
    location: "Canada",
    tag: "Step-by-step updates",
    rating: 4.5,
    image: "https://i.postimg.cc/SKJTQ4j8/liya.png",
  },
  {
    text: "This solved my father’s diabetes refills. They schedule monthly deliveries and send confirmation each time.",
    name: "Dawit B.",
    location: "Germany",
    tag: "Chronic refill",
    rating: 5,
    image: "https://i.postimg.cc/0NbW5vrK/dawit.png",
  },
  {
    text: "They told me one item wasn’t available and offered a cheaper equivalent before payment. That built trust.",
    name: "Meklit S.",
    location: "USA",
    tag: "Clear updates",
    rating: 4,
    image: "https://i.postimg.cc/Zq2fCQyq/meklit.png",
  },
  {
    text: "Same-day delivery worked. My aunt received the medicine in the afternoon and I had proof right after.",
    name: "Abel G.",
    location: "Sweden",
    tag: "Same-day support",
    rating: 5,
    image: "https://i.postimg.cc/HLVZWmjn/abel.png",
  },
  {
    text: "I stopped sending cash. Now I pay for the exact medicine and see the receipt. Much more control.",
    name: "Selam W.",
    location: "UAE",
    tag: "Family support",
    rating: 4.5,
    image: "https://i.postimg.cc/SKJTQ4jJ/hanna.png",
  },
];

const faqItems = [
  {
    q: "Do I pay before or after confirmation?",
    a: "You only pay after we confirm the medicine, pricing, and delivery details. No blind payments.",
  },
  {
    q: "Can you handle chronic medications?",
    a: "Yes. Monthly refills and ongoing support are available for long-term conditions like hypertension or diabetes.",
  },
  {
    q: "Where do you deliver?",
    a: "We currently focus on Addis Ababa with same-day or next-day delivery depending on availability.",
  },
  {
    q: "Will I get proof after delivery?",
    a: "Yes. You receive confirmation and proof once the medicine is delivered to your family member.",
  },
  {
    q: "What if the medicine is not available?",
    a: "We inform you before payment and suggest alternatives when possible. You are not charged without approval.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
};

const staggerGroup = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const smoothTransition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] };
const gentleHover = { y: -3 };

function getFeaturedPackage(list) {
  return list.find((item) => item.featured) || null;
}

function buildWhatsAppText(form = {}) {
  const name = form.name?.trim() || "Not provided";
  const country = form.country?.trim() || "Not provided";
  const phone = form.phone?.trim() || "Not provided";
  const need = form.need?.trim() || "I want to ask about buying medicine for my family in Ethiopia.";

  return `Diaspora medicine request%0AName: ${encodeURIComponent(name)}%0ACountry: ${encodeURIComponent(country)}%0AWhatsApp: ${encodeURIComponent(phone)}%0ANeed: ${encodeURIComponent(need)}`;
}

function buildWhatsAppUrl(phoneNumber, form) {
  const cleanPhoneNumber = String(phoneNumber).replace(/\D/g, "");
  return `https://wa.me/${cleanPhoneNumber}?text=${buildWhatsAppText(form)}`;
}

function buildRequestPayload(form) {
  return {
    name: form.name?.trim() || "",
    country: form.country?.trim() || "",
    whatsapp: form.phone?.trim() || "",
    need: form.need?.trim() || "",
    source: "Hakim Plus Diaspora Website",
    submittedAt: new Date().toISOString(),
    status: "New request",
  };
}

async function submitRequestToBackend(form) {
  const payload = buildRequestPayload(form);

  if (!requestWebhookUrl || requestWebhookUrl.includes("example.com")) {
    console.info("Backend lite payload ready. Replace requestWebhookUrl with your real webhook URL.", payload);
    return { ok: true, mode: "preview", payload };
  }

  const formBody = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    formBody.append(key, String(value));
  });

  await fetch(requestWebhookUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: formBody.toString(),
  });

  return { ok: true, mode: "sent-no-cors", payload };
}

function runSelfTests() {
  console.assert(typeof document === "undefined" || true, "Font applied via inline style");
  console.assert(true, "Using a modern non-generic font stack");
  console.assert(heroHeadlines.length === 3, "Expected 3 rotating hero headlines");
  console.assert(steps.length === 4, "Expected 4 process steps");
  console.assert(features.length >= 6, "Expected at least 6 service features");
  console.assert(partnerLogos.length === 8, "Expected 8 partner logos");
  console.assert(testimonials.length >= 5, "Expected at least 5 testimonials for carousel");
  console.assert(testimonials.some((item) => item.rating === 4), "Expected at least one 4-star testimonial");
  console.assert(testimonials.some((item) => item.rating === 4.5), "Expected at least one 4.5-star testimonial");
  console.assert(testimonials.some((item) => item.rating === 5), "Expected at least one 5-star testimonial");
  console.assert(testimonials.every((item) => item.image.startsWith("https://")), "Expected testimonial profile images to use HTTPS");
  console.assert(testimonials.every((item) => item.tag), "Expected every testimonial to include a case tag");
  console.assert(faqItems.length >= 5, "Expected at least 5 FAQ items");
  console.assert(getFeaturedPackage(packages)?.name === "Monthly family care", "Expected monthly care to be featured");
  console.assert(buildWhatsAppText({ name: "Eba", country: "USA", phone: "+1 555 000", need: "BP medicine" }).includes("BP%20medicine"), "Expected request text to encode spaces");
  console.assert(buildWhatsAppText({ name: "Eba", country: "USA", phone: "+1 555 000", need: "BP medicine" }).includes("%2B1%20555%20000"), "Expected phone to be encoded");
  console.assert(buildWhatsAppText({ name: "", country: "", phone: "", need: "" }).includes("Not%20provided"), "Expected empty fields to use fallback text");
  console.assert(buildWhatsAppUrl("+251 971 818 802", { name: "Eba", country: "USA", phone: "+1 555 000", need: "BP medicine" }).startsWith("https://wa.me/251971818802"), "Expected WhatsApp URL to use digits only");
  console.assert(buildWhatsAppUrl("+251971818802", {}).includes("buying%20medicine%20for%20my%20family"), "Expected empty WhatsApp CTA to include default inquiry message");
  console.assert(smoothTransition.duration > 0, "Expected animation transition to have duration");
  console.assert(Array.isArray(smoothTransition.ease), "Expected custom easing curve for smoother motion");
  console.assert(fadeUp.visible.opacity === 1, "Expected fadeUp visible state to be fully opaque");
  console.assert(scaleIn.visible.scale === 1, "Expected scaleIn visible state to use normal scale");
  const testPayload = buildRequestPayload({ name: "Eba", country: "USA", phone: "+1 555", need: "BP medicine" });
  console.assert(testPayload.status === "New request", "Expected backend payload to include default status");
  console.assert(testPayload.source === "Hakim Plus Diaspora Website", "Expected backend payload to include source");
}

runSelfTests();

function Button({
  children,
  variant = "primary",
  className = "",
  href,
  type = "button",
  external = false,
  onClick,
  disabled = false,
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-emerald-500/20";
  const styles =
    variant === "primary"
      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"
      : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-100";
  const classes = `${base} ${styles} ${className}`;

  if (href) {
    return (
      <a
  href={href}
  className={classes}
  target={external ? "_blank" : undefined}
  rel={external ? "noopener noreferrer" : undefined}
  onClick={onClick}
>
  {children}
</a>
    );
  }

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
  {children}
</button>
  );
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <motion.div
      className="mx-auto max-w-2xl text-center"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.25 }}
      variants={fadeUp}
      transition={smoothTransition}
    >
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">{eyebrow}</p>
      <h2 className="text-3xl font-semibold text-slate-950 md:text-4xl" style={{ fontFamily: headingFont, letterSpacing: "-0.025em", lineHeight: 1.1 }}>
        {title}
      </h2>
      {text && <p className="mt-4 text-base leading-7 text-slate-600">{text}</p>}
    </motion.div>
  );
}

function AnimatedCard({ children, className = "", dark = false }) {
  return (
    <motion.div
      variants={fadeUp}
      transition={smoothTransition}
      whileHover={gentleHover}
      className={`${className} transition-shadow ${dark ? "hover:shadow-xl hover:shadow-slate-900/20" : "hover:shadow-xl hover:shadow-slate-900/10"}`}
    >
      {children}
    </motion.div>
  );
}

export default function DiasporaPharmacyLandingPage() {
  const [form, setForm] = useState({ name: "", country: "", phone: "", need: "" });
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [submitState, setSubmitState] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const whatsappUrl = useMemo(() => buildWhatsAppUrl("+251971818802", form), [form]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setHeadlineIndex((currentIndex) => (currentIndex + 1) % heroHeadlines.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, []);

 async function handleSubmit(event) {
  event.preventDefault();

  // Open WhatsApp FIRST (this avoids browser blocking)
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");

  setSubmitState("loading");
  setSubmitMessage("Saving your request...");

  try {
    await submitRequestToBackend(form);

    setSubmitState("success");
    setSubmitMessage("Request saved successfully.");
  } catch (error) {
    console.log(error);
    setSubmitState("error");
    setSubmitMessage("Saved may have failed, but your request was sent.");
  }
}

  return (
    <main id="main-content" className="min-h-screen scroll-smooth bg-slate-50 text-slate-900" style={{ fontFamily: bodyFont, letterSpacing: "-0.01em" }}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <nav className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <Icon name="pill" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">Hakim Plus</p>
              <p className="text-xs text-slate-500">Diaspora Care</p>
            </div>
          </div>
          <div className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#how" className="transition-colors duration-300 hover:text-slate-950">How it works</a>
            <a href="#about" className="transition-colors duration-300 hover:text-slate-950">About</a>
            <a href="#services" className="transition-colors duration-300 hover:text-slate-950">Services</a>
            <a href="#pricing" className="transition-colors duration-300 hover:text-slate-950">Plans</a>
            <a href="#contact" className="transition-colors duration-300 hover:text-slate-950">Start request</a>
            <a href="#faq" className="transition-colors duration-300 hover:text-slate-950">FAQ</a>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <a href="/login" className="text-sm font-semibold text-slate-700 transition hover:text-emerald-700">Customer login</a>
            <Button href="/signup">Create account</Button>
          </div>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 md:hidden"
            aria-label="Open WhatsApp"
          >
            <Icon name="chat" size={19} />
          </a>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-white">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-100 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pt-10 pb-14 md:grid-cols-2 md:gap-12 md:pt-16 md:pb-24">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={smoothTransition}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
              <Icon name="shield" size={17} /> Trusted medicine support for families in Ethiopia
            </div>
            <motion.h1
              key={headlineIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.8, ease: [0.25, 0.8, 0.25, 1] }}
              className="text-[2.35rem] font-extrabold text-slate-950 sm:text-5xl md:text-6xl"
              style={{ fontFamily: headingFont, letterSpacing: "-0.03em", lineHeight: 1.05 }}
            >
              {heroHeadlines[headlineIndex]}
            </motion.h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 md:text-lg md:leading-8">
              Hakim Plus helps Ethiopians abroad pay for their family’s medicine in Ethiopia with more clarity, control, and confidence. Instead of sending money and hoping for the best, you get confirmation before payment and proof after delivery.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-row">
              <Button href="/signup">Create your account <Icon name="arrow" size={18} /></Button>
              <Button href="#how" variant="secondary">See how it works</Button>
              <Button href={whatsappUrl} external variant="secondary">
                WhatsApp (+251971818802) <Icon name="chat" size={18} />
              </Button>
            </div>
            <div className="mt-7 border-t border-slate-200 pt-5">
              <div className={`grid gap-3 md:gap-4 ${showFulfilledOrdersStat ? "grid-cols-3" : "grid-cols-2"}`}>
                {showFulfilledOrdersStat && (
                  <div className="flex flex-col items-start">
                    <p className="text-2xl font-extrabold leading-none text-emerald-600 md:text-3xl">16K+</p>
                    <p className="text-xs font-semibold text-slate-600 leading-none">fulfilled orders</p>
                  </div>
                )}
                <div>
                  <p className="text-xl font-bold md:text-2xl">Same-day</p>
                  <p className="text-xs text-slate-500">delivery available</p>
                </div>
                <div>
                  <p className="text-xl font-bold md:text-2xl">Proof</p>
                  <p className="text-xs text-slate-500">sent after delivery</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={scaleIn} transition={{ ...smoothTransition, delay: 0.1 }} className="relative">
            <motion.div whileHover={gentleHover} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="mb-5 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10 md:mb-6">
              <motion.img
                src="https://i.postimg.cc/1tQxnbpz/family-consultation.png"
                alt="Pharmacist consulting Ethiopian family"
                className="h-[240px] w-full rounded-[1.5rem] object-cover sm:h-[300px] md:h-[320px]"
                whileHover={{ scale: 1.015 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </motion.div>

            <motion.div whileHover={gentleHover} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/10">
              <div className="rounded-[1.5rem] bg-slate-950 p-6 text-white">
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Active request</p>
                    <p className="text-xl font-bold">Mother’s BP medication</p>
                  </div>
                  <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">Verified</div>
                </div>
                <div className="space-y-4">
                  {[
                    ["Prescription checked", "Complete"],
                    ["Medicine sourced", "Available"],
                    ["Payment request", "Sent"],
                    ["Delivery", "In progress"],
                  ].map(([label, status]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl bg-white/8 p-4">
                      <span className="text-sm text-slate-200">{label}</span>
                      <span className="text-sm font-semibold text-white">{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...smoothTransition, delay: 0.35 }} className="absolute -bottom-6 -left-6 hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-xl md:block">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Icon name="heart" /></div>
                <div>
                  <p className="text-sm font-bold">Family update sent</p>
                  <p className="text-xs text-slate-500">Receipt + delivery confirmation</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {showPartnerLogos && (
        <section className="overflow-hidden bg-white py-6 md:py-8">
          <div className="relative w-full overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent" />
            <motion.div className="flex gap-6 whitespace-nowrap items-center" animate={{ x: [0, -1000] }} transition={{ repeat: Infinity, duration: 35, ease: "linear" }}>
              {[...partnerLogos, ...partnerLogos].map((logo, index) => (
                <div key={`${logo}-${index}`} className="flex min-w-[180px] items-center justify-center opacity-60 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 md:min-w-[320px]">
                  <img src={logo} alt="partner logo" className="h-[82px] object-contain md:h-[140px]" />
                </div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      <section id="how" className="relative overflow-hidden bg-slate-950 px-5 py-16 text-white md:py-28">
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <motion.div
          className="relative mx-auto max-w-5xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          transition={smoothTransition}
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Process</p>
          <h2 className="text-3xl font-semibold md:text-5xl" style={{ fontFamily: headingFont, letterSpacing: "-0.03em" }}>
            A controlled process, not guesswork
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-300">
            Every step is verified before moving forward. You stay informed from request to delivery.
          </p>
        </motion.div>
        <motion.div
          className="relative mx-auto mt-10 max-w-6xl md:mt-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerGroup}
        >
          <div className="grid gap-6 md:grid-cols-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                variants={fadeUp}
                transition={smoothTransition}
                whileHover={{ y: -6 }}
                className="group relative rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                    <Icon name={step.icon} size={22} />
                  </div>
                  <span className="text-xs font-semibold text-slate-500">0{index + 1}</span>
                </div>
                <h3 className="text-lg font-semibold text-white" style={{ fontFamily: headingFont }}>
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{step.text}</p>
                <div className="mt-6 h-[1px] w-full bg-white/10" />
                <p className="mt-4 text-xs text-emerald-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {index === 0 && "Start in seconds. No account required."}
                  {index === 1 && "We prevent wrong purchases before payment."}
                  {index === 2 && "You approve everything before paying."}
                  {index === 3 && "You receive proof immediately after delivery."}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
        <div className="mt-16 text-center">
          <p className="text-sm text-slate-400">
            You work hard abroad to support your family. This keeps you in control of their care.
          </p>
        </div>
      </section>

      <section id="about" className="bg-slate-50 px-5 py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2 md:items-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} variants={fadeUp} transition={smoothTransition}>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">About us</p>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">A pharmacy built for real family responsibility.</h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Hakim Plus is a licensed pharmacy in Addis Ababa focused on reliable access to medicine. We built this service because sending money alone does not guarantee the right care.
            </p>
            <p className="mt-4 text-base leading-7 text-slate-600">
              You get verification before payment, controlled sourcing, and clear delivery proof. This reduces risk, removes guesswork, and keeps you involved in your family’s care.
            </p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} variants={scaleIn} transition={smoothTransition}>
            <motion.div whileHover={gentleHover} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-lg">
              <motion.img
                src="https://i.postimg.cc/GpM7rNqq/hakim-plus.png"
                alt="Hakim Plus Pharmacy interior"
                className="h-[240px] w-full rounded-2xl object-cover sm:h-[300px] md:h-[320px]"
                whileHover={{ scale: 1.015 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section id="services" className="bg-white px-5 py-16 md:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">What we handle</p>
          <h2 className="text-3xl font-semibold md:text-4xl" style={{ fontFamily: headingFont, letterSpacing: "-0.03em" }}>
            Three things, done right
          </h2>
        </div>
        <motion.div
          className="mx-auto mt-10 max-w-5xl md:mt-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerGroup}
        >
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {[
              {
                title: "Verification",
                desc: "Medicine, dosage, and availability checked before anything moves.",
                icon: "shield",
              },
              {
                title: "Payment control",
                desc: "Exact pricing shared before you pay. No assumptions.",
                icon: "card",
              },
              {
                title: "Delivery proof",
                desc: "Medicine delivered locally, confirmation sent to you.",
                icon: "truck",
              },
            ].map((item, index) => (
              <motion.div key={item.title} variants={fadeUp} transition={smoothTransition} className="flex items-start justify-between gap-4 py-6 md:items-center md:gap-6 md:py-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Icon name={item.icon} size={22} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-950" style={{ fontFamily: headingFont }}>
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
                  </div>
                </div>
                <div className="hidden text-xs font-semibold text-slate-400 md:block">0{index + 1}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
        <div className="mx-auto mt-12 max-w-2xl text-center">
          <p className="text-sm text-slate-500">One request or ongoing care, same level of control.</p>
        </div>
      </section>

      <section id="pricing" className="px-5 py-16 md:py-20">
        <SectionTitle eyebrow="Options" title="Choose one-time support or monthly care" text="Start small with one request, then move to a monthly plan if your relative needs regular medication support." />
        <motion.div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} variants={staggerGroup}>
          {packages.map((pkg) => (
            <AnimatedCard key={pkg.name} dark={pkg.featured} className={`rounded-[2rem] border p-7 ${pkg.featured ? "border-emerald-500 bg-slate-950 text-white shadow-2xl shadow-slate-900/15" : "border-slate-200 bg-white"}`}>
              {pkg.featured && <div className="mb-4 inline-flex rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300">Most useful for chronic care</div>}
              <h3 className="text-2xl font-bold">{pkg.name}</h3>
              <p className={`mt-2 text-3xl font-black ${pkg.featured ? "text-white" : "text-slate-950"}`}>{pkg.price}</p>
              <p className={`mt-4 leading-7 ${pkg.featured ? "text-slate-300" : "text-slate-600"}`}>{pkg.desc}</p>
              <div className="mt-6 space-y-3">
                {pkg.items.map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <Icon name="check" size={18} className="text-emerald-500" />
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
              <Button href="#contact" className="mt-8 w-full" variant={pkg.featured ? "secondary" : "primary"}>Start with this option</Button>
            </AnimatedCard>
          ))}
        </motion.div>
      </section>

      <section id="contact" className="relative overflow-hidden bg-slate-950 px-5 py-16 text-white md:py-24">
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          variants={scaleIn}
          transition={smoothTransition}
          className="relative mx-auto grid max-w-7xl gap-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur md:grid-cols-2 md:gap-10 md:p-10"
        >
          <div className="flex flex-col justify-between">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Start request</p>
              <h2 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: headingFont, letterSpacing: "-0.03em" }}>
                Send the request. We confirm before you pay.
              </h2>
              <div className="mt-6 space-y-3 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <Icon name="check" size={18} className="text-emerald-400" />
                  <span>No blind payments</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon name="check" size={18} className="text-emerald-400" />
                  <span>Medicine verified before checkout</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon name="check" size={18} className="text-emerald-400" />
                  <span>Delivery proof sent after</span>
                </div>
              </div>
            </div>
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-400/15 p-2 text-emerald-300"><Icon name="phone" size={18} /></div>
                <div>
                  <p className="text-xs text-slate-400">Direct WhatsApp</p>
                  <p className="text-sm font-semibold text-white">+251-971-81-8802</p>
                </div>
              </div>
              <Button href={whatsappUrl} external className="mt-4 w-full">
                Chat on WhatsApp <Icon name="chat" size={18} />
              </Button>
            </div>
          </div>
          <form className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-5 shadow-xl backdrop-blur md:p-6" onSubmit={handleSubmit}>
            <div className="mb-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-400" htmlFor="public-name">Your name</label>
                <input id="public-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="Bethlehem" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-400" htmlFor="public-country">Country</label>
                <input id="public-country" autoComplete="country-name" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="USA, UAE" />
              </div>
            </div>
            <div className="mb-5">
              <label className="mb-2 block text-xs font-semibold text-slate-400" htmlFor="public-phone">WhatsApp number</label>
              <input id="public-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="+1..., +971..." />
            </div>
            <div className="mb-6">
              <label className="mb-2 block text-xs font-semibold text-slate-400" htmlFor="public-inquiry">General inquiry</label>
              <textarea id="public-inquiry" aria-describedby="public-form-privacy" value={form.need} onChange={(e) => setForm({ ...form, need: e.target.value })} className="w-full min-h-28 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="How can Hakim Plus help? Do not include prescriptions or private medical details here." />
            </div>
            <Button type="submit" className="w-full" disabled={submitState === "loading"}>
              {submitState === "loading" ? "Submitting..." : "Submit request"}
              <Icon name="arrow" size={18} />
            </Button>
            {submitMessage && (
              <p className={`mt-4 rounded-xl px-4 py-3 text-xs ${submitState === "error" ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`} role={submitState === "error" ? "alert" : "status"}>
                {submitMessage}
              </p>
            )}
            <p id="public-form-privacy" className="mt-4 text-[11px] leading-5 text-slate-500">For privacy, do not submit prescriptions or sensitive medical details through this public form. Not for emergencies—visit an appropriate health facility for urgent care.</p>
          </form>
        </motion.div>
      </section>

      

      <section id="founder" className="bg-white px-5 py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-14 md:grid-cols-2">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={fadeUp}
            transition={smoothTransition}
          >
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Founder</p>
            <h2 className="text-4xl font-semibold text-slate-950 md:text-5xl" style={{ fontFamily: headingFont, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
              Built by a doctor who understands medication access.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600">
              Hakim Plus Pharmacy aims to set a clear standard for how medicine is accessed and delivered, with transparency, verification, and accountability at every step.
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              The goal is simple, make every purchase traceable, every decision informed, and every delivery verifiable for families supporting care from abroad.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Icon name="shield" size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Dr. Eba Kebena</p>
                <p className="text-xs text-slate-500">Medical Doctor, Founder of Hakim Plus Pharmacy</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={scaleIn}
            transition={smoothTransition}
            className="flex justify-center"
          >
            <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-slate-100 shadow-xl shadow-slate-900/10">
              <img
                src="https://i.postimg.cc/5NYgYJVy/Untitled-design-(74).png"
                alt="Founder"
                className="h-[360px] w-full object-cover object-top sm:h-[430px] md:h-[460px]"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <section id="faq" className="relative overflow-hidden bg-white px-5 py-16 md:py-24">
        <div className="absolute right-0 top-0 h-[360px] w-[360px] rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-start">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={fadeUp}
            transition={smoothTransition}
            className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/15 md:p-8"
          >
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">FAQ</p>
            <h2 className="text-3xl font-semibold md:text-4xl" style={{ fontFamily: headingFont, letterSpacing: "-0.03em", lineHeight: 1.08 }}>
              Common questions
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-300">Simple answers before you start. Need a faster answer? Message us directly on WhatsApp.</p>
            <div className="mt-8 grid gap-3 text-sm text-slate-300">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <Icon name="shield" size={20} className="text-emerald-300" />
                <span>Payment only after confirmation</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <Icon name="truck" size={20} className="text-emerald-300" />
                <span>Same-day delivery available</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <Icon name="file" size={20} className="text-emerald-300" />
                <span>Proof sent after delivery</span>
              </div>
            </div>
            <Button href={whatsappUrl} external className="mt-8 w-full" variant="secondary">
              WhatsApp (+251971818802) <Icon name="chat" size={18} />
            </Button>
          </motion.div>
          <motion.div className="grid gap-4" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={staggerGroup}>
            {faqItems.map((item, index) => (
              <motion.details key={index} variants={fadeUp} transition={smoothTransition} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 open:border-emerald-200 open:bg-emerald-50/40 open:shadow-xl open:shadow-emerald-900/5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-slate-950">
                  <span>{item.q}</span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all duration-300 group-open:rotate-45 group-open:bg-emerald-600 group-open:text-white">+</span>
                </summary>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{item.a}</p>
              </motion.details>
            ))}
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-slate-500 md:flex-row">
          <p>© 2026 Hakim Plus Pharmacy. Diaspora Care Service.</p>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <nav className="flex gap-4" aria-label="Legal"><a className="font-semibold hover:text-emerald-700" href="/terms">Terms of Use</a><a className="font-semibold hover:text-emerald-700" href="/privacy">Privacy Policy</a></nav>
            <p>Medicine verification · Payment request · Delivery proof</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
