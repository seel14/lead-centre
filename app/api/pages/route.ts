import { NextResponse } from "next/server";

const TOKEN = process.env.META_TOKEN!;
const BASE = "https://graph.facebook.com/v21.0";

export async function GET() {
  // detect token type
  const debug = await fetch(`${BASE}/debug_token?input_token=${TOKEN}&access_token=${TOKEN}`).then(r => r.json());
  const tokenData = debug.data ?? {};

  if (tokenData.type === "PAGE") {
    // page token — return just this page
    const pageId = tokenData.profile_id;
    return NextResponse.json([{ id: pageId, name: pageId, _pageToken: TOKEN }]);
  }

  // user token — get all pages
  const res = await fetch(`${BASE}/me/accounts?fields=id,name,access_token&access_token=${TOKEN}`);
  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
  return NextResponse.json(data.data);
}
