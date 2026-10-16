import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CalendarClock, ClipboardCheck, Loader2, RefreshCw } from "lucide-react";
import { auth } from "../../lib/firebase";

type Child = { id: string; name: string; className: string };
type Result = {
  attemptId: string;
  examId: string;
  studentId: string;
  studentName: string;
  className: string;
  title: string;
  subject: string;
  status: string;
  score?: number;
  maxScore?: number;
  percentage?: number;
  submittedAt?: string;
  releasedAt?: string;
  feedback?: string;
};

async function loadResults() {
  if (!auth.currentUser) throw new Error("Please sign in again.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/.netlify/functions/parent-examination-results", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Unable to load examination results.");
  return {
    children: Array.isArray(data.children) ? data.children as Child[] : [],
    results: Array.isArray(data.results) ? data.results as Result[] : [],
  };
}

function formatDate(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

export default function ParentExaminationResults() {
  const [children, setChildren] = useState<Child[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [selectedChild, setSelectedChild] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const data = await loadResults();
      setChildren(data.children);
      setResults(data.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load examination results.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void refresh(true); }, []);

  const visibleResults = useMemo(
    () => results.filter(result => selectedChild === "all" || result.studentId === selectedChild),
    [results, selectedChild],
  );

  const average = useMemo(() => {
    const scored = visibleResults.filter(result => typeof result.percentage === "number");
    return scored.length ? Math.round(scored.reduce((sum, result) => sum + Number(result.percentage), 0) / scored.length) : null;
  }, [visibleResults]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <header className="rounded-2xl bg-slate-900 p-6 text-white md:p-8">
        <p className="text-sm font-semibold tracking-wide text-blue-200">PARENT PORTAL</p>
        <h1 className="mt-2 text-3xl font-bold">Examination Results</h1>
        <p className="mt-2 max-w-2xl text-slate-200">Review your linked children's released examination results and teacher feedback. Results appear here only after the school or tutor releases them.</p>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-end md:justify-between md:p-6">
        <label className="block min-w-0 flex-1 text-sm font-semibold text-slate-700">
          Child
          <select className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" value={selectedChild} onChange={event => setSelectedChild(event.target.value)}>
            <option value="all">All linked children</option>
            {children.map(child => <option key={child.id} value={child.id}>{child.name}{child.className ? ` — ${child.className}` : ""}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void refresh()} disabled={loading || refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50">
          {refreshing || loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          Refresh results
        </button>
      </section>

      {!loading && !error && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <BookOpenCheck size={20} className="text-blue-700" />
            <p className="mt-3 text-sm text-slate-500">Released results</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{visibleResults.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <ClipboardCheck size={20} className="text-blue-700" />
            <p className="mt-3 text-sm text-slate-500">Average percentage</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{average === null ? "—" : `${average}%`}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <CalendarClock size={20} className="text-blue-700" />
            <p className="mt-3 text-sm text-slate-500">Linked children</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{children.length}</p>
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Loading released results…</div>
      ) : !error && children.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No linked learner profiles found</h2>
          <p className="mt-2 text-sm text-slate-600">When your parent account is linked to a learner profile, released examination results will appear here.</p>
        </section>
      ) : !error && visibleResults.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No released results yet</h2>
          <p className="mt-2 text-sm text-slate-600">Submitted examinations remain hidden here until the school or tutor releases the result.</p>
        </section>
      ) : !error && (
        <section className="space-y-3">
          {visibleResults.map(result => (
            <article key={result.attemptId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{result.subject || "Examination"}{result.className ? ` · ${result.className}` : ""}</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{result.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{result.studentName} · Released {formatDate(result.releasedAt)}</p>
                </div>
                <div className="shrink-0 rounded-xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-xs text-slate-500">Score</p>
                  <p className="text-xl font-bold text-slate-900">{typeof result.score === "number" ? result.score : "—"}{typeof result.maxScore === "number" ? ` / ${result.maxScore}` : ""}</p>
                  {typeof result.percentage === "number" && <p className="text-sm font-semibold text-slate-600">{result.percentage}%</p>}
                </div>
              </div>
              {result.feedback && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><span className="font-semibold">Teacher feedback:</span> {result.feedback}</div>}
              <p className="mt-3 text-xs text-slate-500">Submitted: {formatDate(result.submittedAt)}</p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
