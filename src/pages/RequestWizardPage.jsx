import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { beneficiariesApi } from "../api/beneficiaries";
import { requestsApi } from "../api/requests";
import { uploadProtectedRequestFile, validateRequestFile } from "../api/protectedUploads";
import { createRequestPayload, emptyMedication, emptyMedicationRequest, requestMethods, validateRequestStep } from "../requests/requestSchema";

const steps = ["Beneficiary", "Request", "Details", "Review"];

function createAttachment(file) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    file,
    previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
    progress: 0,
  };
}

function StepHeader({ current }) {
  return <div><div className="flex items-center justify-between gap-2" aria-label={`Step ${current} of 4`}>{steps.map((label, index) => <div key={label} className="flex flex-1 items-center gap-2"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${index + 1 <= current ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>{index + 1}</span><span className={`hidden text-xs font-bold sm:block ${index + 1 <= current ? "text-slate-900" : "text-slate-400"}`}>{label}</span>{index < steps.length - 1 && <span className={`h-0.5 flex-1 ${index + 1 < current ? "bg-emerald-500" : "bg-slate-200"}`} />}</div>)}</div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${current * 25}%` }} /></div></div>;
}

function FilePicker({ label, help, files, onChange, error, disabled }) {
  const [fileError, setFileError] = useState("");

  function addFiles(event) {
    const selected = Array.from(event.target.files || []);
    const invalid = selected.map(validateRequestFile).find(Boolean);
    if (invalid) { setFileError(invalid); event.target.value = ""; return; }
    setFileError("");
    onChange([...files, ...selected.map(createAttachment)]);
    event.target.value = "";
  }

  function removeFile(id) {
    const attachment = files.find((item) => item.id === id);
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    onChange(files.filter((item) => item.id !== id));
  }

  return <div><label className={`block rounded-2xl border-2 border-dashed p-6 text-center transition ${error || fileError ? "border-red-300 bg-red-50" : "border-slate-300 bg-slate-50 hover:border-emerald-400"}`}><span className="block text-sm font-bold text-slate-900">{label}</span><span className="mt-2 block text-xs leading-5 text-slate-500">{help}</span><input className="sr-only" type="file" accept="image/jpeg,image/png,application/pdf" multiple onChange={addFiles} disabled={disabled} /><span className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm">Choose files</span></label>{(error || fileError) && <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{error || fileError}</p>}{files.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{files.map((attachment) => <div key={attachment.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">{attachment.previewUrl ? <img className="h-14 w-14 rounded-xl object-cover" src={attachment.previewUrl} alt="Selected prescription preview" /> : <span className="grid h-14 w-14 place-items-center rounded-xl bg-red-50 text-xs font-bold text-red-700">PDF</span>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{attachment.file.name}</p><p className="mt-1 text-xs text-slate-500">{(attachment.file.size / 1024 / 1024).toFixed(1)} MB</p>{attachment.progress > 0 && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-600" style={{ width: `${attachment.progress}%` }} /></div>}</div><button className="rounded-lg px-2 py-1 text-xs font-bold text-red-700" type="button" onClick={() => removeFile(attachment.id)} disabled={disabled}>Remove</button></div>)}</div>}</div>;
}

function MedicationEditor({ medications, onChange, errors }) {
  function update(index, name, value) { onChange(medications.map((item, itemIndex) => itemIndex === index ? { ...item, [name]: value } : item)); }
  function remove(index) { if (medications.length > 1) onChange(medications.filter((_, itemIndex) => itemIndex !== index)); }
  return <div className="space-y-4">{medications.map((medication, index) => <fieldset key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><legend className="px-2 text-sm font-bold text-slate-900">Medication {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Medication name<input id={`medication-${index}-name`} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none focus:border-emerald-600" value={medication.medicationName} onChange={(event) => update(index, "medicationName", event.target.value)} />{errors[`medication-${index}-name`] && <span className="mt-1 block text-xs text-red-700">{errors[`medication-${index}-name`]}</span>}</label><label className="text-sm font-semibold">Strength<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none focus:border-emerald-600" placeholder="10 mg" value={medication.strength} onChange={(event) => update(index, "strength", event.target.value)} /></label><label className="text-sm font-semibold">Dosage form<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none focus:border-emerald-600" placeholder="Tablet" value={medication.dosageForm} onChange={(event) => update(index, "dosageForm", event.target.value)} /></label><label className="text-sm font-semibold">Quantity<input id={`medication-${index}-quantity`} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none focus:border-emerald-600" placeholder="30 tablets" value={medication.quantity} onChange={(event) => update(index, "quantity", event.target.value)} />{errors[`medication-${index}-quantity`] && <span className="mt-1 block text-xs text-red-700">{errors[`medication-${index}-quantity`]}</span>}</label><label className="text-sm font-semibold sm:col-span-2">Notes<textarea className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none focus:border-emerald-600" value={medication.notes} onChange={(event) => update(index, "notes", event.target.value)} /></label></div>{medications.length > 1 && <button className="mt-4 text-sm font-bold text-red-700" type="button" onClick={() => remove(index)}>Remove medication</button>}</fieldset>)}<button className="rounded-xl border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-700" type="button" onClick={() => onChange([...medications, { ...emptyMedication }])}>Add another medication</button></div>;
}

export default function RequestWizardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetBeneficiaryId = searchParams.get("beneficiary");
  const [step, setStep] = useState(1);
  const [request, setRequest] = useState(emptyMedicationRequest);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(true);
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState("idle");
  const [submitError, setSubmitError] = useState("");
  const attachmentsRef = useRef([]);

  useEffect(() => {
    attachmentsRef.current = [...request.prescriptionFiles, ...request.additionalFiles];
  }, [request.prescriptionFiles, request.additionalFiles]);

  useEffect(() => {
    let active = true;
    beneficiariesApi.list().then((result) => { if (active) { setBeneficiaries(result.beneficiaries || result.items || []); if (presetBeneficiaryId) setRequest((current) => ({ ...current, beneficiaryId: presetBeneficiaryId })); setLoadingBeneficiaries(false); } }).catch((error) => { if (active) { setSubmitError(error.message); setLoadingBeneficiaries(false); } });
    return () => { active = false; };
  }, [presetBeneficiaryId]);

  useEffect(() => () => {
    attachmentsRef.current.forEach((attachment) => { if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl); });
  }, []);

  const selectedBeneficiary = useMemo(() => beneficiaries.find((item) => String(item.publicId || item.id) === String(request.beneficiaryId)), [beneficiaries, request.beneficiaryId]);
  function update(name, value) { setRequest((current) => ({ ...current, [name]: value })); }

  function nextStep() {
    const stepErrors = validateRequestStep(request, step);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) { setStep((current) => Math.min(4, current + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  function updateProgress(id, progress) {
    setRequest((current) => ({ ...current, prescriptionFiles: current.prescriptionFiles.map((item) => item.id === id ? { ...item, progress } : item), additionalFiles: current.additionalFiles.map((item) => item.id === id ? { ...item, progress } : item) }));
  }

  async function submitRequest() {
    const finalErrors = validateRequestStep(request, 4);
    setErrors(finalErrors);
    if (Object.keys(finalErrors).length > 0) return;
    setSubmitState("uploading");
    setSubmitError("");
    try {
      const uploadedFiles = [];
      const attachments = [...request.prescriptionFiles.map((item) => ({ ...item, role: "prescription" })), ...request.additionalFiles.map((item) => ({ ...item, role: "supporting" }))];
      for (const attachment of attachments) {
        const completed = await uploadProtectedRequestFile(attachment.file, (progress) => updateProgress(attachment.id, progress));
        uploadedFiles.push({ fileReference: completed.fileReference || completed.id, role: attachment.role });
      }
      setSubmitState("submitting");
      const result = await requestsApi.create(createRequestPayload(request, uploadedFiles));
      const created = result.request || result;
      navigate(`/dashboard/requests/${encodeURIComponent(created.publicId || created.id)}/confirmation`, { replace: true });
    } catch (error) {
      setSubmitError(error.message);
      setSubmitState("idle");
    }
  }

  const busy = submitState !== "idle";
  return <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-4xl"><Link className="text-sm font-bold text-slate-500 hover:text-emerald-700" to="/dashboard/requests">← Medication requests</Link><div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-bold text-emerald-700">New medication request</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Tell Hakim Plus what your loved one needs</h1><p className="mt-3 text-sm leading-6 text-slate-600">You will receive a quote only after the pharmacy reviews and confirms your request.</p><div className="mt-8"><StepHeader current={step} /></div>
      {submitError && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{submitError}</div>}
      {step === 1 && <section className="mt-8"><h2 className="text-xl font-bold">Who is this request for?</h2>{errors.beneficiaryId && <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{errors.beneficiaryId}</p>}{loadingBeneficiaries ? <p className="mt-6 text-sm text-slate-500">Loading beneficiaries…</p> : beneficiaries.length === 0 ? <div className="mt-6 rounded-2xl bg-slate-50 p-6"><p className="font-bold">Add a beneficiary first</p><p className="mt-2 text-sm text-slate-600">Contact, consent, and delivery information must be saved before a request can be submitted.</p><Link className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white" to="/dashboard/beneficiaries/new">Add beneficiary</Link></div> : <div className="mt-6 grid gap-4 sm:grid-cols-2">{beneficiaries.map((beneficiary) => { const id = beneficiary.publicId || beneficiary.id; const selected = String(id) === String(request.beneficiaryId); return <button key={id} className={`rounded-2xl border-2 p-5 text-left transition ${selected ? "border-emerald-600 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"}`} type="button" onClick={() => update("beneficiaryId", id)}><span className="block font-bold">{beneficiary.fullName}</span><span className="mt-1 block text-sm text-slate-500">{beneficiary.relationship} · {beneficiary.city}</span><span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold ${selected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>{selected ? "Selected" : "Select"}</span></button>; })}</div>}</section>}
      {step === 2 && <section className="mt-8"><h2 className="text-xl font-bold">How can we help?</h2>{errors.method && <p className="mt-2 text-sm font-semibold text-red-700">{errors.method}</p>}<div className="mt-6 grid gap-3 sm:grid-cols-2">{Object.entries(requestMethods).map(([value, label]) => <button key={value} className={`rounded-2xl border-2 p-5 text-left ${request.method === value ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}`} type="button" onClick={() => update("method", value)}><span className="font-bold">{label}</span><span className="mt-2 block text-xs leading-5 text-slate-500">{value === "prescription" && "Upload clear JPG, PNG, or PDF prescription files."}{value === "medications" && "Enter known medication details for pharmacy review."}{value === "description" && "Explain what is needed without requesting an automated diagnosis."}{value === "contact" && "Ask Hakim Plus to contact the authorized beneficiary."}</span></button>)}</div>
        {request.method === "prescription" && <div className="mt-6"><FilePicker label="Upload prescription" help="JPG, PNG, or PDF · maximum 2.5 MB each · files are uploaded to private storage" files={request.prescriptionFiles} onChange={(files) => update("prescriptionFiles", files)} error={errors.prescriptionFiles} disabled={busy} /></div>}
        {request.method === "medications" && <div className="mt-6"><MedicationEditor medications={request.medications} onChange={(medications) => update("medications", medications)} errors={errors} /><p className="mt-4 rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">Hakim Plus will review the request. The portal does not prescribe, substitute, or change dosage automatically.</p></div>}
        {request.method === "description" && <label className="mt-6 block text-sm font-semibold" htmlFor="request-description">Tell us what your beneficiary needs<textarea id="request-description" className="mt-2 min-h-36 w-full rounded-xl border border-slate-300 p-4 font-normal outline-none focus:border-emerald-600" placeholder="My mother needs her usual monthly blood pressure medicines…" value={request.description} onChange={(event) => update("description", event.target.value)} />{errors.description && <span className="mt-2 block text-xs text-red-700">{errors.description}</span>}<span className="mt-2 block text-xs font-normal leading-5 text-slate-500">Do not rely on this field for emergency care or automated diagnosis.</span></label>}
        {request.method === "contact" && <div className="mt-6 rounded-2xl bg-emerald-50 p-5"><p className="text-sm font-bold text-emerald-950">Hakim Plus may contact {selectedBeneficiary?.fullName}</p><p className="mt-1 text-sm text-emerald-800">{selectedBeneficiary?.phone}</p><label className="mt-4 block text-sm font-semibold text-emerald-950">Contact instructions<textarea className="mt-2 min-h-24 w-full rounded-xl border border-emerald-200 bg-white p-4 font-normal" placeholder="Please call after 5 PM." value={request.contactInstructions} onChange={(event) => update("contactInstructions", event.target.value)} /></label></div>}
      </section>}
      {step === 3 && <section className="mt-8 space-y-6"><div><h2 className="text-xl font-bold">Additional information</h2><p className="mt-2 text-sm text-slate-600">Help the pharmacy review and coordinate this request.</p></div><label className="block text-sm font-semibold">Additional notes<textarea className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 p-4 font-normal outline-none focus:border-emerald-600" value={request.additionalNotes} onChange={(event) => update("additionalNotes", event.target.value)} /></label><FilePicker label="Add supporting files (optional)" help="JPG, PNG, or PDF · maximum 10 MB each" files={request.additionalFiles} onChange={(files) => update("additionalFiles", files)} disabled={busy} /><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Preferred contact method<select className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" value={request.preferredContactMethod} onChange={(event) => update("preferredContactMethod", event.target.value)}><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option></select></label><label className="text-sm font-semibold">Preferred delivery timing<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" placeholder="Weekday afternoon, if possible" value={request.preferredDeliveryTiming} onChange={(event) => update("preferredDeliveryTiming", event.target.value)} /></label></div><label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><input className="mt-1 h-5 w-5 accent-amber-700" type="checkbox" checked={request.urgent} onChange={(event) => update("urgent", event.target.checked)} /><span><strong className="block">This request is urgent</strong>Urgent requests are flagged for pharmacy staff but do not guarantee emergency service.</span></label><p className="rounded-xl bg-red-50 p-4 text-xs font-semibold leading-5 text-red-800">Hakim Plus is not an emergency medical service. For medical emergencies, seek appropriate emergency care.</p></section>}
      {step === 4 && <section className="mt-8"><h2 className="text-xl font-bold">Review your request</h2><div className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-6 text-sm sm:grid-cols-2"><div><p className="text-xs font-bold uppercase text-slate-400">Beneficiary</p><p className="mt-2 font-bold">{selectedBeneficiary?.fullName}</p><p className="text-slate-500">{selectedBeneficiary?.city}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Request method</p><p className="mt-2 font-bold">{requestMethods[request.method]}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Files</p><p className="mt-2 font-bold">{request.prescriptionFiles.length + request.additionalFiles.length}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Urgent flag</p><p className="mt-2 font-bold">{request.urgent ? "Yes" : "No"}</p></div>{request.method === "medications" && <div className="sm:col-span-2"><p className="text-xs font-bold uppercase text-slate-400">Medications</p><ul className="mt-2 space-y-1">{request.medications.map((item, index) => <li key={index}>{item.medicationName} {item.strength} · {item.quantity}</li>)}</ul></div>}{request.description && <div className="sm:col-span-2"><p className="text-xs font-bold uppercase text-slate-400">Description</p><p className="mt-2 whitespace-pre-wrap">{request.description}</p></div>}{request.additionalNotes && <div className="sm:col-span-2"><p className="text-xs font-bold uppercase text-slate-400">Additional notes</p><p className="mt-2 whitespace-pre-wrap">{request.additionalNotes}</p></div>}</div><label className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950"><input className="mt-1 h-5 w-5 accent-emerald-600" type="checkbox" checked={request.accuracyConfirmed} onChange={(event) => update("accuracyConfirmed", event.target.checked)} /><span><strong className="block">Accuracy confirmation</strong>The information I provided is accurate to the best of my knowledge.</span></label>{errors.accuracyConfirmed && <p className="mt-2 text-sm font-semibold text-red-700">{errors.accuracyConfirmed}</p>}<div className="mt-6 rounded-2xl border border-slate-200 p-5 text-sm leading-6 text-slate-600"><strong className="text-slate-900">What happens next?</strong><p className="mt-1">The pharmacy reviews the request, confirms availability and pricing, and contacts you if more information is needed. Payment is requested only after review.</p></div></section>}
      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-between">{step > 1 ? <button className="min-h-12 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700" type="button" onClick={() => setStep((current) => current - 1)} disabled={busy}>Back</button> : <span />}{step < 4 ? <button className="min-h-12 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white" type="button" onClick={nextStep}>Continue</button> : <button className="min-h-12 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white disabled:bg-slate-300" type="button" onClick={submitRequest} disabled={busy}>{submitState === "uploading" ? "Uploading securely…" : submitState === "submitting" ? "Submitting request…" : "Submit medication request"}</button>}</div>
    </div></div></main>;
}
