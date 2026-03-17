# chatgpt-obsidian-importer

Import ChatGPT account exports into an Obsidian vault as structured Markdown notes.

## What it does

- Reads `conversations.json` from an extracted ChatGPT export
- Creates one Markdown note per conversation
- Re-imports safely using `conversation_id` as the canonical key
- Generates Obsidian index notes sorted by date and title
- Optionally processes the latest ZIP from an inbox folder automatically

## Suggested workflow

1. Export your ChatGPT data from ChatGPT settings.
2. Save the ZIP into a local inbox folder.
3. Run the latest-import wrapper or extract manually and run the direct importer.
4. Open Obsidian and use Dataview or regular search against the imported notes.

## Install

```bash
npm install
```

## Direct import

```bash
npm run dev:import -- \
  --input-dir "${HOME}/imports/chatgpt-export/export-2026-03-17" \
  --vault-dir "${HOME}/Documents/Obsidian/MyVault" \
  --verbose
```

## Import latest ZIP automatically

```bash
npm run dev:import-latest -- \
  --inbox-dir "${HOME}/imports/chatgpt-export/inbox" \
  --working-dir "${HOME}/imports/chatgpt-export/work" \
  --archive-dir "${HOME}/imports/chatgpt-export/archive" \
  --vault-dir "${HOME}/Documents/Obsidian/MyVault" \
  --verbose
```

## Default vault paths

The importer defaults to these relative paths inside the vault:

- `91 Sources/ChatGPT/Conversations`
- `91 Sources/ChatGPT/Indexes`

## Example frontmatter

```yaml
---
source: chatgpt
conversation_id: '...'
title: '...'
created: '...'
updated: '...'
message_count: 0
participants:
  - user
  - assistant
imported_at: '...'
tags:
  - chatgpt
  - imported
---
```

## Suggested Dataview query

````markdown
```dataview
TABLE updated, message_count
FROM "91 Sources/ChatGPT/Conversations"
WHERE source = "chatgpt"
SORT updated DESC
```
````

## Schema guardrails

Run a structural pre-import validation against the local baseline:

```bash
npm run chatgpt:precheck -- \
  --input-dir /path/to/export \
  --baseline-file config/chatgpt-export-baseline.json
```

You can also run diagnostics on export structure changes:

```bash
npm run chatgpt:analyse -- --input-dir /path/to/export
npm run chatgpt:diff -- --old-input-dir /path/to/old --new-input-dir /path/to/new
```

The direct and latest-import commands support `--baseline-file` and `--skip-precheck`.

## Release

```bash
npm run release
```
