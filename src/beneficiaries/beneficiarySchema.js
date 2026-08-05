import { emailError, phoneError } from "../validation/contact.js";

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
  const primaryPhoneError = phoneError(beneficiary.phone);
  const alternativePhoneError = phoneError(beneficiary.alternativePhone, { required: false });
  const beneficiaryEmailError = emailError(beneficiary.email, { required: false });
  if (primaryPhoneError) errors.phone = primaryPhoneError;
  if (alternativePhoneError) errors.alternativePhone = alternativePhoneError;
  if (beneficiaryEmailError) errors.email = beneficiaryEmailError;
  if (!beneficiary.country) errors.country = "Enter the delivery country.";
  if (!beneficiary.city) errors.city = "Enter the delivery city.";
  if (!beneficiary.deliveryAddress) errors.deliveryAddress = "Enter a delivery address.";
  if (!beneficiary.age) errors.age = "Enter the beneficiary's approximate age.";
  if (beneficiary.age && (!/^\d{1,3}$/.test(String(beneficiary.age)) || Number(beneficiary.age) > 130)) errors.age = "Enter a valid age.";
  if (!beneficiary.contactConsent) errors.contactConsent = "Contact authorization is required to save this beneficiary.";

  return { beneficiary, errors, valid: Object.keys(errors).length === 0 };
}
