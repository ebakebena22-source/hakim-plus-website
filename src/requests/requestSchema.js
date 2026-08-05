export const requestMethods = {
  prescription: "Upload prescription",
  medications: "Enter medications",
  description: "Describe what is needed",
  contact: "Contact my beneficiary",
};

export const emptyMedication = { medicationName: "", strength: "", dosageForm: "", quantity: "", notes: "" };

export const emptyMedicationRequest = {
  beneficiaryId: "",
  method: "",
  prescriptionFiles: [],
  medications: [{ ...emptyMedication }],
  description: "",
  contactInstructions: "",
  additionalNotes: "",
  additionalFiles: [],
  urgent: false,
};

export function validateRequestStep(request, step) {
  const errors = {};
  if (step >= 1 && !request.beneficiaryId) errors.beneficiaryId = "Select a beneficiary.";
  if (step >= 2 && !request.method) errors.method = "Choose how you want to send this request.";
  if (step >= 2 && request.method === "prescription" && request.prescriptionFiles.length === 0) errors.prescriptionFiles = "Add at least one prescription file.";
  if (step >= 2 && request.method === "medications") {
    request.medications.forEach((medication, index) => {
      if (!medication.medicationName.trim()) errors[`medication-${index}-name`] = "Enter the medication name.";
      if (!medication.quantity.trim()) errors[`medication-${index}-quantity`] = "Enter the requested quantity.";
    });
  }
  if (step >= 2 && request.method === "description" && request.description.trim().length < 10) errors.description = "Describe what the beneficiary needs in at least 10 characters.";
  return errors;
}

export function createRequestPayload(request, uploadedFiles) {
  return {
    beneficiaryId: request.beneficiaryId,
    submissionMethod: request.method,
    medications: request.method === "medications" ? request.medications.map((item) => ({
      medicationName: item.medicationName.trim(),
      strength: item.strength.trim(),
      dosageForm: item.dosageForm.trim(),
      quantity: item.quantity.trim(),
      notes: item.notes.trim(),
    })) : [],
    description: request.method === "description" ? request.description.trim() : "",
    contactBeneficiary: request.method === "contact",
    contactInstructions: request.method === "contact" ? request.contactInstructions.trim() : "",
    fileReferences: uploadedFiles,
    additionalNotes: request.additionalNotes.trim(),
    urgent: request.urgent,
    accuracyConfirmed: true,
  };
}
