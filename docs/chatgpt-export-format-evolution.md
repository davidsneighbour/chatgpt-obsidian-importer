
# ChatGPT export format evolution

This document tracks known structural characteristics of ChatGPT exports over time.

Because OpenAI does not publish a stable schema, the importer must tolerate
format changes.

## 2023 – initial widely observed format

Export contained:

```plaintext

conversations.json
chat.html

```

Conversation object structure:

```plaintext


id
title
create_time
update_time
mapping
current_node

```

Messages stored inside `mapping`.

Content stored as:

```plaintext


content.parts[]

```

## 2024 – stable message structure

Observed characteristics:

* roles include `user`, `assistant`, `system`
* `tool` role appears occasionally
* timestamps sometimes include decimal fractions
* `content_type` generally `"text"`

No archive flag exported.

## 2025 – multimodal additions

Observed differences:

* some messages contain additional metadata
* images and tool outputs may appear in message content
* content may include structured objects inside `parts`

Example variation:

```plaintext


{
"type": "image"
"url": "..."
}

```

Importer strategy:

* ignore unsupported content types
* extract only plain text fragments

## Branching responses

ChatGPT allows regenerating assistant responses.

This produces graph structures:

```plaintext


parent -> message -> alternative child nodes

```

Importer strategy:

* flatten graph
* sort messages by timestamp
* ignore alternate branches

## Known non-exported metadata

The export does not include several UI features:

| Feature             | Exported |
| ------------------- | -------- |
| archived state      | no       |
| folders / projects  | no       |
| pinned chats        | no       |
| chat sharing status | no       |

These cannot be reconstructed.

## Stability observations

Across several years the following elements have remained stable:

* `conversations.json`
* conversation id
* mapping graph
* message role
* message timestamp
* message text in `content.parts`

These fields are considered **safe dependencies**.

## Importer compatibility strategy

The importer should:

1. treat the schema as semi-structured
2. tolerate unknown fields
3. ignore unsupported message types
4. log format changes in verbose mode

## Detecting format changes

Possible warning conditions:

* missing `mapping`
* missing `content.parts`
* unknown content types
* timestamps not convertible

## Recommended logging

Importer should log warnings such as:

```plaintext


[chatgpt-import] unknown message content type detected
[chatgpt-import] missing message text
[chatgpt-import] conversation mapping empty

```

These warnings help detect schema changes early.

## Updating this document

Whenever the exporter encounters new data structures:

1. record the new structure here
2. update the importer parser
3. bump the importer version

## Version tracking recommendation

Add importer metadata to generated notes:

```plaintext


export_source: openai_chatgpt_export
export_import_version: 1
imported_at: 2026-03-17T10:00:00Z

```

This allows re-importing later if the importer improves.

## Summary

Despite the lack of official documentation, the export format has remained
stable for core conversation data.

The importer should therefore prioritise:

* tolerant parsing
* minimal structural assumptions
* safe fallback behaviour
