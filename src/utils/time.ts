/**
 * Convert mixed export timestamp values into ISO strings.
 *
 * @param value Export timestamp value.
 * @returns ISO timestamp or `null`.
 */
export function normaliseTimestamp(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return normaliseTimestamp(numeric);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Compare ISO timestamps ascending.
 *
 * @param left Left timestamp.
 * @param right Right timestamp.
 * @returns Sort result.
 */
export function compareIsoAsc(left: string | null, right: string | null): number {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  return leftTime - rightTime;
}

/**
 * Compare ISO timestamps descending.
 *
 * @param left Left timestamp.
 * @param right Right timestamp.
 * @returns Sort result.
 */
export function compareIsoDesc(left: string | null, right: string | null): number {
  return compareIsoAsc(right, left);
}
