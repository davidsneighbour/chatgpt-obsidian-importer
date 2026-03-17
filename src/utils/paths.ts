import path from 'node:path';

/**
 * Build a wiki-link-compatible relative target without the `.md` extension.
 *
 * @param fromDir Source directory.
 * @param toDir Destination directory.
 * @param fileName Markdown file name.
 * @returns Relative link target for Obsidian wiki links.
 */
export function buildRelativeLink(fromDir: string, toDir: string, fileName: string): string {
  const relative = path.relative(fromDir, path.join(toDir, fileName));
  return relative.replace(/\\/g, '/').replace(/\.md$/iu, '');
}

/**
 * Convert text into a simple deterministic slug.
 *
 * @param value Input text.
 * @returns URL-safe slug.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+/u, '')
    .replace(/-+$/u, '')
    .replace(/-{2,}/gu, '-');
}
