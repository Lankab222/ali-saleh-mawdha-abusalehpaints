import type { AuditItem, AuditSource, AuditThresholds } from "./types";

export const cleanBody = (value?: string) =>
  (value ?? "")
    .replace(/^---[\s\S]*?---/u, "")
    .replace(/<[^>]+>/gu, " ")
    .replace(/[#*_>`\[\]()!-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

export const bodyOf = (entry: unknown) => {
  if (typeof entry !== "object" || entry === null || !("body" in entry)) return "";
  const body = (entry as { body?: unknown }).body;
  return typeof body === "string" ? body : "";
};

export function createAudit(source: AuditSource, thresholds: AuditThresholds): AuditItem {
  const seoTitle = (source.seoTitle || source.title).trim();
  const seoDescription = (source.seoDescription || source.description).trim();
  const focusKeyword = (source.focusKeyword || "").trim();
  const canonical = (source.canonical || "").trim();
  const contentLength = cleanBody(source.body).length;
  const warnings: string[] = [];

  let earned = 0;
  let possible = 0;

  const addCheck = (weight: number, passed: boolean, warning: string, partial = false) => {
    possible += weight;
    if (passed) {
      earned += weight;
      return;
    }
    if (partial) earned += Math.round(weight / 2);
    warnings.push(warning);
  };

  addCheck(
    14,
    seoTitle.length >= thresholds.minimumTitleLength && seoTitle.length <= thresholds.maximumTitleLength,
    seoTitle.length < thresholds.minimumTitleLength ? "عنوان SEO قصير" : "عنوان SEO أطول من الحد المحدد",
    seoTitle.length >= 20 && seoTitle.length <= thresholds.maximumTitleLength + 10,
  );

  addCheck(
    16,
    seoDescription.length >= thresholds.minimumDescriptionLength && seoDescription.length <= thresholds.maximumDescriptionLength,
    seoDescription.length < thresholds.minimumDescriptionLength ? "وصف SEO قصير" : "وصف SEO أطول من الحد المحدد",
    seoDescription.length >= 55 && seoDescription.length <= thresholds.maximumDescriptionLength + 25,
  );

  addCheck(10, Boolean(source.image), "لا توجد صورة رئيسية");
  addCheck(8, Boolean(source.imageAlt?.trim()), "النص البديل للصورة غير موجود");
  addCheck(10, Boolean(source.terms && source.terms.length >= 2), "أضف كلمتين أو وسمين مرتبطين على الأقل");
  addCheck(
    14,
    contentLength >= thresholds.minimumContentCharacters,
    "المحتوى يحتاج إلى تفاصيل أكثر",
    contentLength >= Math.round(thresholds.minimumContentCharacters / 2),
  );
  addCheck(10, Boolean(focusKeyword), "حدد الكلمة المفتاحية الأساسية");

  if (focusKeyword) {
    const normalizedKeyword = focusKeyword.toLocaleLowerCase("ar");
    const inTitle = seoTitle.toLocaleLowerCase("ar").includes(normalizedKeyword);
    const inDescription = seoDescription.toLocaleLowerCase("ar").includes(normalizedKeyword);
    addCheck(8, inTitle, "الكلمة الأساسية غير موجودة في عنوان SEO", inDescription);
    addCheck(6, inDescription, "الكلمة الأساسية غير موجودة في وصف SEO", inTitle);
  } else {
    possible += 14;
  }

  if (source.supportsUpdatedDate) addCheck(5, Boolean(source.updatedDate), "أضف تاريخ آخر تحديث");
  if (source.supportsFaq) addCheck(5, Boolean(source.faqCount && source.faqCount > 0), "أضف سؤالًا شائعًا واحدًا على الأقل");

  if (source.noindex && !source.draft) warnings.push("الصفحة منشورة لكنها مضبوطة على noindex");
  if (canonical && !/^https:\/\//iu.test(canonical) && !canonical.startsWith("/")) {
    warnings.push("رابط Canonical المخصص يجب أن يبدأ بـ https:// أو /");
  }

  const collectionRoute = source.collection === "blog" ? "blog" : source.collection;

  return {
    id: source.id,
    collection: source.collection,
    kind: source.kind,
    title: source.title,
    path: source.path,
    editPath: `/admin/#/collections/${collectionRoute}/entries/${encodeURIComponent(source.id)}`,
    score: possible > 0 ? Math.round((earned / possible) * 100) : 0,
    draft: source.draft,
    noindex: Boolean(source.noindex),
    indexingPriority: source.indexingPriority || "عادية",
    warnings,
    seoTitle,
    seoDescription,
    focusKeyword,
    canonical,
    seoTitleLength: seoTitle.length,
    descriptionLength: seoDescription.length,
    contentLength,
  };
}

export function applyDuplicateWarnings(items: AuditItem[]) {
  const titleMap = new Map<string, AuditItem[]>();
  const descriptionMap = new Map<string, AuditItem[]>();
  const keywordMap = new Map<string, AuditItem[]>();

  for (const item of items) {
    const title = item.seoTitle.toLocaleLowerCase("ar").trim();
    const description = item.seoDescription.toLocaleLowerCase("ar").trim();
    const keyword = item.focusKeyword.toLocaleLowerCase("ar").trim();
    if (title) titleMap.set(title, [...(titleMap.get(title) || []), item]);
    if (description) descriptionMap.set(description, [...(descriptionMap.get(description) || []), item]);
    if (keyword) keywordMap.set(keyword, [...(keywordMap.get(keyword) || []), item]);
  }

  for (const group of titleMap.values()) {
    if (group.length > 1) group.forEach((item) => item.warnings.push("عنوان SEO مكرر في أكثر من صفحة"));
  }
  for (const group of descriptionMap.values()) {
    if (group.length > 1) group.forEach((item) => item.warnings.push("وصف SEO مكرر في أكثر من صفحة"));
  }
  for (const group of keywordMap.values()) {
    if (group.length > 1) group.forEach((item) => item.warnings.push("الكلمة الأساسية مستهدفة في أكثر من صفحة"));
  }

  return items;
}
