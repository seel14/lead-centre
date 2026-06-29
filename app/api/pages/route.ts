import { NextResponse } from "next/server";

const BASE = "https://graph.facebook.com/v21.0";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const TOKEN = searchParams.get("token") ?? process.env.META_TOKEN ?? "";
  if (!TOKEN) return NextResponse.json({ error: "token required" }, { status: 400 });

  const debug = await fetch(`${BASE}/debug_token?input_token=${TOKEN}&access_token=${TOKEN}`).then(r => r.json());
  const tokenData = debug.data ?? {};

  if (tokenData.type === "PAGE") {
    const pageId = tokenData.profile_id;
    const nameRes = await fetch(`${BASE}/${pageId}?fields=name&access_token=${TOKEN}`).then(r => r.json());
    return NextResponse.json([{ id: pageId, name: nameRes.name ?? pageId }]);
  }

  const res = await fetch(`${BASE}/me/accounts?fields=id,name,access_token&access_token=${TOKEN}`);
  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
  return NextResponse.json(data.data);
}
