export const emptyBeneficiary = {
  fullName: "",
  relationship: "",
  dateOfBirth: "",
  age: "",
  sex: "prefer-not-to-provide",
  phone: "",
  alternativePhone: "",
  email: "",
  country: "Ethiopia",
  city: "",
  subCity: "",
  woreda: "",
  neighborhood: "",
  deliveryAddress: "",
  landmark: "",
  deliveryInstructions: "",
  knownAllergies: "",
  currentMedications: "",
  chronicConditions: "",
  medicalNotes: "",
  preferNotToProvideMedicalInfo: false,
  contactConsent: false,
};

function clean(value) {
  return typeof value === "string" ? value.trim() : value;
}

export function normalizeBeneficiary(input) {
  return Object.fromEntries(
    Object.entries({ ...emptyBeneficiary, ...input }).map(([key, value]) => [key, clean(value)]),
  );
}

export function validateBeneficiary(input) {
  const beneficiary = normalizeBeneficiary(input);
  const errors = {};

  if (!beneficiary.fullName) errors.fullName = "Enter the beneficiary's full name.";
  if (!beneficiary.relationship) errors.relationship = "Select or enter the relationship.";
  if (!beneficiary.phone) errors.phone = "Enter a phone number Hakim Plus can use.";
  if (!beneficiary.city) errors.city = "Enter the delivery city.";
  if (!beneficiary.deliveryAddress) errors.deliveryAddress = "Enter a delivery address.";
  if (!beneficiary.dateOfBirth && !beneficiary.age) errors.age = "Provide a date of birth or approximate age.";
  if (beneficiary.age && (!/^\d{1,3}$/.test(String(beneficiary.age)) || Number(beneficiary.age) > 130)) errors.age = "Enter a valid age.";
  if (!beneficiary.contactConsent) errors.contactConsent = "Contact authorization is required to save this beneficiary.";

  return { beneficiary, errors, valid: Object.keys(errors).length === 0 };
}
