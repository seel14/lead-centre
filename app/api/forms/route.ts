import { NextResponse } from "next/server";

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId");
  const TOKEN = searchParams.get("token") ?? process.env.META_TOKEN ?? "";
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });
  if (!TOKEN) return NextResponse.json({ error: "token required" }, { status: 400 });

  const pageToken = await getPageToken(TOKEN, pageId);
  const forms = await paginate(
    `${BASE}/${pageId}/leadgen_forms?fields=id,name,leads_count&access_token=${pageToken}`
  );
  return NextResponse.json(forms);
}
