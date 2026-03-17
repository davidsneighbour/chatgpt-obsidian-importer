/**
 * Escape a string for a double-quoted YAML scalar.
 *
 * @param value Input string.
 * @returns Escaped string.
 */
export function escapeYaml(value: string): string {
  return value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"');
}

/**
 * Safely return a string value.
 *
 * @param value Unknown input value.
 * @returns String value or `undefined`.
 */
export function safeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Create a compact synthetic identifier.
 *
 * @returns Synthetic identifier.
 */
export function createSyntheticId(): string {
  return `synthetic-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Sanitise a title while keeping it readable.
 *
 * @param value Input title.
 * @returns Normalised title.
 */
export function sanitiseTitle(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return 'Untitled conversation';
  }

  return trimmed.replace(/\s+/gu, ' ');
}
