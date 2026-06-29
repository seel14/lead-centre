import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

const BASE = "https://graph.facebook.com/v21.0";

async function getPageToken(TOKEN: string, pageId: string): Promise<string> {
  const debug = await fetch(`${BASE}/debug_token?input_token=${TOKEN}&access_token=${TOKEN}`).then(r => r.json());
  if (debug.data?.type === "PAGE" && debug.data?.profile_id === pageId) return TOKEN;

  const res = await fetch(`${BASE}/me/accounts?fields=id,access_token&access_token=${TOKEN}`);
  const data = await res.json();
  const page = data.data?.find((p: { id: string }) => p.id === pageId);
  return page?.access_token ?? TOKEN;
}

async function paginate(url: string): Promise<object[]> {
  const results: object[] = [];
  let next: string | null = url;
  while (next) {
    const res: Response = await fetch(next);
    const data = await res.json();
    results.push(...(data.data ?? []));
    next = data.paging?.next ?? null;
  }
  return results;
}

function fmtTime(dtStr: string) {
  try {
    return new Date(dtStr).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  } catch {
    return dtStr;
  }
}

type Lead = {
  id: string;
  created_time: string;
  field_data?: Array<{ name: string; values?: string[] }>;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
};

async function fetchLeads(pageToken: string, formId: string, sinceTs: number | null, untilTs: number | null): Promise<Lead[]> {
  let url = `${BASE}/${formId}/leads?fields=id,created_time,field_data,ad_name,adset_name,campaign_name&limit=100&access_token=${pageToken}`;
  if (sinceTs) url += `&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${sinceTs}}]`;

  let leads = (await paginate(url)) as Lead[];
  if (untilTs) {
    leads = leads.filter(l => Math.floor(new Date(l.created_time).getTime() / 1000) <= untilTs);
  }
  return leads;
}

function buildSheet(leads: Lead[], formName?: string) {
  const keys: string[] = [];
  for (const lead of leads) {
    for (const f of lead.field_data ?? []) {
      if (!keys.includes(f.name)) keys.push(f.name);
    }
  }

  const baseHeaders = formName
    ? ["ชื่อฟอร์ม", "วันที่-เวลา", "Campaign", "Ad Set", "Ad"]
    : ["วันที่-เวลา", "Campaign", "Ad Set", "Ad"];

  const headers = [...baseHeaders, ...keys];
  const rows = leads.map(lead => {
    const fm: Record<string, string> = {};
    for (const f of lead.field_data ?? []) fm[f.name] = (f.values ?? []).join(", ");
    const base = formName
      ? [formName, fmtTime(lead.created_time), lead.campaign_name ?? "", lead.adset_name ?? "", lead.ad_name ?? ""]
      : [fmtTime(lead.created_time), lead.campaign_name ?? "", lead.adset_name ?? "", lead.ad_name ?? ""];
    return [...base, ...keys.map(k => fm[k] ?? "")];
  });

  return { headers, rows };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId");
  const formIdsParam = searchParams.get("formIds");
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const TOKEN = searchParams.get("token") ?? process.env.META_TOKEN ?? "";
  const mode = searchParams.get("mode") ?? "combined";

  if (!pageId || !formIdsParam) {
    return NextResponse.json({ error: "pageId and formIds required" }, { status: 400 });
  }
  if (!TOKEN) return NextResponse.json({ error: "token required" }, { status: 400 });

  const formIds = formIdsParam.split(",").filter(Boolean);
  const formNamesParam = searchParams.get("formNames") ?? "";
  const formNamesList = formNamesParam.split("||");
  const pageToken = await getPageToken(TOKEN, pageId);
  const sinceTs = since ? Math.floor(new Date(since).getTime() / 1000) : null;
  const untilTs = until ? Math.floor(new Date(until + "T23:59:59").getTime() / 1000) : null;

  const wb = XLSX.utils.book_new();

  if (mode === "combined" && formIds.length > 1) {
    const allRows: string[][] = [];
    let headers: string[] = [];
    let firstForm = true;

    for (let i = 0; i < formIds.length; i++) {
      const fid = formIds[i];
      const fname = formNamesList[i] ?? fid;
      const leads = await fetchLeads(pageToken, fid, sinceTs, untilTs);
      const { headers: h, rows } = buildSheet(leads, fname);
      if (firstForm) { headers = h; firstForm = false; }
      allRows.push(...rows);
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...allRows]);
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
  } else {
    // One sheet per form (for "separate" mode the frontend calls once with 1 formId)
    for (const fid of formIds) {
      const leads = await fetchLeads(pageToken, fid, sinceTs, untilTs);
      const { headers, rows } = buildSheet(leads);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const sheetName = fid.slice(-20);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const suffix = since && until ? `${since}_${until}` : "all";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leads_${suffix}.xlsx"`,
    },
  });
}
