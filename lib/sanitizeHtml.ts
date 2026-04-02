import DOMPurify from 'dompurify'

export function sanitizeHtml(unsafeHtml: string): string {
  return DOMPurify.sanitize(unsafeHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  })
}
