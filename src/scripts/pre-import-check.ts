#!/usr/bin/env node

import process from 'node:process';
import { getNextValue } from '../utils/cli.js';
import {
  readBaselineFile,
  readConversationsFromDirectory,
  runPreImportCheck,
  summariseExport,
} from '../utils/export-analysis.js';

interface Config {
  inputDir: string;
  baselineFile: string;
  json: boolean;
  verbose: boolean;
}

/**
 * Print CLI help.
 */
function printHelp(): void {
  console.log(`Usage:
  node src/scripts/pre-import-check.ts --input-dir <path> --baseline-file <path> [options]

Required:
  --input-dir <path>           Directory containing conversations.json
  --baseline-file <path>       JSON schema baseline file

Optional:
  --json                       Print machine-readable JSON output
  --verbose                    Print additional diagnostics
  --help                       Show this help`);
}

/**
 * Parse CLI arguments.
 *
 * @param args CLI arguments.
 * @returns Parsed configuration.
 */
function parseArgs(args: string[]): Config {
  const config: Config = {
    inputDir: '',
    baselineFile: '',
    json: false,
    verbose: false,
  };

  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--input-dir':
        config.inputDir = getNextValue(args, index, '--input-dir');
        index += 1;
        break;
      case '--baseline-file':
        config.baselineFile = getNextValue(args, index, '--baseline-file');
        index += 1;
        break;
      case '--json':
        config.json = true;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!config.inputDir || !config.baselineFile) {
    throw new Error('--input-dir and --baseline-file are required');
  }

  return config;
}

const config = parseArgs(process.argv.slice(2));

await (async (): Promise<void> => {
  const [conversations, baseline] = await Promise.all([
    readConversationsFromDirectory(config.inputDir),
    readBaselineFile(config.baselineFile),
  ]);

  const summary = summariseExport(conversations);
  const result = runPreImportCheck(summary, baseline);

  if (config.json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  console.log(`Pre-import check: ${result.ok ? 'PASS' : 'FAIL'}`);
  console.log(`Chats: ${result.summary.conversationCount}`);
  console.log(`Messages: ${result.summary.messageCount}`);
  console.log(`Missing message text: ${result.summary.missingTextCount}`);

  if (result.summary.earliestConversation) {
    console.log(`Earliest conversation: ${result.summary.earliestConversation}`);
  }

  if (result.summary.latestConversation) {
    console.log(`Latest conversation: ${result.summary.latestConversation}`);
  }

  console.log('');

  if (result.errors.length > 0) {
    console.log('Errors:');
    for (const error of result.errors) {
      console.log(`* ${error}`);
    }
    console.log('');
  }

  if (result.warnings.length > 0 || config.verbose) {
    console.log('Warnings:');
    if (result.warnings.length === 0) {
      console.log('* none');
    } else {
      for (const warning of result.warnings) {
        console.log(`* ${warning}`);
      }
    }
    console.log('');
  }

  process.exit(result.ok ? 0 : 1);
})().catch((error: unknown) => {
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
