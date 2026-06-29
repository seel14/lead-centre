"use client";

import { useEffect, useState } from "react";

interface Page { id: string; name: string }
interface Form { id: string; name: string; leads_count: number }

export default function Home() {
  const [pages, setPages] = useState<Page[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [pageId, setPageId] = useState("");
  const [formId, setFormId] = useState("");
  const [since, setSince] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [until, setUntil] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/pages").then(r => r.json()).then(data => {
      setPages(data);
      if (data[0]) setPageId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!pageId) return;
    setForms([]);
    setFormId("");
    fetch(`/api/forms?pageId=${pageId}`).then(r => r.json()).then(data => {
      setForms(data);
      if (data[0]) setFormId(data[0].id);
    });
  }, [pageId]);

  async function handleExport() {
    if (!pageId || !formId) return;
    setLoading(true);
    setStatus("กำลัง export...");
    try {
      const url = `/api/export?pageId=${pageId}&formId=${formId}&since=${since}&until=${until}`;
      const res = await fetch(url);
      if (!res.ok) { setStatus("❌ Export ล้มเหลว"); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `leads_${since}_${until}.xlsx`;
      a.click();
      setStatus("✅ Download สำเร็จ");
    } catch {
      setStatus("❌ เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Meta Lead Export</h1>
            <p className="text-sm text-gray-500">ดึง leads จาก Meta Lead Centre</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Page</label>
            <select
              value={pageId}
              onChange={e => setPageId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Lead Form</label>
            <select
              value={formId}
              onChange={e => setFormId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {forms.length === 0 && <option>กำลังโหลด...</option>}
              {forms.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.leads_count} leads)</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ตั้งแต่วันที่</label>
              <input
                type="date"
                value={since}
                onChange={e => setSince(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ถึงวันที่</label>
              <input
                type="date"
                value={until}
                onChange={e => setUntil(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={loading || !formId}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                กำลัง export...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Export Excel
              </>
            )}
          </button>

          {status && (
            <p className="text-center text-sm text-gray-600">{status}</p>
          )}
        </div>
      </div>
    </main>
  );
}
