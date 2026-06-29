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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId");
  const formId = searchParams.get("formId");
  const since = searchParams.get("since");
  const until = searchParams.get("until");

  const TOKEN = searchParams.get("token") ?? process.env.META_TOKEN ?? "";
  if (!pageId || !formId) {
    return NextResponse.json({ error: "pageId and formId required" }, { status: 400 });
  }
  if (!TOKEN) return NextResponse.json({ error: "token required" }, { status: 400 });

  const pageToken = await getPageToken(TOKEN, pageId);
  const sinceTs = since ? Math.floor(new Date(since).getTime() / 1000) : null;
  const untilTs = until ? Math.floor(new Date(until + "T23:59:59").getTime() / 1000) : null;

  let url = `${BASE}/${formId}/leads?fields=id,created_time,field_data,ad_name,adset_name,campaign_name&limit=100&access_token=${pageToken}`;
  if (sinceTs) url += `&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${sinceTs}}]`;

  let leads = (await paginate(url)) as Array<{
    id: string;
    created_time: string;
    field_data?: Array<{ name: string; values?: string[] }>;
    ad_name?: string;
    adset_name?: string;
    campaign_name?: string;
  }>;

  if (untilTs) {
    leads = leads.filter((l) => Math.floor(new Date(l.created_time).getTime() / 1000) <= untilTs);
  }

  const keys: string[] = [];
  for (const lead of leads) {
    for (const f of lead.field_data ?? []) {
      if (!keys.includes(f.name)) keys.push(f.name);
    }
  }

  const headers = ["วันที่-เวลา", "Campaign", "Ad Set", "Ad", ...keys];
  const rows = leads.map((lead) => {
    const fm: Record<string, string> = {};
    for (const f of lead.field_data ?? []) fm[f.name] = (f.values ?? []).join(", ");
    return [fmtTime(lead.created_time), lead.campaign_name ?? "", lead.adset_name ?? "", lead.ad_name ?? "", ...keys.map((k) => fm[k] ?? "")];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leads_${since ?? "all"}_${until ?? "all"}.xlsx"`,
    },
  });
}
