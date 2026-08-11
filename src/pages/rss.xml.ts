import rss from "@astrojs/rss";
import { getCollection, getEntry } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const settingsEntry = await getEntry("settings", "site");
  if (!settingsEntry) throw new Error("ملف إعدادات الموقع غير موجود");
  const settings = settingsEntry.data;
  const posts = (await getCollection("blog", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime(),
  );

  return rss({
    title: settings.siteName,
    description: settings.description,
    site: context.site ?? settings.siteUrl,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishDate,
      link: `/blog/${post.id}/`,
      author: post.data.author,
      categories: [post.data.category, ...post.data.tags],
    })),
    customData: `<language>${settings.locale}</language>`,
  });
}
