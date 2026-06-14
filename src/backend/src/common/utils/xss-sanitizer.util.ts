import { sanitize } from 'isomorphic-dompurify';

export function sanitizeHtml(text: string): string {
  if (!text) return '';
  return sanitize(text);
}
