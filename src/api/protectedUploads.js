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

function putFile(uploadUrl, file, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    Object.entries(headers || {}).forEach(([name, value]) => request.setRequestHeader(name, value));
    if (!headers?.["Content-Type"]) request.setRequestHeader("Content-Type", file.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("The protected file upload did not complete.")));
    request.addEventListener("error", () => reject(new Error("The protected file upload failed. Check your connection and try again.")));
    request.send(file);
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
  const intent = await apiRequest(`/api/v1/admin/orders/${encodedOrderId}/delivery-proof/upload-intents`, {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
  });

  await putFile(intent.uploadUrl, file, intent.headers, onProgress);

  return apiRequest(`/api/v1/admin/orders/${encodedOrderId}/delivery-proof/complete`, {
    method: "POST",
    body: JSON.stringify({ uploadToken: intent.uploadToken }),
  });
}

export async function uploadProtectedMessageAttachment(requestId, file, onProgress) {
  const validationError = validateRequestFile(file);
  if (validationError) throw new Error(validationError);

  const encodedRequestId = encodeURIComponent(String(requestId));
  const intent = await apiRequest(`/api/v1/medication-requests/${encodedRequestId}/message-attachments/upload-intents`, {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
  });

  await putFile(intent.uploadUrl, file, intent.headers, onProgress);

  return apiRequest(`/api/v1/medication-requests/${encodedRequestId}/message-attachments/complete`, {
    method: "POST",
    body: JSON.stringify({ uploadToken: intent.uploadToken }),
  });
}
