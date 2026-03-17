#!/usr/bin/env node

import process from 'node:process';
import { getNextValue } from '../utils/cli.js';
import {
  readConversationsFromDirectory,
  summariseExport,
  toJsonExportSummary,
  buildBaselineFromSummary,
} from '../utils/export-analysis.js';

interface Config {
  inputDir: string;
  verbose: boolean;
  json: boolean;
  writeBaselineFile: string;
}

/**
 * Print CLI help.
 */
function printHelp(): void {
  console.log(`Usage:
  node src/scripts/analyse-export.ts --input-dir <path> [options]

Required:
  --input-dir <path>           Directory containing conversations.json

Optional:
  --json                       Print machine-readable JSON output
  --write-baseline <path>      Write a schema baseline JSON file
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
    verbose: false,
    json: false,
    writeBaselineFile: '',
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
      case '--verbose':
        config.verbose = true;
        break;
      case '--json':
        config.json = true;
        break;
      case '--write-baseline':
        config.writeBaselineFile = getNextValue(args, index, '--write-baseline');
        index += 1;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!config.inputDir) {
    throw new Error('--input-dir is required');
  }

  return config;
}

const config = parseArgs(process.argv.slice(2));

await (async (): Promise<void> => {
  const conversations = await readConversationsFromDirectory(config.inputDir);
  const summary = summariseExport(conversations);
  const jsonSummary = toJsonExportSummary(summary);

  if (config.writeBaselineFile) {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { default: path } = await import('node:path');
    await mkdir(path.dirname(config.writeBaselineFile), { recursive: true });
    await writeFile(
      config.writeBaselineFile,
      `${JSON.stringify(buildBaselineFromSummary(summary), null, 2)}\n`,
      'utf8',
    );
  }

  if (config.json) {
    console.log(JSON.stringify(jsonSummary, null, 2));
    return;
  }

  console.log('');
  console.log(`Chats: ${jsonSummary.conversationCount}`);
  console.log(`Messages: ${jsonSummary.messageCount}`);
  console.log('');

  console.log('Roles:');
  for (const role of jsonSummary.roles) {
    console.log(role);
  }

  console.log('');
  console.log('Content types:');
  for (const type of jsonSummary.contentTypes) {
    console.log(type);
  }

  console.log('');
  console.log('Content part shapes:');
  for (const kind of jsonSummary.contentPartKinds) {
    console.log(kind);
  }

  console.log('');
  console.log(`Missing message text: ${jsonSummary.missingTextCount}`);

  console.log('');
  if (jsonSummary.earliestConversation) {
    console.log(`Earliest conversation: ${jsonSummary.earliestConversation}`);
  }

  if (jsonSummary.latestConversation) {
    console.log(`Latest conversation: ${jsonSummary.latestConversation}`);
  }

  if (config.verbose) {
    console.log('');
    console.log('Conversation keys:');
    for (const key of jsonSummary.conversationKeys) {
      console.log(key);
    }

    console.log('');
    console.log('Message keys:');
    for (const key of jsonSummary.messageKeys) {
      console.log(key);
    }
  }

  console.log('');
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
