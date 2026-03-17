# ChatGPT export analysis tool

This document explains the purpose and usage of the export analysis tool.

The ChatGPT export format is not formally documented and may evolve over time.
Because of that, the importer repository includes a small diagnostic utility.

The analysis tool helps detect schema changes before they break the importer.

## Purpose

The tool analyses `conversations.json` and prints statistics such as:

* number of conversations
* number of messages
* message roles encountered
* content types encountered
* missing message text
* unexpected message structures

This helps detect situations where the export format has changed.

## Usage

```bash
npm run chatgpt:analyse -- --input-dir /path/to/export
```

Machine-readable mode:

```bash
npm run chatgpt:analyse -- --input-dir /path/to/export --json
```

Generate a new baseline file from a known-good export:

```bash
npm run chatgpt:analyse -- \
  --input-dir /path/to/export \
  --write-baseline config/chatgpt-export-baseline.json
```

## Output

The tool can print either:

* a human-readable terminal report
* a JSON summary suitable for scripts and automation

The JSON output includes:

* observed conversation keys
* observed message keys
* observed content keys
* roles
* content types
* content part shapes
* message and conversation counts

## Recommended workflow

1. request a ChatGPT export
2. extract the archive
3. run `chatgpt:analyse`
4. inspect new content types or keys
5. update the importer and baseline if needed

## Why this matters

Because OpenAI does not publish a stable export schema, importer code must be
robust against unknown fields and evolving data structures.

This analyser makes those changes visible early.
