
# ChatGPT export schema reference

This document explains the structure of the ChatGPT data export used by the
ChatGPT → Obsidian importer.

OpenAI does not publish a formal schema for the export format. The structure
documented here is derived from real exports and may change in the future.

Official documentation only describes how to request the export:

<https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data>

## Export archive structure

The export is delivered as a ZIP archive containing several files.

Typical structure:

```plaintext

chatgpt-export/
conversations.json
chat.html
other account metadata files

```

The importer only relies on:

```plaintext

conversations.json

````

All conversations are stored inside this file.

## conversations.json

The file contains an array of conversation objects.

Example:

```json
[
  {
    "id": "conversation-id",
    "title": "Conversation title",
    "create_time": 1700000000.123,
    "update_time": 1700000500.456,
    "mapping": { ... },
    "current_node": "node-id"
  }
]
````

## Conversation object

| field        | type   | description                                     |
| ------------ | ------ | ----------------------------------------------- |
| id           | string | unique conversation identifier                  |
| title        | string | conversation title shown in the ChatGPT sidebar |
| create_time  | number | timestamp of first message                      |
| update_time  | number | timestamp of last message                       |
| mapping      | object | graph containing all message nodes              |
| current_node | string | identifier of the currently active node         |

### Timestamps

Timestamps are Unix timestamps.

Examples:

```plaintext

1700000000
1700000000.123

```

Conversion example:

```ts
new Date(timestamp * 1000)
```

## Message storage model

Messages are stored in a **node graph** inside the `mapping` field.

Example:

```json
"mapping": {
  "node-id-1": {
    "id": "node-id-1",
    "parent": null,
    "children": ["node-id-2"],
    "message": { ... }
  }
}
```

Each node represents a message.

This structure supports **branching responses** when a reply is regenerated.

## Message object

Example:

```json
"message": {
  "id": "msg-id",
  "author": {
    "role": "assistant"
  },
  "create_time": 1700000001.222,
  "content": {
    "content_type": "text",
    "parts": [
      "Hello world"
    ]
  }
}
```

### Message fields

| field         | type   | description                |
| ------------- | ------ | -------------------------- |
| id            | string | message identifier         |
| author.role   | string | role of the message author |
| create_time   | number | timestamp                  |
| content.parts | array  | message text fragments     |

### Roles

Observed roles include:

```plaintext

user
assistant
system
tool

```

## Extracting message text

Text is usually stored in:

```plaintext

message.content.parts[]

```

Example:

```json
"parts": [
  "The answer to your question is..."
]
```

## Message ordering

Messages should be ordered by:

```plaintext

message.create_time

```

The graph structure also allows reconstructing the conversation chain using
`parent` and `children`, but timestamp sorting is sufficient for most imports.

## Conversation metadata mapping

Recommended mapping for Obsidian import:

| ChatGPT field | Obsidian frontmatter |
| ------------- | -------------------- |
| id            | conversation_id      |
| title         | title                |
| create_time   | created              |
| update_time   | updated              |
| message count | message_count        |

Example frontmatter:

```yaml
---
source: chatgpt
conversation_id: abc123
title: Example conversation
created: 2026-03-17T05:17:00Z
updated: 2026-03-17T05:24:00Z
message_count: 8
tags:
  - chatgpt
---
```

## Archived vs active chats

The export currently **does not include a reliable archived flag**.

The importer therefore cannot determine whether a chat was:

```plaintext

active
archived
deleted

```

All conversations are treated as historical records.

## Known limitations of the export

The export format has several limitations:

* archived state not included
* project folders not included
* attachments may not be embedded
* images may reference external URLs
* regenerated answers appear as graph branches

The importer therefore treats the export as **conversation history only**.

## Importer assumptions

The importer assumes:

1. `conversations.json` exists
2. messages can be extracted from `mapping`
3. text content exists in `content.parts`
4. timestamps can be converted to ISO dates

If these assumptions change, the importer must be updated.

## Future improvements

Possible future enhancements:

* attachment extraction
* code block preservation improvements
* conversation branching visualisation
* topic detection and tagging
