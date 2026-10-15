import { useMemo, useState, useEffect } from "react";
import { BookOpenCheck, Clock3, LockKeyhole, ShieldCheck, Eye, EyeOff, CircleAlert, CalendarDays } from "lucide-react";
import { auth } from "../../lib/firebase";

type ExamCard = { id: string; title: string; subject: string; status: "active" | "upcoming" | "completed"; durationMinutes: number; availableFrom?: string; availableUntil?: string; attemptId?: string; attemptStatus?: string; score?: number; releasedAt?: unknown; };
const api = async (path: string, options: RequestInit = {}) => {
  if (!auth.currentUser) throw new Error("Please sign in again.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "We could not complete that request.");
  return data;
};

/** Student-facing JDI exam list. The server must provide the exam list and validate passcodes. */
export default function StudentExaminations() {
  const [tab, setTab] = useState<"active" | "upcoming" | "completed">("active");
  const [exams, setExams] = useState<ExamCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [passcodes, setPasscodes] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; error?: boolean } | null>(null);
  const filtered = useMemo(() => exams.filter(e => e.status === tab), [exams, tab]);

  const load = async () => {
    setLoading(true); setMessage(null);
    try { const result = await api("/.netlify/functions/student-examinations"); setExams(Array.isArray(result.exams) ? result.exams : []); }
    catch (error) { setMessage({ id: "list", text: error instanceof Error ? error.message : "Examinations are temporarily unavailable.", error: true }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  // Refresh manually rather than polling continuously to keep free-tier reads low.
  const unlock = async (examId: string) => {
    const passcode = (passcodes[examId] || "").trim();
    if (!passcode) { setMessage({ id: examId, text: "Enter the passcode provided by your school.", error: true }); return; }
    setBusy(examId); setMessage(null);
    try {
      const result = await api("/.netlify/functions/examination-passcode", { method: "POST", body: JSON.stringify({ examId, passcode }) });
      if (!result.attemptId) throw new Error("The server did not return a valid examination session.");
      window.location.assign(`/portal/student/exams/${encodeURIComponent(result.attemptId)}`);
    } catch (error) {
      setMessage({ id: examId, text: error instanceof Error ? error.message : "Passcode could not be validated.", error: true });
    } finally { setBusy(null); }
  };

  return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
    <header className="rounded-2xl bg-slate-900 p-6 text-white md:p-8">
      <p className="text-sm font-semibold tracking-wide text-blue-200">JAYSTARBLISS DYNAMIC INSTITUTE · JDI</p>
      <h1 className="mt-2 text-3xl font-bold">My Examinations</h1>
      <p className="mt-2 max-w-2xl text-slate-200">View your assigned tests. An authorised school passcode is required to begin an active examination.</p>
    </header>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {(["active", "upcoming", "completed"] as const).map(item => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${tab === item ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{item} tests</button>)}
        <button type="button" onClick={load} disabled={loading} className="ml-auto rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{loading ? "Loading…" : "Refresh tests"}</button>
      </div>
      {message?.id === "list" && <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{message.text}</div>}
      {!loading && exams.length === 0 && !message && <div className="py-12 text-center"><BookOpenCheck className="mx-auto mb-3 text-blue-600" size={40}/><h2 className="text-lg font-semibold text-slate-900">Your tests will appear here</h2><p className="mt-1 text-sm text-slate-600">Refresh to check for examinations assigned to your school account.</p><button onClick={load} className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white">Load examinations</button></div>}
      {filtered.length === 0 && exams.length > 0 && <p className="py-10 text-center text-sm text-slate-500">There are no {tab} tests to show right now.</p>}
      <div className="mt-4 grid gap-4">
        {filtered.map(exam => <article key={exam.id} className="rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><BookOpenCheck size={28}/></div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-slate-900">{exam.title}</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${exam.status === "active" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>{exam.status}</span></div>
              <p className="mt-1 text-sm text-slate-600">{exam.subject}</p>{exam.attemptStatus && <p className="mt-2 text-sm font-medium text-slate-700">Your attempt: <span className="capitalize">{exam.attemptStatus.replace("_"," ")}</span>{exam.releasedAt && exam.score !== undefined ? " · Released score: "+exam.score : ""}</p>}
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600"><span className="inline-flex items-center gap-1"><Clock3 size={16}/>{exam.durationMinutes} minutes</span>{exam.availableFrom && <span className="inline-flex items-center gap-1"><CalendarDays size={16}/>{new Date(exam.availableFrom).toLocaleString()}</span>}</div>
            </div>
          </div>
          {exam.status === "active" && <div className="mt-5 rounded-xl bg-blue-50 p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-900"><LockKeyhole size={18}/> Enter examination passcode</div>
            <p className="mt-1 text-sm text-slate-600">Use the code supplied by your school administrator or teacher. The code is validated securely by the server.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1"><input aria-label={`Passcode for ${exam.title}`} autoComplete="off" value={passcodes[exam.id] || ""} onChange={e => setPasscodes(prev => ({...prev, [exam.id]: e.target.value}))} type={visible[exam.id] ? "text" : "password"} maxLength={128} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Enter passcode" /><button type="button" aria-label={visible[exam.id] ? "Hide passcode" : "Show passcode"} onClick={() => setVisible(prev => ({...prev, [exam.id]: !prev[exam.id]}))} className="absolute right-3 top-3 text-slate-500">{visible[exam.id] ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>
              <button type="button" disabled={busy === exam.id} onClick={() => unlock(exam.id)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><LockKeyhole size={17}/>{busy === exam.id ? "Validating…" : "Unlock test"}</button>
            </div>
            {message?.id === exam.id && <p role="alert" className={`mt-3 flex items-start gap-2 text-sm ${message.error ? "text-red-700" : "text-green-700"}`}><CircleAlert size={17} className="mt-0.5 shrink-0"/>{message.text}</p>}
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-600"><ShieldCheck size={16}/> Your passcode is not saved in browser storage or included in page URLs.</p>
          </div>}
        </article>)}
      </div>
    </section>
  </main>;
}
