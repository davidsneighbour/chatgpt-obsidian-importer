/**
 * Return the next CLI argument value.
 *
 * @param args Full CLI argument array.
 * @param index Current argument index.
 * @param optionName Human-readable option name for error reporting.
 * @returns The next argument value.
 */
export function getNextValue(args: string[], index: number, optionName: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${optionName}`);
  }

  return value;
}
