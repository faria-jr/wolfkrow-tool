import type { ParsedDocument } from './index';

export async function parseUrl(url: string): Promise<ParsedDocument> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Wolfkrow/1.0 (+knowledge-engine)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);

  const html = await res.text();

  const { JSDOM } = await import('jsdom');
  const { Readability } = await import('@mozilla/readability');
  const TurndownService = (await import('turndown')).default;

  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const article = new Readability(doc).parse();

  if (!article) return { text: html, title: url };

  const td = new TurndownService();
  return {
    text: article.content ? td.turndown(article.content) : html,
    title: article.title ?? undefined,
  };
}
