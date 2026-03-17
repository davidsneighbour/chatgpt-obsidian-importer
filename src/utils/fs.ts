import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Read a UTF-8 text file if it exists.
 *
 * @param filePath Absolute or relative file path.
 * @returns File content or `null` if the file does not exist.
 */
export async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

/**
 * Ensure a directory exists.
 *
 * @param directoryPath Directory to create.
 * @param dryRun Whether writes are disabled.
 */
export async function ensureDirectory(directoryPath: string, dryRun: boolean): Promise<void> {
  if (dryRun) {
    return;
  }

  await mkdir(directoryPath, { recursive: true });
}

/**
 * Write a UTF-8 text file, creating parent directories as needed.
 *
 * @param filePath Output file path.
 * @param content File content.
 * @param dryRun Whether writes are disabled.
 * @param verbose Whether verbose logging is enabled.
 */
export async function writeTextFile(
  filePath: string,
  content: string,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  if (verbose) {
    console.log(`${dryRun ? '[dry-run] ' : ''}[chatgpt-import] Writing ${filePath}`);
  }

  if (dryRun) {
    return;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

/**
 * Move a file into a destination path, creating the destination directory first.
 *
 * @param sourcePath Existing file path.
 * @param targetPath Destination file path.
 * @param dryRun Whether writes are disabled.
 * @param verbose Whether verbose logging is enabled.
 */
export async function moveFile(
  sourcePath: string,
  targetPath: string,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  if (verbose) {
    console.log(
      `${dryRun ? '[dry-run] ' : ''}[chatgpt-import] Moving ${sourcePath} -> ${targetPath}`,
    );
  }

  if (dryRun) {
    return;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await rename(sourcePath, targetPath);
}

/**
 * Check whether a path exists.
 *
 * @param targetPath Path to inspect.
 * @returns True if the path exists.
 */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

/**
 * Narrow an unknown error to a Node.js error shape.
 *
 * @param error Unknown error value.
 * @returns Whether the value is a Node-style error.
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}
