let cachedToken = null;
let cachedTokenExpiresAt = 0;

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  },
});

const base64Url = (input) => {
  const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const pemToArrayBuffer = (pem) => {
  const normalized = String(pem || "").replace(/\\n/g, "\n");
  const base64 = normalized.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
};

async function createGoogleToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedTokenExpiresAt > now + 60) return cachedToken;
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) throw new Error("متغيرات حساب الخدمة في Google غير مكتملة");

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(env.GOOGLE_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const payloadResponse = await response.json();
  if (!response.ok || !payloadResponse.access_token) throw new Error(payloadResponse.error_description || payloadResponse.error || "تعذر الحصول على Google access token");
  cachedToken = payloadResponse.access_token;
  cachedTokenExpiresAt = now + Number(payloadResponse.expires_in || 3600);
  return cachedToken;
}

const allowedOrigin = (request, env) => {
  const origin = request.headers.get("Origin") || "";
  const configured = String(env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!origin) return configured[0] || "";
  return configured.includes(origin) ? origin : "";
};

const corsHeaders = (origin) => ({
  ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});

async function googleFetch(env, url, init = {}) {
  const token = await createGoogleToken(env);
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload?.error_description || `Google API HTTP ${response.status}`);
  return payload;
}

const dateRange = (days) => {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(1, days - 1));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
};

async function searchAnalytics(env, dimensions, days, rowLimit = 25) {
  const property = env.SEARCH_CONSOLE_PROPERTY;
  if (!property) throw new Error("SEARCH_CONSOLE_PROPERTY غير مضبوط");
  const range = dateRange(days);
  return googleFetch(env, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
    method: "POST",
    body: JSON.stringify({ ...range, dimensions, rowLimit, dataState: "final" }),
  });
}

async function performanceTotals(env, days) {
  const payload = await searchAnalytics(env, [], days, 1);
  const row = payload.rows?.[0] || {};
  return { range: dateRange(days), totals: { clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: row.ctr || 0, position: row.position || 0 } };
}

async function pageSpeed(env, url, strategy) {
  if (!env.PAGESPEED_API_KEY) throw new Error("PAGESPEED_API_KEY غير مضبوط");
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy === "desktop" ? "desktop" : "mobile");
  endpoint.searchParams.set("category", "performance");
  endpoint.searchParams.set("key", env.PAGESPEED_API_KEY);
  const response = await fetch(endpoint);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `PageSpeed HTTP ${response.status}`);
  const audits = payload.lighthouseResult?.audits || {};
  const metric = (id) => audits[id] ? { displayValue: audits[id].displayValue || "", numericValue: audits[id].numericValue ?? null } : null;
  return {
    score: Math.round(Number(payload.lighthouseResult?.categories?.performance?.score || 0) * 100),
    fetchTime: payload.lighthouseResult?.fetchTime,
    strategy,
    metrics: {
      lcp: metric("largest-contentful-paint"),
      cls: metric("cumulative-layout-shift"),
      inp: metric("interaction-to-next-paint"),
      tbt: metric("total-blocking-time"),
      fcp: metric("first-contentful-paint"),
      speedIndex: metric("speed-index"),
    },
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);
    const cors = corsHeaders(origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.headers.get("Origin") && !origin) return json({ error: "Origin غير مسموح" }, 403, cors);

    try {
      const pathname = url.pathname.replace(/^\/seo-api/u, "");
      if (pathname === "/health" || pathname === "/") {
        return json({ ok: true, property: env.SEARCH_CONSOLE_PROPERTY || "", pageSpeedConfigured: Boolean(env.PAGESPEED_API_KEY) }, 200, cors);
      }
      if (pathname === "/performance") {
        return json(await performanceTotals(env, Math.min(90, Math.max(1, Number(url.searchParams.get("days") || 28)))), 200, cors);
      }
      if (pathname === "/queries" || pathname === "/pages") {
        const dimensions = pathname === "/queries" ? ["query"] : ["page"];
        const payload = await searchAnalytics(env, dimensions, Math.min(90, Math.max(1, Number(url.searchParams.get("days") || 28))), 25);
        return json({ rows: payload.rows || [], responseAggregationType: payload.responseAggregationType }, 200, cors);
      }
      if (pathname === "/sitemaps") {
        if (!env.SEARCH_CONSOLE_PROPERTY) throw new Error("SEARCH_CONSOLE_PROPERTY غير مضبوط");
        return json(await googleFetch(env, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(env.SEARCH_CONSOLE_PROPERTY)}/sitemaps`), 200, cors);
      }
      if (pathname === "/inspect" && request.method === "POST") {
        const body = await request.json();
        if (!body.inspectionUrl) return json({ error: "inspectionUrl مطلوب" }, 400, cors);
        const payload = await googleFetch(env, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
          method: "POST",
          body: JSON.stringify({ inspectionUrl: body.inspectionUrl, siteUrl: env.SEARCH_CONSOLE_PROPERTY }),
        });
        return json(payload, 200, cors);
      }
      if (pathname === "/pagespeed") {
        const target = url.searchParams.get("url");
        if (!target) return json({ error: "url مطلوب" }, 400, cors);
        return json(await pageSpeed(env, target, url.searchParams.get("strategy") || "mobile"), 200, cors);
      }
      return json({ error: "المسار غير موجود" }, 404, cors);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "خطأ غير معروف" }, 500, cors);
    }
  },
};
