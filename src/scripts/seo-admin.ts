type LiveState = "loading" | "success" | "warning" | "error";

type ClientData = {
  siteUrl: string;
  seoApiUrl: string;
  property: string;
  targetPerformanceScore: number;
  expectedPaths: string[];
  content: Array<{ title: string; path: string; draft: boolean; noindex: boolean; priority: string }>;
};

type CrawlResult = {
  url: string;
  path: string;
  status: number;
  indexable: boolean;
  title: string;
  titleLength: number;
  description: string;
  descriptionLength: number;
  canonical: string;
  canonicalOk: boolean;
  robots: string;
  h1Count: number;
  schemaCount: number;
  imagesMissingAlt: number;
  internalLinks: string[];
  issues: string[];
};

const dataElement = document.querySelector<HTMLScriptElement>("#seo-admin-data");
const data: ClientData = dataElement?.textContent
  ? JSON.parse(dataElement.textContent)
  : { siteUrl: window.location.origin, seoApiUrl: "", property: "", targetPerformanceScore: 90, expectedPaths: [], content: [] };

const siteUrl = data.siteUrl.replace(/\/+$/, "");
const siteOrigin = new URL(siteUrl).origin;
let crawlResults: CrawlResult[] = [];

function setLiveStatus(name: string, state: LiveState, message: string, detail = "") {
  const card = document.querySelector<HTMLElement>(`[data-live-check="${name}"]`);
  if (!card) return;
  card.classList.remove("is-loading", "is-success", "is-warning", "is-error");
  card.classList.add(`is-${state}`);
  const messageElement = card.querySelector<HTMLElement>("[data-live-message]");
  const detailElement = card.querySelector<HTMLElement>("[data-live-detail]");
  if (messageElement) messageElement.textContent = message;
  if (detailElement) detailElement.textContent = detail;
}

async function fetchResponse(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { cache: "no-store", redirect: "follow", ...init });
  return response;
}

