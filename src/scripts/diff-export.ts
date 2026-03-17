#!/usr/bin/env node

import process from 'node:process';
import { getNextValue } from '../utils/cli.js';
import {
  diffExportSummaries,
  readConversationsFromDirectory,
  summariseExport,
} from '../utils/export-analysis.js';

interface Config {
  oldInputDir: string;
  newInputDir: string;
  verbose: boolean;
  json: boolean;
}

/**
 * Print CLI help.
 */
function printHelp(): void {
  console.log(`Usage:
  node src/scripts/diff-export.ts --old-input-dir <path> --new-input-dir <path> [options]

Required:
  --old-input-dir <path>       Directory containing the older conversations.json
  --new-input-dir <path>       Directory containing the newer conversations.json

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
    oldInputDir: '',
    newInputDir: '',
    verbose: false,
    json: false,
  };

  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--old-input-dir':
        config.oldInputDir = getNextValue(args, index, '--old-input-dir');
        index += 1;
        break;
      case '--new-input-dir':
        config.newInputDir = getNextValue(args, index, '--new-input-dir');
        index += 1;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--json':
        config.json = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!config.oldInputDir || !config.newInputDir) {
    throw new Error('--old-input-dir and --new-input-dir are required');
  }

  return config;
}

/**
 * Print one report section.
 *
 * @param title Section title.
 * @param values Values to print.
 */
function printSection(title: string, values: string[]): void {
  console.log(`${title}:`);
  if (values.length === 0) {
    console.log('  none');
    console.log('');
    return;
  }

  for (const value of values) {
    console.log(`  ${value}`);
  }
  console.log('');
}

const config = parseArgs(process.argv.slice(2));

await (async (): Promise<void> => {
  const [oldConversations, newConversations] = await Promise.all([
    readConversationsFromDirectory(config.oldInputDir),
    readConversationsFromDirectory(config.newInputDir),
  ]);

  const oldSummary = summariseExport(oldConversations);
  const newSummary = summariseExport(newConversations);
  const diff = diffExportSummaries(oldSummary, newSummary);

  if (config.json) {
    console.log(JSON.stringify(diff, null, 2));
    return;
  }

  console.log('Old export summary');
  console.log(`  Chats: ${diff.oldSummary.conversationCount}`);
  console.log(`  Messages: ${diff.oldSummary.messageCount}`);
  console.log('');

  console.log('New export summary');
  console.log(`  Chats: ${diff.newSummary.conversationCount}`);
  console.log(`  Messages: ${diff.newSummary.messageCount}`);
  console.log('');

  printSection('Conversation keys added in new export', diff.conversationKeysAdded);
  printSection('Conversation keys missing from new export', diff.conversationKeysRemoved);
  printSection('Mapping node keys added in new export', diff.mappingNodeKeysAdded);
  printSection('Mapping node keys missing from new export', diff.mappingNodeKeysRemoved);
  printSection('Message keys added in new export', diff.messageKeysAdded);
  printSection('Message keys missing from new export', diff.messageKeysRemoved);
  printSection('Author keys added in new export', diff.authorKeysAdded);
  printSection('Author keys missing from new export', diff.authorKeysRemoved);
  printSection('Content keys added in new export', diff.contentKeysAdded);
  printSection('Content keys missing from new export', diff.contentKeysRemoved);
  printSection('Roles added in new export', diff.rolesAdded);
  printSection('Roles missing from new export', diff.rolesRemoved);
  printSection('Content types added in new export', diff.contentTypesAdded);
  printSection('Content types missing from new export', diff.contentTypesRemoved);
  printSection('Content part shapes added in new export', diff.contentPartKindsAdded);
  printSection('Content part shapes missing from new export', diff.contentPartKindsRemoved);

  console.log(`Conversations only in old export: ${diff.conversationsOnlyInOld.length}`);
  console.log(`Conversations only in new export: ${diff.conversationsOnlyInNew.length}`);
  console.log(`Conversations in both exports: ${diff.conversationsInBoth}`);
  console.log('');

  if (config.verbose) {
    printSection('Sample conversations only in old export', diff.conversationsOnlyInOld.slice(0, 20));
    printSection('Sample conversations only in new export', diff.conversationsOnlyInNew.slice(0, 20));
  }
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
