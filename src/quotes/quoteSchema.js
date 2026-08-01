export const emptyQuoteItem = {
  medicationName: "",
  strength: "",
  dosageForm: "",
  quotedQuantity: "1",
  unitLabel: "item",
  unitPrice: "0.00",
  availability: "available",
  pharmacyNote: "",
};

export const emptyQuote = {
  currency: "ETB",
  items: [{ ...emptyQuoteItem }],
  deliveryFee: "0.00",
  serviceFee: "0.00",
  discount: "0.00",
  tax: "0.00",
  expiresAt: "",
  pharmacyNotes: "",
};

function decimalToMinor(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function calculateQuotePreview(quote) {
  const itemSubtotalMinor = quote.items.reduce((total, item) => {
    if (item.availability === "unavailable") return total;
    return total + Math.max(0, Number(item.quotedQuantity) || 0) * Math.max(0, decimalToMinor(item.unitPrice));
  }, 0);
  const deliveryMinor = Math.max(0, decimalToMinor(quote.deliveryFee));
  const serviceMinor = Math.max(0, decimalToMinor(quote.serviceFee));
  const discountMinor = Math.max(0, decimalToMinor(quote.discount));
  const taxMinor = Math.max(0, decimalToMinor(quote.tax));
  return {
    itemSubtotalMinor,
    grandTotalMinor: Math.max(0, itemSubtotalMinor + deliveryMinor + serviceMinor + taxMinor - discountMinor),
  };
}

export function formatMinorAmount(minor, currency = "ETB") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format((minor || 0) / 100);
}

export function validateQuote(quote) {
  const errors = {};
  if (!/^[A-Z]{3}$/.test(quote.currency)) errors.currency = "Use a valid three-letter currency code.";
  if (!quote.expiresAt || !Number.isFinite(new Date(quote.expiresAt).getTime()) || new Date(quote.expiresAt).getTime() <= Date.now()) errors.expiresAt = "Set a future quote expiration date and time.";
  if (!quote.items.length) errors.items = "Add at least one quote item.";
  quote.items.forEach((item, index) => {
    if (!item.medicationName.trim()) errors[`item-${index}-name`] = "Enter the medication or product name.";
    if (!["available", "partial", "unavailable"].includes(item.availability)) errors[`item-${index}-pricing`] = "Choose a valid availability option.";
    if (item.availability !== "unavailable" && (!(Number(item.quotedQuantity) > 0) || !Number.isInteger(Number(item.quotedQuantity)) || Number(item.unitPrice) < 0)) errors[`item-${index}-pricing`] = "Enter a whole-number quantity and a valid unit price.";
    if (item.availability !== "available" && !item.pharmacyNote.trim()) errors[`item-${index}-note`] = "Explain partial or unavailable items to the customer.";
  });
  return errors;
}

export function createQuotePayload(quote) {
  return {
    currency: quote.currency,
    items: quote.items.map((item) => ({
      medicationName: item.medicationName.trim(),
      strength: item.strength.trim(),
      dosageForm: item.dosageForm.trim(),
      quotedQuantity: String(item.quotedQuantity),
      unitLabel: item.unitLabel.trim(),
      unitPrice: item.availability === "unavailable" ? "0.00" : String(item.unitPrice),
      availability: item.availability,
      pharmacyNote: item.pharmacyNote.trim(),
    })),
    deliveryFee: String(quote.deliveryFee),
    serviceFee: String(quote.serviceFee),
    discount: String(quote.discount),
    tax: String(quote.tax),
    expiresAt: new Date(quote.expiresAt).toISOString(),
    pharmacyNotes: quote.pharmacyNotes.trim(),
  };
}