async function fetchText(url: string) {
  const response = await fetchResponse(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function parseSitemapUrls(): Promise<string[]> {
  const parser = new DOMParser();
  const first = await fetchText(`${siteUrl}/sitemap-index.xml`);
  const firstDocument = parser.parseFromString(first, "application/xml");
  if (firstDocument.querySelector("parsererror")) throw new Error("تعذر قراءة sitemap-index.xml");

  const direct = Array.from(firstDocument.querySelectorAll("url > loc"))
    .map((item) => item.textContent?.trim())
    .filter((value): value is string => Boolean(value));
  if (direct.length) return [...new Set(direct)];

  const childSitemaps = Array.from(firstDocument.querySelectorAll("sitemap > loc"))
    .map((item) => item.textContent?.trim())
    .filter((value): value is string => Boolean(value));

  const all: string[] = [];
  for (const child of childSitemaps) {
    const childUrl = new URL(child, siteUrl);
    if (childUrl.origin !== siteOrigin) continue;
    const xml = await fetchText(childUrl.toString());
    const documentXml = parser.parseFromString(xml, "application/xml");
    all.push(...Array.from(documentXml.querySelectorAll("url > loc"))
      .map((item) => item.textContent?.trim())
      .filter((value): value is string => Boolean(value)));
  }
  return [...new Set(all)];
}

function parseHtml(html: string, url: string, status: number): CrawlResult {
  const documentHtml = new DOMParser().parseFromString(html, "text/html");
  const title = documentHtml.querySelector("title")?.textContent?.trim() || "";
  const description = documentHtml.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim() || "";
  const robots = documentHtml.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content?.trim() || "";
  const canonical = documentHtml.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href?.trim() || "";
  const h1Count = documentHtml.querySelectorAll("h1").length;
  const schemaBlocks = Array.from(documentHtml.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));
  let schemaCount = 0;
  for (const block of schemaBlocks) {
    try {
      JSON.parse(block.textContent || "");
      schemaCount += 1;
    } catch {
      // Invalid blocks are represented as an issue below.
    }
  }
  const imagesMissingAlt = Array.from(documentHtml.images).filter((image) => !image.hasAttribute("alt") || !image.alt.trim()).length;
  const internalLinks = Array.from(documentHtml.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .map((link) => {
      try { return new URL(link.href, url); } catch { return null; }
    })
    .filter((link): link is URL => Boolean(link) && link.origin === siteOrigin && !link.hash)
    .map((link) => `${link.origin}${link.pathname}${link.search}`);

  const normalizedUrl = new URL(url);
  normalizedUrl.hash = "";
  const normalizedCanonical = canonical ? new URL(canonical, url) : null;
  const canonicalOk = Boolean(normalizedCanonical && normalizedCanonical.origin === normalizedUrl.origin && normalizedCanonical.pathname === normalizedUrl.pathname);
  const noindex = /\bnoindex\b/iu.test(robots);
  const issues: string[] = [];
  if (status < 200 || status >= 400) issues.push(`حالة HTTP ${status}`);
  if (!title) issues.push("Title غير موجود");
  else if (title.length < 20 || title.length > 75) issues.push(`طول Title ${title.length}`);
  if (!description) issues.push("Meta Description غير موجود");
  else if (description.length < 55 || description.length > 190) issues.push(`طول الوصف ${description.length}`);
  if (!canonical) issues.push("Canonical غير موجود");
  else if (!canonicalOk) issues.push("Canonical مختلف عن رابط الصفحة");
  if (h1Count !== 1) issues.push(`عدد H1 هو ${h1Count}`);
  if (schemaBlocks.length === 0) issues.push("Schema غير موجود");
  else if (schemaCount !== schemaBlocks.length) issues.push("Schema غير صالح بالكامل");
  if (imagesMissingAlt > 0) issues.push(`${imagesMissingAlt} صورة بلا alt`);
  if (noindex) issues.push("الصفحة تحمل noindex");

  return {
    url,
    path: normalizedUrl.pathname,
    status,
    indexable: status >= 200 && status < 400 && !noindex && canonicalOk,
    title,
    titleLength: title.length,
    description,
    descriptionLength: description.length,
    canonical,
    canonicalOk,
    robots,
    h1Count,
    schemaCount,
    imagesMissingAlt,
    internalLinks: [...new Set(internalLinks)],
    issues,
  };
}

async function runLiveChecks() {
  ["https", "robots", "sitemap", "canonical", "schema", "meta", "admin", "api"].forEach((name) => setLiveStatus(name, "loading", "جارٍ الفحص…"));

  const secure = window.location.protocol === "https:" && siteUrl.startsWith("https://");
  setLiveStatus(
    "https",
    secure ? "success" : "warning",
    secure ? "HTTPS مستخدم" : "الاتصال غير آمن",
    secure ? "تحويل HTTP يُراجع من Cloudflare أو عبر curl" : window.location.href,
  );

  try {
    const robotsText = await fetchText(`${siteUrl}/robots.txt`);
    const hasSitemap = /Sitemap:\s*https?:\/\//iu.test(robotsText);
    const blocksAdmin = /Disallow:\s*\/admin\//iu.test(robotsText);
    const blocksSeoAdmin = /Disallow:\s*\/seo-admin\//iu.test(robotsText);
    const blocksAll = /Disallow:\s*\/\s*$/imu.test(robotsText);
    if (hasSitemap && blocksAdmin && blocksSeoAdmin && !blocksAll) setLiveStatus("robots", "success", "سليم", "يسمح بالموقع ويستبعد لوحات الإدارة");
    else setLiveStatus("robots", "warning", "يحتاج مراجعة", [!hasSitemap && "Sitemap", !blocksAdmin && "/admin/", !blocksSeoAdmin && "/seo-admin/", blocksAll && "الموقع محظور بالكامل"].filter(Boolean).join("، "));
  } catch (error) {
    setLiveStatus("robots", "error", "تعذر الوصول", error instanceof Error ? error.message : "");
  }

  try {
    const urls = await parseSitemapUrls();
    const missingExpected = data.expectedPaths.filter((path) => !urls.some((url) => new URL(url).pathname === path));
    setLiveStatus("sitemap", missingExpected.length ? "warning" : "success", `${urls.length} رابط`, missingExpected.length ? `${missingExpected.length} صفحة متوقعة غير موجودة` : "الخريطة متوافقة مع المحتوى المنشور");
  } catch (error) {
    setLiveStatus("sitemap", "error", "تعذر قراءة الخريطة", error instanceof Error ? error.message : "");
  }

  try {
    const response = await fetchResponse(`${siteUrl}/`);
    const html = await response.text();
    const result = parseHtml(html, response.url, response.status);
    setLiveStatus("canonical", result.canonicalOk ? "success" : "warning", result.canonicalOk ? "صحيح" : "يحتاج مراجعة", result.canonical || "غير موجود");
    setLiveStatus("schema", result.schemaCount > 0 ? "success" : "warning", result.schemaCount > 0 ? "موجود وصالح" : "غير موجود", `${result.schemaCount} كتلة JSON-LD صالحة`);
    setLiveStatus("meta", result.indexable ? "success" : "warning", result.indexable ? "مسموح بالفهرسة" : "يحتاج مراجعة", result.robots || "لا يوجد Meta Robots صريح");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    setLiveStatus("canonical", "error", "تعذر الفحص", detail);
    setLiveStatus("schema", "error", "تعذر الفحص", detail);
    setLiveStatus("meta", "error", "تعذر الفحص", detail);
  }

  try {
    const [admin, seoAdmin] = await Promise.all([fetchResponse(`${siteUrl}/admin/`), fetchResponse(`${siteUrl}/seo-admin/`)]);
    const header = `${admin.headers.get("x-robots-tag") || ""} ${seoAdmin.headers.get("x-robots-tag") || ""}`;
    setLiveStatus("admin", /noindex/iu.test(header) ? "success" : "warning", /noindex/iu.test(header) ? "مستبعدة" : "تحقق يدويًا", header.trim() || "لم يظهر X-Robots-Tag للمتصفح");
  } catch (error) {
    setLiveStatus("admin", "warning", "تعذر التحقق", error instanceof Error ? error.message : "");
  }

  if (!data.seoApiUrl) {
    setLiveStatus("api", "warning", "غير مربوط", "أدوات Search Console الحية اختيارية");
  } else {
    try {
      const response = await fetchResponse(`${data.seoApiUrl}/health`);
      const payload = await response.json() as { ok?: boolean; property?: string };
      setLiveStatus("api", response.ok && payload.ok ? "success" : "warning", response.ok ? "متصل" : "يحتاج مراجعة", payload.property || data.property);
    } catch (error) {
      setLiveStatus("api", "error", "فشل الاتصال", error instanceof Error ? error.message : "");
    }
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>, progress?: (done: number) => void): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  let done = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) break;
      results[index] = await worker(items[index], index);
      done += 1;
      progress?.(done);
    }
  });
  await Promise.all(runners);
  return results;
}

