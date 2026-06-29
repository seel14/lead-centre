"use client";

import { useState, useEffect } from "react";

declare global {
  interface Window {
    FB: {
      login: (cb: (res: { authResponse?: { accessToken: string } }) => void, opts: { scope: string }) => void;
      logout: (cb: () => void) => void;
      getLoginStatus: (cb: (res: { status: string; authResponse?: { accessToken: string } }) => void) => void;
    };
  }
}

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
  const [userName, setUserName] = useState("");
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
  const [fbReady, setFbReady] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.FB) {
        setFbReady(true);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  async function loadPages(tok: string) {
    setStatus("กำลังโหลด pages...");
    setPages([]);
    setForms([]);
    setPageId("");
    setSelectedForms([]);
    const res = await fetch(`/api/pages?token=${encodeURIComponent(tok)}`);
    const data = await res.json();
    if (data.error) { setStatus("❌ " + data.error); return; }
    setPages(data);
    if (data[0]) {
      setPageId(data[0].id);
      await loadForms(data[0].id, tok);
    }
    setStatus("");
  }

  async function loadForms(pid: string, tok: string) {
    setForms([]);
    setSelectedForms([]);
    const res = await fetch(`/api/forms?pageId=${pid}&token=${encodeURIComponent(tok)}`);
    const data = await res.json();
    setForms(data);
    if (data[0]) setSelectedForms([data[0].id]);
  }

  function handleFbLogin() {
    if (!window.FB) return;
    window.FB.login(async (res) => {
      if (!res.authResponse?.accessToken) return;
      const tok = res.authResponse.accessToken;
      setToken(tok);
      // get user name
      const me = await fetch(`https://graph.facebook.com/v21.0/me?fields=name&access_token=${tok}`).then(r => r.json());
      setUserName(me.name ?? "");
      await loadPages(tok);
    }, { scope: "pages_show_list,leads_retrieval,pages_manage_ads,pages_read_engagement" });
  }

  function handleLogout() {
    window.FB?.logout(() => {});
    setToken("");
    setUserName("");
    setPages([]);
    setForms([]);
    setPageId("");
    setSelectedForms([]);
    setStatus("");
  }

  async function handlePageChange(pid: string) {
    setPageId(pid);
    await loadForms(pid, token);
  }

  function toggleForm(id: string) {
    setSelectedForms(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    setSelectedForms(selectedForms.length === forms.length ? [] : forms.map(f => f.id));
  }

  async function handleExport() {
    if (!pageId || selectedForms.length === 0) return;
    setLoading(true);
    const tok = encodeURIComponent(token);
    try {
      if (exportMode === "combined") {
        setStatus("กำลัง export รวมไฟล์...");
        const formIds = selectedForms.join(",");
        const formNames = selectedForms.map(id => forms.find(f => f.id === id)?.name ?? id).join("||");
        const url = `/api/export?pageId=${pageId}&formIds=${formIds}&formNames=${encodeURIComponent(formNames)}&since=${since}&until=${until}&token=${tok}&mode=combined`;
        const res = await fetch(url);
        if (!res.ok) { const e = await res.json().catch(() => ({})); setStatus("❌ " + (e.error ?? "Export ล้มเหลว")); return; }
        downloadBlob(await res.blob(), `leads_combined_${since}_${until}.xlsx`);
        setStatus("✅ Download สำเร็จ (รวมไฟล์)");
      } else {
        for (let i = 0; i < selectedForms.length; i++) {
          const fid = selectedForms[i];
          const form = forms.find(f => f.id === fid);
          setStatus(`กำลัง export แยกไฟล์ (${i + 1}/${selectedForms.length})...`);
          const url = `/api/export?pageId=${pageId}&formIds=${fid}&since=${since}&until=${until}&token=${tok}&mode=separate`;
          const res = await fetch(url);
          if (!res.ok) { const e = await res.json().catch(() => ({})); setStatus("❌ " + (e.error ?? `ล้มเหลว: ${form?.name}`)); return; }
          const safeName = (form?.name ?? fid).replace(/[^a-zA-Z0-9ก-๙]/g, "_").slice(0, 40);
          downloadBlob(await res.blob(), `leads_${safeName}_${since}_${until}.xlsx`);
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
          {/* Login section */}
          {!token ? (
            <button
              onClick={handleFbLogin}
              disabled={!fbReady}
              className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166fe5] disabled:bg-gray-300 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.887v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
              {fbReady ? "เข้าสู่ระบบด้วย Facebook" : "กำลังโหลด..."}
            </button>
          ) : (
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#1877F2] rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.887v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                  </svg>
                </div>
                <span className="text-sm font-medium text-black">{userName || "เข้าสู่ระบบแล้ว"}</span>
              </div>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                ออกจากระบบ
              </button>
            </div>
          )}

          {pages.length > 0 && (
            <>
              <div>
                <label className={labelCls}>Page</label>
                <select value={pageId} onChange={e => handlePageChange(e.target.value)} className={inputCls}>
                  {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-black">Lead Form</label>
                  {forms.length > 1 && (
                    <button onClick={toggleAll} className="text-xs text-blue-600 hover:underline">
                      {selectedForms.length === forms.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                    </button>
                  )}
                </div>
                {forms.length === 0 ? (
                  <p className="text-sm text-gray-400">กำลังโหลด...</p>
                ) : (
                  <div className="border border-gray-300 rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {forms.map(f => (
                      <label key={f.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
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

              <div>
                <label className={labelCls}>รูปแบบ Export</label>
                <div className="flex gap-3">
                  {(["combined", "separate"] as const).map(mode => (
                    <label key={mode} className={`flex-1 flex items-center gap-2 border rounded-xl px-4 py-2.5 cursor-pointer transition-colors ${exportMode === mode ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}`}>
                      <input type="radio" name="exportMode" value={mode} checked={exportMode === mode} onChange={() => setExportMode(mode)} className="accent-blue-600" />
                      <span className="text-sm text-black">{mode === "combined" ? "รวม 1 ไฟล์" : "แยกตามฟอร์ม"}</span>
                    </label>
                  ))}
                </div>
              </div>

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
                    Export Excel{selectedForms.length > 0 && ` (${selectedForms.length} ฟอร์ม)`}
                  </>
                )}
              </button>
            </>
          )}

          {status && <p className="text-center text-sm text-black">{status}</p>}
        </div>
      </div>
    </main>
  );
}
