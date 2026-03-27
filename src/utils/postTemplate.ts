export const POST_TEMPLATE_KEY = "postTemplate";
export const DEFAULT_POST_TEMPLATE =
  "\u{1F3AE} {title}\n\u{1F3F7}\uFE0F {category}\n{tags}\n\u{1F4FA} {url}";

type PostTemplateParams = {
  title: string;
  category: string;
  tags: string[];
  url: string;
};

export function formatPostText(
  format: string,
  params: PostTemplateParams,
): string {
  return format
    .replace(/\{title\}/g, params.title)
    .replace(/\{category\}/g, params.category)
    .replace(/\{tags\}/g, params.tags.join(", "))
    .replace(/\{url\}/g, params.url);
}

export function buildTweetIntentUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