async function crawlUrl(url: string): Promise<CrawlResult> {
  try {
    const response = await fetchResponse(url);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return { url, path: new URL(url).pathname, status: response.status, indexable: false, title: "", titleLength: 0, description: "", descriptionLength: 0, canonical: "", canonicalOk: false, robots: "", h1Count: 0, schemaCount: 0, imagesMissingAlt: 0, internalLinks: [], issues: ["الاستجابة ليست HTML"] };
    }
    return parseHtml(await response.text(), response.url, response.status);
  } catch (error) {
    return { url, path: new URL(url).pathname, status: 0, indexable: false, title: "", titleLength: 0, description: "", descriptionLength: 0, canonical: "", canonicalOk: false, robots: "", h1Count: 0, schemaCount: 0, imagesMissingAlt: 0, internalLinks: [], issues: [error instanceof Error ? error.message : "فشل الاتصال"] };
  }
}

function resultBadge(value: boolean, yes = "سليم", no = "مراجعة") {
  return `<span class="status-pill ${value ? "indexed" : "noindex"}">${value ? yes : no}</span>`;
}

function renderCrawlResults(results: CrawlResult[]) {
  const container = document.querySelector<HTMLElement>("[data-crawl-results]");
  const body = document.querySelector<HTMLTableSectionElement>("[data-crawl-table-body]");
  const summary = document.querySelector<HTMLElement>("[data-crawl-summary]");
  if (!container || !body || !summary) return;

  const titleGroups = new Map<string, CrawlResult[]>();
  const descriptionGroups = new Map<string, CrawlResult[]>();
  for (const result of results) {
    if (result.title) titleGroups.set(result.title, [...(titleGroups.get(result.title) || []), result]);
    if (result.description) descriptionGroups.set(result.description, [...(descriptionGroups.get(result.description) || []), result]);
  }
  for (const group of titleGroups.values()) if (group.length > 1) group.forEach((item) => item.issues.push("Title مكرر"));
  for (const group of descriptionGroups.values()) if (group.length > 1) group.forEach((item) => item.issues.push("Description مكرر"));

  body.innerHTML = results.map((result) => `<tr>
    <td><a href="${escapeHtml(result.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.path)}</a><small>${escapeHtml(result.title || "بدون عنوان")}</small></td>
    <td>${result.status || "—"}</td>
    <td>${resultBadge(result.indexable, "index", "مراجعة")}</td>
    <td>${result.titleLength}</td><td>${result.descriptionLength}</td><td>${result.h1Count}</td>
    <td>${resultBadge(result.canonicalOk)}</td><td>${result.schemaCount}</td><td>${result.imagesMissingAlt}</td>
    <td>${result.issues.length ? `<details><summary>${result.issues.length}</summary><ul>${result.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul></details>` : '<span class="all-good">مكتمل</span>'}</td>
  </tr>`).join("");

  const indexable = results.filter((item) => item.indexable).length;
  const errors = results.filter((item) => item.status === 0 || item.status >= 400).length;
  const withIssues = results.filter((item) => item.issues.length).length;
  const brokenCandidates = new Set(results.flatMap((item) => item.internalLinks).filter((link) => !results.some((page) => page.url.replace(/\/+$/, "") === link.replace(/\/+$/, ""))));
  summary.innerHTML = `<article><span>تم فحصها</span><strong>${results.length}</strong></article><article><span>قابلة للفهرسة</span><strong>${indexable}</strong></article><article><span>بمشكلات</span><strong>${withIssues}</strong></article><article><span>أخطاء HTTP</span><strong>${errors}</strong></article><article><span>روابط داخلية خارج الخريطة</span><strong>${brokenCandidates.size}</strong></article>`;
  summary.hidden = false;
  container.hidden = false;
  document.querySelector<HTMLButtonElement>("[data-export-crawl]")!.disabled = false;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character] || character);
}

