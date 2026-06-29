"use client";

import { useState } from "react";

interface Page { id: string; name: string }
interface Form { id: string; name: string; leads_count: number }

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export default function Home() {
  const [token, setToken] = useState("");
  const [tokenSaved, setTokenSaved] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [pageId, setPageId] = useState("");
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<"combined" | "separate">("combined");
  const [since, setSince] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [until, setUntil] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function handleLoadPages() {
    if (!token.trim()) return;
    setStatus("กำลังโหลด pages...");
    setPages([]);
    setForms([]);
    setPageId("");
    setSelectedForms([]);
    try {
      const res = await fetch(`/api/pages?token=${encodeURIComponent(token.trim())}`);
      const data = await res.json();
      if (data.error) { setStatus("❌ " + data.error); return; }
      setPages(data);
      if (data[0]) {
        setPageId(data[0].id);
        await loadForms(data[0].id, token.trim());
      }
      setTokenSaved(true);
      setStatus("");
    } catch {
      setStatus("❌ เกิดข้อผิดพลาด");
    }
  }

  async function loadForms(pid: string, tok: string) {
    setForms([]);
    setSelectedForms([]);
    const res = await fetch(`/api/forms?pageId=${pid}&token=${encodeURIComponent(tok)}`);
    const data = await res.json();
    setForms(data);
    if (data[0]) setSelectedForms([data[0].id]);
  }

  async function handlePageChange(pid: string) {
    setPageId(pid);
    await loadForms(pid, token.trim());
  }

  function toggleForm(id: string) {
    setSelectedForms(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (selectedForms.length === forms.length) {
      setSelectedForms([]);
    } else {
      setSelectedForms(forms.map(f => f.id));
    }
  }

  async function handleExport() {
    if (!pageId || selectedForms.length === 0) return;
    setLoading(true);

    const tok = encodeURIComponent(token.trim());

    try {
      if (exportMode === "combined") {
        setStatus("กำลัง export รวมไฟล์...");
        const formIds = selectedForms.join(",");
        const formNames = selectedForms.map(id => forms.find(f => f.id === id)?.name ?? id).join("||");
        const url = `/api/export?pageId=${pageId}&formIds=${formIds}&formNames=${encodeURIComponent(formNames)}&since=${since}&until=${until}&token=${tok}&mode=combined`;
        const res = await fetch(url);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setStatus("❌ " + (err.error ?? "Export ล้มเหลว"));
          return;
        }
        const blob = await res.blob();
        downloadBlob(blob, `leads_combined_${since}_${until}.xlsx`);
        setStatus("✅ Download สำเร็จ (รวมไฟล์)");
      } else {
        setStatus(`กำลัง export แยกไฟล์ (0/${selectedForms.length})...`);
        for (let i = 0; i < selectedForms.length; i++) {
          const fid = selectedForms[i];
          const form = forms.find(f => f.id === fid);
          const url = `/api/export?pageId=${pageId}&formIds=${fid}&since=${since}&until=${until}&token=${tok}&mode=separate`;
          const res = await fetch(url);
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            setStatus("❌ " + (err.error ?? `Export ล้มเหลว: ${form?.name}`));
            return;
          }
          const blob = await res.blob();
          const safeName = (form?.name ?? fid).replace(/[^a-zA-Z0-9ก-๙]/g, "_").slice(0, 40);
          downloadBlob(blob, `leads_${safeName}_${since}_${until}.xlsx`);
          setStatus(`กำลัง export แยกไฟล์ (${i + 1}/${selectedForms.length})...`);
          await new Promise(r => setTimeout(r, 400));
        }
        setStatus(`✅ Download สำเร็จ ${selectedForms.length} ไฟล์`);
      }
    } catch {
      setStatus("❌ เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-black mb-1.5";

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
            <h1 className="text-xl font-bold text-black">Meta Lead Export</h1>
            <p className="text-sm text-gray-500">ดึง leads จาก Meta Lead Centre</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Token */}
          <div>
            <label className={labelCls}>Meta Access Token</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={token}
                onChange={e => { setToken(e.target.value); setTokenSaved(false); }}
                placeholder="EAAj..."
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleLoadPages}
                disabled={!token.trim()}
                className="px-4 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
              >
                โหลด
              </button>
            </div>
            {tokenSaved && <p className="text-xs text-green-600 mt-1">✓ โหลด pages สำเร็จ</p>}
          </div>

          {pages.length > 0 && (
            <>
              {/* Page */}
              <div>
                <label className={labelCls}>Page</label>
                <select
                  value={pageId}
                  onChange={e => handlePageChange(e.target.value)}
                  className={inputCls}
                >
                  {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Lead Forms (multi-select checkboxes) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls.replace(" mb-1.5", "")}>Lead Form</label>
                  {forms.length > 1 && (
                    <button
                      onClick={toggleAll}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {selectedForms.length === forms.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                    </button>
                  )}
                </div>
                {forms.length === 0 ? (
                  <p className="text-sm text-gray-400">กำลังโหลด...</p>
                ) : (
                  <div className="border border-gray-300 rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {forms.map(f => (
                      <label
                        key={f.id}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedForms.includes(f.id)}
                          onChange={() => toggleForm(f.id)}
                          className="w-4 h-4 accent-blue-600 flex-shrink-0"
                        />
                        <span className="text-sm text-black flex-1 min-w-0">
                          {f.name}
                          <span className="text-gray-400 ml-1">({f.leads_count})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedForms.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">เลือกแล้ว {selectedForms.length} ฟอร์ม</p>
                )}
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>ตั้งแต่วันที่</label>
                  <input type="date" value={since} onChange={e => setSince(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>ถึงวันที่</label>
                  <input type="date" value={until} onChange={e => setUntil(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Export mode */}
              <div>
                <label className={labelCls}>รูปแบบ Export</label>
                <div className="flex gap-3">
                  {(["combined", "separate"] as const).map(mode => (
                    <label
                      key={mode}
                      className={`flex-1 flex items-center gap-2 border rounded-xl px-4 py-2.5 cursor-pointer transition-colors ${
                        exportMode === mode ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="exportMode"
                        value={mode}
                        checked={exportMode === mode}
                        onChange={() => setExportMode(mode)}
                        className="accent-blue-600"
                      />
                      <span className="text-sm text-black">
                        {mode === "combined" ? "รวม 1 ไฟล์" : "แยกตามฟอร์ม"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Export button */}
              <button
                onClick={handleExport}
                disabled={loading || selectedForms.length === 0}
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
                    {selectedForms.length > 0 && ` (${selectedForms.length} ฟอร์ม)`}
                  </>
                )}
              </button>
            </>
          )}

          {status && (
            <p className="text-center text-sm text-black">{status}</p>
          )}
        </div>
      </div>
    </main>
  );
}
