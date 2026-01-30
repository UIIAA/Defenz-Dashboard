import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

// --- In-memory rate limiter ---
// Note: in serverless, state resets on cold start. This provides
// best-effort protection within a single instance lifetime.
// For persistent rate limiting, use Redis/Upstash.
const rateMap = new Map<string, number[]>();
const RATE_LIMIT = 30; // max requests
const RATE_WINDOW = 60_000; // per minute
const MAX_TRACKED_IPS = 1000; // prevent unbounded memory growth

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  // Inline cleanup: evict stale entries if map grows large
  if (rateMap.size > MAX_TRACKED_IPS) {
    for (const [key, ts] of rateMap) {
      if (ts.every((t) => now - t >= RATE_WINDOW)) rateMap.delete(key);
      if (rateMap.size <= MAX_TRACKED_IPS / 2) break;
    }
  }

  const timestamps = rateMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  rateMap.set(ip, recent);
  return false;
}

// --- Date validation ---
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + "T00:00:00Z").getTime();
  const msB = new Date(b + "T00:00:00Z").getTime();
  return Math.abs(msB - msA) / 86_400_000;
}

export async function POST(request: NextRequest) {
  // Defense-in-depth: verify session cookie
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  // Parse & validate payload
  let body: { data_inicio?: string; data_fim?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data_inicio, data_fim } = body;
  if (
    typeof data_inicio !== "string" ||
    typeof data_fim !== "string" ||
    !isValidDate(data_inicio) ||
    !isValidDate(data_fim)
  ) {
    return NextResponse.json(
      { error: "Invalid date format. Expected YYYY-MM-DD." },
      { status: 400 }
    );
  }
  if (data_inicio > data_fim) {
    return NextResponse.json(
      { error: "data_inicio must be <= data_fim" },
      { status: 400 }
    );
  }
  if (daysBetween(data_inicio, data_fim) > 366) {
    return NextResponse.json(
      { error: "Date range cannot exceed 366 days" },
      { status: 400 }
    );
  }

  // Proxy to N8N webhook
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data_inicio, data_fim }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Upstream error" },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return NextResponse.json(
        { error: "Upstream timeout" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 502 }
    );
  }
}