async function runFullCrawl() {
  const button = document.querySelector<HTMLButtonElement>("[data-start-crawl]");
  const wrap = document.querySelector<HTMLElement>("[data-crawl-progress-wrap]");
  const progress = document.querySelector<HTMLProgressElement>("[data-crawl-progress]");
  const percent = document.querySelector<HTMLElement>("[data-crawl-percent]");
  const status = document.querySelector<HTMLElement>("[data-crawl-status]");
  if (!button || !wrap || !progress || !percent || !status) return;

  button.disabled = true;
  wrap.hidden = false;
  status.textContent = "قراءة خريطة الموقع…";
  try {
    const urls = await parseSitemapUrls();
    progress.max = urls.length || 1;
    progress.value = 0;
    status.textContent = `فحص ${urls.length} صفحة…`;
    crawlResults = await mapWithConcurrency(urls, 4, crawlUrl, (done) => {
      progress.value = done;
      const value = Math.round((done / Math.max(urls.length, 1)) * 100);
      percent.textContent = `${value}%`;
      status.textContent = `تم فحص ${done} من ${urls.length}`;
    });
    renderCrawlResults(crawlResults);
    status.textContent = "اكتمل الفحص";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "تعذر إكمال الفحص";
  } finally {
    button.disabled = false;
  }
}

