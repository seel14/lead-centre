import { NextResponse } from "next/server";

const TOKEN = process.env.META_TOKEN!;
const BASE = "https://graph.facebook.com/v21.0";

async function getPageToken(pageId: string): Promise<string> {
  const res = await fetch(`${BASE}/me/accounts?fields=id,access_token&access_token=${TOKEN}`);
  const data = await res.json();
  const page = data.data?.find((p: { id: string }) => p.id === pageId);
  return page?.access_token ?? TOKEN;
}

async function paginate(url: string): Promise<object[]> {
  const results: object[] = [];
  let next: string | null = url;
  while (next) {
    const res = await fetch(next);
    const data = await res.json();
    results.push(...(data.data ?? []));
    next = data.paging?.next ?? null;
  }
  return results;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  const pageToken = await getPageToken(pageId);
  const forms = await paginate(
    `${BASE}/${pageId}/leadgen_forms?fields=id,name,leads_count&access_token=${pageToken}`
  );
  return NextResponse.json(forms);
}
