#!/usr/bin/env node

import type { ImportConfig, ImportLatestConfig } from '../types/chatgpt-export.js';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { importConversations } from '../utils/chatgpt-export.js';
import {
  readBaselineFile,
  readConversationsFromDirectory,
  runPreImportCheck,
  summariseExport,
} from '../utils/export-analysis.js';
import { getNextValue } from '../utils/cli.js';
import { ensureDirectory, moveFile, pathExists } from '../utils/fs.js';

/**
 * Print CLI help.
 */
function printHelp(): void {
  console.log(`Usage:
  node src/scripts/import-latest-chatgpt-export.ts --inbox-dir <path> --working-dir <path> --archive-dir <path> --vault-dir <path> [options]

Required:
  --inbox-dir <path>    Directory containing exported ChatGPT ZIP files
  --working-dir <path>  Directory for temporary extraction
  --archive-dir <path>  Directory where processed ZIP files are moved
  --vault-dir <path>    Obsidian vault root

Optional:
  --output-dir <path>   Relative output directory inside the vault
  --index-dir <path>    Relative index directory inside the vault
  --verbose             Enable verbose logging
  --dry-run             Show actions without writing files
  --force               Rewrite files even if content is unchanged
  --baseline-file <path> Optional schema baseline file for pre-import validation
  --skip-precheck       Skip baseline validation even if a baseline file is set
  --help                Show this help`);
}

/**
 * Parse CLI arguments into wrapper configuration.
 *
 * @param args CLI arguments without the Node executable or script path.
 * @returns Parsed configuration.
 */
interface ParsedLatestConfig extends ImportLatestConfig {
  baselineFile: string;
  skipPrecheck: boolean;
}

function parseArgs(args: string[]): ParsedLatestConfig {
  const config: ParsedLatestConfig = {
    inboxDir: '',
    workingDir: '',
    archiveDir: '',
    vaultDir: '',
    outputDir: '91 Sources/ChatGPT/Conversations',
    indexDir: '91 Sources/ChatGPT/Indexes',
    verbose: false,
    dryRun: false,
    force: false,
    baselineFile: '',
    skipPrecheck: false,
  };

  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--help':
        printHelp();
        process.exit(0);
        break;
      case '--inbox-dir':
        config.inboxDir = getNextValue(args, index, '--inbox-dir');
        index += 1;
        break;
      case '--working-dir':
        config.workingDir = getNextValue(args, index, '--working-dir');
        index += 1;
        break;
      case '--archive-dir':
        config.archiveDir = getNextValue(args, index, '--archive-dir');
        index += 1;
        break;
      case '--vault-dir':
        config.vaultDir = getNextValue(args, index, '--vault-dir');
        index += 1;
        break;
      case '--output-dir':
        config.outputDir = getNextValue(args, index, '--output-dir');
        index += 1;
        break;
      case '--index-dir':
        config.indexDir = getNextValue(args, index, '--index-dir');
        index += 1;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--force':
        config.force = true;
        break;
      case '--baseline-file':
        config.baselineFile = getNextValue(args, index, '--baseline-file');
        index += 1;
        break;
      case '--skip-precheck':
        config.skipPrecheck = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!config.inboxDir || !config.workingDir || !config.archiveDir || !config.vaultDir) {
    printHelp();
    throw new Error(
      'Missing required options: --inbox-dir, --working-dir, --archive-dir and --vault-dir',
    );
  }

  return config;
}

/**
 * Find the newest ZIP export file in an inbox directory.
 *
 * @param inboxDir Inbox directory.
 * @returns Absolute path to the newest ZIP file.
 */
async function findLatestZip(inboxDir: string): Promise<string> {
  const entries = await readdir(inboxDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.zip'))
    .map((entry) => path.join(inboxDir, entry.name));

  if (files.length === 0) {
    throw new Error(`No ZIP files found in ${inboxDir}`);
  }

  const datedFiles = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      mtimeMs: (await stat(filePath)).mtimeMs,
    })),
  );

  datedFiles.sort((left, right) => right.mtimeMs - left.mtimeMs);

  const latest = datedFiles[0]?.filePath;
  if (!latest) {
    throw new Error(`Unable to determine latest ZIP file in ${inboxDir}`);
  }

  return latest;
}

/**
 * Extract a ZIP file into a target directory using the system `unzip` command.
 *
 * @param zipPath ZIP file path.
 * @param destinationDir Extraction directory.
 * @param dryRun Whether writes are disabled.
 * @param verbose Whether verbose logging is enabled.
 */
async function extractZip(
  zipPath: string,
  destinationDir: string,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  if (verbose) {
    console.log(
      `${dryRun ? '[dry-run] ' : ''}[chatgpt-import] Extracting ${zipPath} -> ${destinationDir}`,
    );
  }

  if (dryRun) {
    return;
  }

  await ensureDirectory(destinationDir, false);

  const { spawn } = await import('node:child_process');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('unzip', ['-o', zipPath, '-d', destinationDir], {
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`unzip exited with code ${String(code)}`));
    });
  });
}

/**
 * Build direct importer configuration from the wrapper configuration.
 *
 * @param config Wrapper configuration.
 * @param inputDir Extracted export directory.
 * @returns Direct importer configuration.
 */
function toImportConfig(config: ImportLatestConfig, inputDir: string): ImportConfig {
  return {
    inputDir,
    vaultDir: config.vaultDir,
    outputDir: config.outputDir,
    indexDir: config.indexDir,
    verbose: config.verbose,
    dryRun: config.dryRun,
    force: config.force,
  };
}

const config = parseArgs(process.argv.slice(2));

await (async (): Promise<void> => {
  await ensureDirectory(config.workingDir, config.dryRun);
  await ensureDirectory(config.archiveDir, config.dryRun);

  const zipPath = await findLatestZip(config.inboxDir);
  const zipBaseName = path.basename(zipPath, path.extname(zipPath));
  const extractDir = path.join(config.workingDir, zipBaseName);

  await extractZip(zipPath, extractDir, config.dryRun, config.verbose);

  const conversationsPath = path.join(extractDir, 'conversations.json');
  if (!config.dryRun && !(await pathExists(conversationsPath))) {
    throw new Error(`Expected file not found after extraction: ${conversationsPath}`);
  }

  if (config.baselineFile && !config.skipPrecheck) {
    const [conversations, baseline] = await Promise.all([
      readConversationsFromDirectory(extractDir),
      readBaselineFile(config.baselineFile),
    ]);

    const precheck = runPreImportCheck(summariseExport(conversations), baseline);

    if (!precheck.ok) {
      throw new Error(`Pre-import check failed: ${precheck.errors.join('; ')}`);
    }

    if (config.verbose) {
      console.log('[chatgpt-import] Pre-import check passed');
    }
  }

  const result = await importConversations(toImportConfig(config, extractDir));
  const archiveTarget = path.join(config.archiveDir, path.basename(zipPath));
  await moveFile(zipPath, archiveTarget, config.dryRun, config.verbose);

  console.log('[chatgpt-import] Done');
  console.log(`[chatgpt-import] ZIP file: ${zipPath}`);
  console.log(`[chatgpt-import] Extracted into: ${extractDir}`);
  console.log(`[chatgpt-import] Conversations processed: ${result.processed}`);
  console.log(`[chatgpt-import] Created: ${result.created}`);
  console.log(`[chatgpt-import] Updated: ${result.updated}`);
  console.log(`[chatgpt-import] Skipped: ${result.skipped}`);
})().catch((error: unknown) => {
  console.error('[chatgpt-import] Fatal error');

  if (error instanceof Error) {
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(String(error));
  }

  process.exit(1);
});
