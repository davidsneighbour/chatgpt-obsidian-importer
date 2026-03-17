# ChatGPT export diff tool

This document explains the purpose and usage of the export diff tool.

The ChatGPT export format is not formally versioned in public documentation.
Because of that, schema changes must be detected by comparing real exports.

The diff tool compares two extracted ChatGPT export folders and reports:

* conversation count differences
* message count differences
* role differences
* content type differences
* top-level conversation field differences
* message field differences
* conversations only present in one export
* content part shape differences

## Usage

```bash
npm run chatgpt:diff -- \
  --old-input-dir /path/to/older-export \
  --new-input-dir /path/to/newer-export
```

Machine-readable mode:

```bash
npm run chatgpt:diff -- \
  --old-input-dir /path/to/older-export \
  --new-input-dir /path/to/newer-export \
  --json
```

## Recommended workflow

1. request a new ChatGPT export
2. extract it into a dated folder
3. run the analysis tool
4. run the diff tool against the previous export
5. update the importer if needed

This gives early warning when the export structure changes.

## Notes

The tool compares structure, not semantic meaning.
It is intended as a schema drift detector, not a full content diff tool.
