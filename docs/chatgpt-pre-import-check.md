# ChatGPT local pre-import check

This document explains the local pre-import check.

The purpose of the pre-import check is to stop an import when the incoming
ChatGPT export contains structural changes that the importer may not handle
correctly yet.

## Baseline file

The repository includes a local baseline file:

```text
config/chatgpt-export-baseline.json
```

This file defines the currently allowed export structure.

The pre-import check compares the incoming export against that baseline.

## Usage

```bash
npm run chatgpt:precheck -- \
  --input-dir /path/to/export \
  --baseline-file config/chatgpt-export-baseline.json
```

Machine-readable mode:

```bash
npm run chatgpt:precheck -- \
  --input-dir /path/to/export \
  --baseline-file config/chatgpt-export-baseline.json \
  --json
```

## Exit codes

* `0` = pass
* `1` = fail

This makes the command usable in local wrappers or automation.

## What fails the check

The command fails when the export contains new values not present in the
baseline, for example:

* new conversation keys
* new mapping node keys
* new message keys
* new author keys
* new content keys
* new roles
* new content types
* new content part shapes

## Example workflow

1. extract the newest export
2. run the precheck
3. if it passes, run the importer
4. if it fails, inspect with `chatgpt:analyse` and `chatgpt:diff`
5. update the importer and baseline only after reviewing the change

## Import wrapper integration

The `import-latest` wrapper can run this precheck automatically when you pass:

```bash
--baseline-file config/chatgpt-export-baseline.json
```

To bypass the check intentionally, use:

```bash
--skip-precheck
```
