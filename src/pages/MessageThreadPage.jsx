import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { messagesApi } from "../api/messages";
import { uploadProtectedMessageAttachment, validateRequestFile } from "../api/protectedUploads";

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function MessageThreadPage() {
  const { id } = useParams();
  const [state, setState] = useState({ status: "loading", request: null, messages: [], nextCursor: "", error: "" });
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => { let active = true; messagesApi.getRequestThread(id).then((result) => { if (active) setState({ status: "ready", request: result.request || null, messages: result.messages || result.items || [], nextCursor: result.nextCursor || "", error: "" }); }).catch((error) => { if (active) setState({ status: "error", request: null, messages: [], nextCursor: "", error: error.message }); }); return () => { active = false; }; }, [id]);

  function addFiles(event) {
    const selected = Array.from(event.target.files || []);
    const invalid = selected.map(validateRequestFile).find(Boolean);
    if (invalid) { setState((current) => ({ ...current, error: invalid })); event.target.value = ""; return; }
    if (files.length + selected.length > 5) { setState((current) => ({ ...current, error: "Attach no more than five files to one message." })); event.target.value = ""; return; }
    setFiles((current) => [...current, ...selected.map((file) => ({ id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, file, progress: 0 }))]);
    setState((current) => ({ ...current, error: "" }));
    event.target.value = "";
  }

  async function loadOlder() {
    if (!state.nextCursor) return;
    try { const result = await messagesApi.getRequestThread(id, { cursor: state.nextCursor }); setState((current) => ({ ...current, messages: [...(result.messages || result.items || []), ...current.messages], nextCursor: result.nextCursor || "" })); }
    catch (error) { setState((current) => ({ ...current, error: error.message })); }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!text.trim() && files.length === 0) return setState((current) => ({ ...current, error: "Write a message or attach a file." }));
    setSending(true);
    setState((current) => ({ ...current, error: "" }));
    try {
      const fileReferences = [];
      for (const attachment of files) {
        const uploaded = await uploadProtectedMessageAttachment(id, attachment.file, (progress) => setFiles((current) => current.map((item) => item.id === attachment.id ? { ...item, progress } : item)));
        fileReferences.push(uploaded.fileReference || uploaded.id);
      }
      const result = await messagesApi.sendRequestMessage(id, { message: text.trim(), fileReferences });
      const sent = result.message;
      if (sent) setState((current) => ({ ...current, messages: [...current.messages, sent] }));
      else { const refreshed = await messagesApi.getRequestThread(id); setState({ status: "ready", request: refreshed.request || state.request, messages: refreshed.messages || refreshed.items || [], nextCursor: refreshed.nextCursor || "", error: "" }); }
      setText("");
      setFiles([]);
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setSending(false);
    }
  }

  if (state.status === "loading") return <main className="grid min-h-screen place-items-center bg-slate-50" role="status"><p className="font-semibold text-slate-600">Loading secure conversation…</p></main>;
  if (state.status === "error" && !state.request) return <main className="px-5 py-10"><div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800" role="alert">{state.error}</div></main>;
  return <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-4xl"><Link className="text-sm font-bold text-slate-500" to={`/dashboard/requests/${encodeURIComponent(id)}`}>← Request {state.request?.requestNumber || id}</Link><div className="mt-5"><p className="text-sm font-bold text-emerald-700">Request conversation</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Message Hakim Plus</h1><p className="mt-3 text-sm leading-6 text-slate-600">Keep questions, pharmacy replies, attachments, and system events attached to this medication request.</p></div>{state.error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{state.error}</div>}<section className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white"><div className="border-b border-slate-200 p-4 text-center">{state.nextCursor ? <button className="text-sm font-bold text-emerald-700" type="button" onClick={loadOlder}>Load older messages</button> : <p className="text-xs text-slate-400">Start of request conversation</p>}</div><div className="space-y-5 p-5 sm:p-8">{state.messages.length === 0 && <div className="py-8 text-center"><h2 className="font-bold">No messages yet</h2><p className="mt-2 text-sm text-slate-600">Send a request-specific question to Hakim Plus.</p></div>}{state.messages.map((message,index) => { const system = message.type === "system"; const customer = message.senderType === "customer"; if (system) return <div key={message.id || index} className="mx-auto max-w-2xl rounded-xl bg-slate-100 p-3 text-center text-xs font-semibold text-slate-600"><p>{message.message}</p><p className="mt-1 font-normal text-slate-400">{formatDate(message.createdAt)}</p></div>; return <article key={message.id || index} className={`max-w-[85%] rounded-2xl p-4 ${customer ? "ml-auto bg-emerald-600 text-white" : "mr-auto border border-slate-200 bg-slate-50 text-slate-900"}`}><div className="flex items-center justify-between gap-4"><p className={`text-xs font-bold ${customer ? "text-emerald-100" : "text-emerald-700"}`}>{customer ? "You" : message.senderName || "Hakim Plus Pharmacy"}</p><p className={`text-[10px] ${customer ? "text-emerald-100" : "text-slate-400"}`}>{formatDate(message.createdAt)}</p></div>{message.message && <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.message}</p>}{message.attachments?.length > 0 && <div className="mt-3 grid gap-2">{message.attachments.map((attachment) => <a key={attachment.id || attachment.fileReference} className={`rounded-xl p-3 text-xs font-bold ${customer ? "bg-white/15 text-white" : "bg-white text-emerald-700"}`} href={attachment.viewUrl} target="_blank" rel="noreferrer">{attachment.fileName || "View protected attachment"}</a>)}</div>}</article>; })}</div><form className="border-t border-slate-200 bg-slate-50 p-5" onSubmit={sendMessage}><label className="text-sm font-bold" htmlFor="request-message">Message</label><textarea id="request-message" className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white p-4 text-sm" placeholder="Ask about this request…" value={text} onChange={(event) => setText(event.target.value)} />{files.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{files.map((attachment) => <div key={attachment.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate font-semibold">{attachment.file.name}</p><button className="text-xs font-bold text-red-700" type="button" disabled={sending} onClick={() => setFiles((current) => current.filter((item) => item.id !== attachment.id))}>Remove</button></div>{attachment.progress > 0 && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-600" style={{ width: `${attachment.progress}%` }} /></div>}</div>)}</div>}<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700">Attach image or PDF<input className="sr-only" type="file" accept="image/jpeg,image/png,application/pdf" multiple disabled={sending} onChange={addFiles} /></label><button className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:bg-slate-300" type="submit" disabled={sending}>{sending ? "Sending securely…" : "Send message"}</button></div><p className="mt-3 text-xs leading-5 text-slate-500">Attachments are private, authenticated, validated, and attached only to this request.</p></form></section></div></main>;
}
