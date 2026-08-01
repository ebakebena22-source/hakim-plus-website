import { apiRequest } from "./client";

export const allowedRequestFileTypes = ["image/jpeg", "image/png", "application/pdf"];
export const maxRequestFileSize = 2.5 * 1024 * 1024;

export function validateRequestFile(file) {
  if (!allowedRequestFileTypes.includes(file.type)) return "Only JPG, PNG, and PDF files are accepted.";
  if (file.size > maxRequestFileSize) return "Each file must be 2.5 MB or smaller.";
  return "";
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("The selected file could not be read.")));
    reader.readAsDataURL(file);
  });
}

export async function uploadProtectedRequestFile(file, onProgress) {
  const validationError = validateRequestFile(file);
  if (validationError) throw new Error(validationError);

  onProgress?.(10);
  const dataUrl = await readAsDataUrl(file);
  onProgress?.(45);
  const completed = await apiRequest("/api/v1/request-files", {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size, dataUrl }),
  });
  onProgress?.(100);
  return completed;
}

export async function uploadProtectedDeliveryProof(orderId, file, onProgress) {
  const validationError = validateRequestFile(file);
  if (validationError) throw new Error(validationError);

  const encodedOrderId = encodeURIComponent(String(orderId));
  onProgress?.(10);
  const dataUrl = await readAsDataUrl(file);
  onProgress?.(45);
  const completed = await apiRequest(`/api/v1/admin/orders/${encodedOrderId}/delivery-proof`, {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size, dataUrl }),
  });
  onProgress?.(100);
  return completed;
}

export async function uploadProtectedMessageAttachment(requestId, file, onProgress) {
  const validationError = validateRequestFile(file);
  if (validationError) throw new Error(validationError);

  const encodedRequestId = encodeURIComponent(String(requestId));
  onProgress?.(10);
  const dataUrl = await readAsDataUrl(file);
  onProgress?.(45);
  const completed = await apiRequest(`/api/v1/medication-requests/${encodedRequestId}/message-attachments`, {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size, dataUrl }),
  });
  onProgress?.(100);
  return completed;
}