function exportCrawlCsv() {
  if (!crawlResults.length) return;
  const rows = [["URL", "Status", "Indexable", "Title", "TitleLength", "DescriptionLength", "H1", "Canonical", "Schema", "ImagesMissingAlt", "Issues"], ...crawlResults.map((item) => [item.url, String(item.status), item.indexable ? "Yes" : "No", item.title, String(item.titleLength), String(item.descriptionLength), String(item.h1Count), item.canonical, String(item.schemaCount), String(item.imagesMissingAlt), item.issues.join(" | ")])];
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/gu, '""')}"`).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `seo-crawl-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function filterAuditRows() {
  const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-audit-row]"));
  const query = (document.querySelector<HTMLInputElement>("[data-audit-search]")?.value || "").toLocaleLowerCase("ar").trim();
  const kind = document.querySelector<HTMLSelectElement>("[data-audit-kind]")?.value || "all";
  const status = document.querySelector<HTMLSelectElement>("[data-audit-status]")?.value || "all";
  let visible = 0;
  rows.forEach((row) => {
    const draft = row.dataset.draft === "true";
    const noindex = row.dataset.noindex === "true";
    const score = Number(row.dataset.score || 0);
    const show = (!query || (row.dataset.title || "").includes(query)) && (kind === "all" || row.dataset.kind === kind) && (status === "all" || (status === "review" && !draft && score < 80) || (status === "published" && !draft) || (status === "draft" && draft) || (status === "noindex" && noindex));
    row.hidden = !show;
    if (show) visible += 1;
  });
  const result = document.querySelector<HTMLElement>("[data-audit-results]");
  if (result) result.textContent = `عدد النتائج: ${visible}`;
}

async function apiJson(path: string, init?: RequestInit) {
  if (!data.seoApiUrl) throw new Error("لم يتم إعداد PUBLIC_SEO_API_URL");
  const response = await fetchResponse(`${data.seoApiUrl}${path}`, init);
  const payload = await response.json();
  if (!response.ok) throw new Error((payload as { error?: string }).error || `HTTP ${response.status}`);
  return payload;
}

function setText(selector: string, value: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
}

async function refreshSearchConsole() {
  if (!data.seoApiUrl) return;
  try {
    const [performance, queries] = await Promise.all([apiJson("/performance?days=28"), apiJson("/queries?days=28")]) as [any, any];
    setText("[data-gsc-clicks]", Number(performance.totals?.clicks || 0).toLocaleString("ar-SA"));
    setText("[data-gsc-impressions]", Number(performance.totals?.impressions || 0).toLocaleString("ar-SA"));
    setText("[data-gsc-ctr]", `${(Number(performance.totals?.ctr || 0) * 100).toFixed(1)}%`);
    setText("[data-gsc-position]", Number(performance.totals?.position || 0).toFixed(1));
    const container = document.querySelector<HTMLElement>("[data-gsc-queries]");
    if (container) container.innerHTML = queries.rows?.length ? `<table><thead><tr><th>الطلب</th><th>نقرات</th><th>ظهور</th><th>الموضع</th></tr></thead><tbody>${queries.rows.map((row: any) => `<tr><td>${escapeHtml(row.keys?.[0] || "")}</td><td>${row.clicks || 0}</td><td>${row.impressions || 0}</td><td>${Number(row.position || 0).toFixed(1)}</td></tr>`).join("")}</tbody></table>` : '<p class="muted">لا توجد بيانات في الفترة المحددة.</p>';
  } catch (error) {
    const container = document.querySelector<HTMLElement>("[data-gsc-queries]");
    if (container) container.innerHTML = `<p class="error-text">${escapeHtml(error instanceof Error ? error.message : "فشل التحميل")}</p>`;
  }
}

