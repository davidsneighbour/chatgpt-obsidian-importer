#!/usr/bin/env node

import type { ImportConfig } from '../types/chatgpt-export.js';
import { importConversations } from '../utils/chatgpt-export.js';
import {
  readBaselineFile,
  readConversationsFromDirectory,
  runPreImportCheck,
  summariseExport,
} from '../utils/export-analysis.js';
import { getNextValue } from '../utils/cli.js';

/**
 * Print CLI help.
 */
function printHelp(): void {
  console.log(`Usage:
  node src/scripts/import-chatgpt-export.ts --input-dir <path> --vault-dir <path> [options]

Required:
  --input-dir <path>   Extracted ChatGPT export folder
  --vault-dir <path>   Obsidian vault root

Optional:
  --output-dir <path>  Relative output directory inside the vault
  --index-dir <path>   Relative index directory inside the vault
  --verbose            Enable verbose logging
  --dry-run            Show actions without writing files
  --force              Rewrite files even if content is unchanged
  --baseline-file <path> Optional schema baseline file for pre-import validation
  --skip-precheck      Skip baseline validation even if a baseline file is set
  --help               Show this help`);
}

/**
 * Parse CLI arguments into importer configuration.
 *
 * @param args CLI arguments without the Node executable or script path.
 * @returns Parsed import configuration.
 */
function parseArgs(args: string[]): ImportConfig & { baselineFile: string; skipPrecheck: boolean } {
  const config: ImportConfig = {
    inputDir: '',
    vaultDir: '',
    outputDir: '91 Sources/ChatGPT/Conversations',
    indexDir: '91 Sources/ChatGPT/Indexes',
    verbose: false,
    dryRun: false,
    force: false,
    baselineFile: '',
    skipPrecheck: false,
  } as ImportConfig & { baselineFile: string; skipPrecheck: boolean };

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
      case '--input-dir':
        config.inputDir = getNextValue(args, index, '--input-dir');
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

  if (!config.inputDir || !config.vaultDir) {
    printHelp();
    throw new Error('Missing required options: --input-dir and --vault-dir');
  }

  return config;
}

const config = parseArgs(process.argv.slice(2));

await (async (): Promise<void> => {
  if (config.baselineFile && !config.skipPrecheck) {
    const [conversations, baseline] = await Promise.all([
      readConversationsFromDirectory(config.inputDir),
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

  return importConversations(config);
})()
  .then((result) => {
    console.log('[chatgpt-import] Done');
    console.log(`[chatgpt-import] Conversations processed: ${result.processed}`);
    console.log(`[chatgpt-import] Created: ${result.created}`);
    console.log(`[chatgpt-import] Updated: ${result.updated}`);
    console.log(`[chatgpt-import] Skipped: ${result.skipped}`);
  })
  .catch((error: unknown) => {
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
