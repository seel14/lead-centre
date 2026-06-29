import { NextResponse } from "next/server";

const TOKEN = process.env.META_TOKEN!;
const BASE = "https://graph.facebook.com/v21.0";

export async function GET() {
  const res = await fetch(`${BASE}/me/accounts?fields=id,name&access_token=${TOKEN}`);
  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
  return NextResponse.json(data.data);
}
