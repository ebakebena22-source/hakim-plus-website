const stages = [
  { key: "request_submitted", label: "Request Submitted", description: "Your medication request was received." },
  { key: "pharmacy_review", label: "Pharmacy Review", description: "Prescription, availability, and quote review." },
  { key: "payment", label: "Payment", description: "Review the quote and complete payment." },
  { key: "delivery", label: "Delivery", description: "Delivery progress and final outcome." },
];

const stageIndex = Object.fromEntries(stages.map((stage, index) => [stage.key, index]));

function customerStageForStatus(status) {
  if (["delivery", "out_for_delivery", "completed", "delivery_failed", "delivered"].includes(status)) return "delivery";
  if (["payment", "quote_ready", "awaiting_payment", "payment_verification", "payment_confirmed", "paid"].includes(status)) return "payment";
  if (["pharmacy_review", "under_review", "under_pharmacy_review", "additional_information_required", "awaiting_information", "contacting_beneficiary", "prescription_verification", "checking_availability"].includes(status)) return "pharmacy_review";
  return "request_submitted";
}

export default function CustomerOrderTracker({ status, failed = false, completed = false }) {
  const currentStage = customerStageForStatus(status);
  const currentIndex = stageIndex[currentStage] ?? 0;

  return <ol className="mt-6 grid gap-3 sm:grid-cols-4">{stages.map((stage, index) => {
    const done = index < currentIndex || (completed && index === currentIndex);
    const current = index === currentIndex && !completed;
    const className = done ? "bg-emerald-600 text-white" : current && failed ? "border-2 border-red-600 bg-red-50 text-red-900" : current ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-950" : "bg-slate-100 text-slate-400";
    return <li key={stage.key} className={`rounded-xl p-4 ${className}`}><span className="block text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">{done ? "Complete" : current ? failed ? "Needs attention" : "Current" : `Step ${index + 1}`}</span><span className="mt-2 block text-sm font-bold">{stage.label}</span><span className="mt-1 block text-xs leading-5 opacity-80">{stage.description}</span></li>;
  })}</ol>;
}
