import { NextRequest, NextResponse } from "next/server";

// ─── Server-side HTTP proxy for the canvas "Test Request" feature ─────────────
// The browser can't fetch external APIs directly (CORS). This route runs
// server-side so there are no CORS restrictions.

export async function POST(req: NextRequest) {
  let body: { url: string; method: string; headers?: Record<string, string>; body?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { url, method, headers = {}, body: reqBody } = body;

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const t0 = Date.now();

  try {
    const upstream = await fetch(url, {
      method: method ?? "GET",
      headers: {
        "User-Agent": "Iris-Canvas-Tester/1.0",
        ...headers,
      },
      body: method !== "GET" && method !== "HEAD" && reqBody ? reqBody : undefined,
    });

    const rawText = await upstream.text();
    const durationMs = Date.now() - t0;

    // Try to parse as JSON for pretty display
    let parsed: unknown = null;
    let isJson = false;
    try {
      parsed = JSON.parse(rawText);
      isJson = true;
    } catch { /* not JSON */ }

    return NextResponse.json({
      status: upstream.status,
      ok: upstream.ok,
      body: rawText,
      isJson,
      parsed,
      durationMs,
      contentType: upstream.headers.get("content-type") ?? "",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fetch failed", durationMs: Date.now() - t0 },
      { status: 502 },
    );
  }
}