async function inspectUrl() {
  const select = document.querySelector<HTMLSelectElement>("[data-inspection-url]");
  const result = document.querySelector<HTMLElement>("[data-inspection-result]");
  if (!select || !result) return;
  result.innerHTML = '<p class="muted">جارٍ فحص Google Search Console…</p>';
  try {
    const payload = await apiJson("/inspect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inspectionUrl: select.value }) }) as any;
    const inspection = payload.inspectionResult || payload;
    const index = inspection.indexStatusResult || {};
    result.innerHTML = `<dl><div><dt>الحكم</dt><dd>${escapeHtml(index.verdict || "غير متاح")}</dd></div><div><dt>حالة التغطية</dt><dd>${escapeHtml(index.coverageState || "غير متاحة")}</dd></div><div><dt>آخر زحف</dt><dd>${escapeHtml(index.lastCrawlTime || "غير متاح")}</dd></div><div><dt>Canonical من Google</dt><dd>${escapeHtml(index.googleCanonical || "غير متاح")}</dd></div><div><dt>Canonical من المستخدم</dt><dd>${escapeHtml(index.userCanonical || "غير متاح")}</dd></div><div><dt>robots.txt</dt><dd>${escapeHtml(index.robotsTxtState || "غير متاح")}</dd></div></dl>`;
  } catch (error) {
    result.innerHTML = `<p class="error-text">${escapeHtml(error instanceof Error ? error.message : "فشل الفحص")}</p>`;
  }
}

async function runPageSpeed() {
  const url = document.querySelector<HTMLInputElement>("[data-pagespeed-url]")?.value || `${siteUrl}/`;
  const strategy = document.querySelector<HTMLSelectElement>("[data-pagespeed-strategy]")?.value || "mobile";
  try {
    const payload = await apiJson(`/pagespeed?url=${encodeURIComponent(url)}&strategy=${encodeURIComponent(strategy)}`) as any;
    setText("[data-psi-score]", `${payload.score ?? "—"}%`);
    setText("[data-psi-lcp]", payload.metrics?.lcp?.displayValue || "—");
    setText("[data-psi-cls]", payload.metrics?.cls?.displayValue || "—");
    setText("[data-psi-inp]", payload.metrics?.inp?.displayValue || payload.metrics?.tbt?.displayValue || "—");
  } catch (error) {
    setText("[data-psi-score]", "خطأ");
    setText("[data-psi-lcp]", error instanceof Error ? error.message : "فشل");
  }
}

document.querySelector("[data-run-live-checks]")?.addEventListener("click", runLiveChecks);
document.querySelector("[data-start-crawl]")?.addEventListener("click", runFullCrawl);
document.querySelector("[data-export-crawl]")?.addEventListener("click", exportCrawlCsv);
document.querySelector("[data-audit-search]")?.addEventListener("input", filterAuditRows);
document.querySelector("[data-audit-kind]")?.addEventListener("change", filterAuditRows);
document.querySelector("[data-audit-status]")?.addEventListener("change", filterAuditRows);
document.querySelector("[data-refresh-search-console]")?.addEventListener("click", refreshSearchConsole);
document.querySelector("[data-inspect-url]")?.addEventListener("click", inspectUrl);
document.querySelector("[data-run-pagespeed]")?.addEventListener("click", runPageSpeed);

runLiveChecks();
if (data.seoApiUrl) refreshSearchConsole();
