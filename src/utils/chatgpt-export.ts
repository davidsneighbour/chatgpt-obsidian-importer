import type {
  AuthorRole,
  ImportConfig,
  NormalisedConversation,
  NormalisedMessage,
  RawConversation,
  RawMessage,
} from '../types/chatgpt-export.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { readFileIfExists, ensureDirectory, writeTextFile } from './fs.js';
import { buildRelativeLink, slugify } from './paths.js';
import { escapeYaml, safeString, createSyntheticId, sanitiseTitle } from './text.js';
import { compareIsoAsc, compareIsoDesc, normaliseTimestamp } from './time.js';

/**
 * Parse `conversations.json` safely.
 *
 * @param content Raw JSON file content.
 * @returns Parsed raw conversations.
 */
export function parseConversationsJson(content: string): RawConversation[] {
  const parsed: unknown = JSON.parse(content);

  if (!Array.isArray(parsed)) {
    throw new Error('Expected conversations.json to contain a JSON array');
  }

  return parsed as RawConversation[];
}

/**
 * Read and normalise conversations from an extracted export directory.
 *
 * @param inputDir Extracted export directory.
 * @returns Normalised conversations sorted by update time descending.
 */
export async function loadNormalisedConversations(
  inputDir: string,
): Promise<NormalisedConversation[]> {
  const conversationsPath = path.join(inputDir, 'conversations.json');
  const rawContent = await readFile(conversationsPath, 'utf8');
  const parsed = parseConversationsJson(rawContent);

  return parsed
    .map(normaliseConversation)
    .filter((item): item is NormalisedConversation => item !== null)
    .sort((left, right) => compareIsoDesc(left.updated, right.updated));
}

/**
 * Convert a raw conversation into a stable internal representation.
 *
 * @param raw Raw export conversation.
 * @returns Normalised conversation or `null` if no valid ID is present.
 */
export function normaliseConversation(raw: RawConversation): NormalisedConversation | null {
  const id = safeString(raw.id)?.trim();

  if (!id) {
    return null;
  }

  return {
    id,
    title: sanitiseTitle(raw.title ?? `Conversation ${id.slice(0, 8)}`),
    created: normaliseTimestamp(raw.create_time),
    updated: normaliseTimestamp(raw.update_time),
    messages: extractMessages(raw.mapping),
  };
}

/**
 * Extract ordered visible messages from a raw mapping object.
 *
 * @param mapping Raw mapping object.
 * @returns Normalised messages sorted by timestamp.
 */
export function extractMessages(mapping: RawConversation['mapping']): NormalisedMessage[] {
  if (!mapping) {
    return [];
  }

  const messages = Object.values(mapping)
    .map((node) => node.message)
    .filter((message): message is RawMessage => message !== null && message !== undefined)
    .map((message) => ({
      id: safeString(message.id) ?? createSyntheticId(),
      role: normaliseRole(message.author?.role),
      created: normaliseTimestamp(message.create_time),
      text: extractMessageText(message),
    }))
    .filter((message) => message.text.trim().length > 0);

  messages.sort((left, right) => compareIsoAsc(left.created, right.created));
  return messages;
}

/**
 * Extract visible text from a raw message.
 *
 * @param message Raw export message.
 * @returns Combined visible text.
 */
export function extractMessageText(message: RawMessage): string {
  const content = message.content;

  if (!content) {
    return '';
  }

  if (typeof content.text === 'string') {
    return content.text.trim();
  }

  if (!Array.isArray(content.parts)) {
    return '';
  }

  const parts = content.parts
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }

      if (part !== null && typeof part === 'object' && 'text' in part) {
        const maybeText = (part as { text?: unknown }).text;
        return typeof maybeText === 'string' ? maybeText : '';
      }

      return '';
    })
    .filter((part) => part.trim().length > 0);

  return parts.join('\n\n').trim();
}

/**
 * Convert unknown role labels into a stable set.
 *
 * @param role Raw role label.
 * @returns Normalised role.
 */
export function normaliseRole(role: string | undefined): AuthorRole {
  const value = (role ?? '').toLowerCase().trim();

  switch (value) {
    case 'user':
      return 'user';
    case 'assistant':
      return 'assistant';
    case 'system':
      return 'system';
    case 'tool':
      return 'tool';
    default:
      return 'unknown';
  }
}

/**
 * Render one conversation into Markdown.
 *
 * @param conversation Normalised conversation.
 * @returns Markdown document.
 */
export function renderConversationMarkdown(conversation: NormalisedConversation): string {
  const participants = Array.from(new Set(conversation.messages.map((item) => item.role)));
  const frontmatter = [
    '---',
    'source: chatgpt',
    `conversation_id: "${escapeYaml(conversation.id)}"`,
    `title: "${escapeYaml(conversation.title)}"`,
    `created: "${conversation.created ?? ''}"`,
    `updated: "${conversation.updated ?? ''}"`,
    `message_count: ${conversation.messages.length}`,
    'participants:',
    ...participants.map((participant) => `  - ${participant}`),
    `imported_at: "${new Date().toISOString()}"`,
    'tags:',
    '  - chatgpt',
    '  - imported',
    '---',
    '',
  ].join('\n');

  const lines: string[] = [
    `# ${conversation.title}`,
    '',
    '## Metadata',
    '',
    '* Source: ChatGPT export',
    `* Conversation ID: \`${conversation.id}\``,
    `* Created: ${conversation.created ?? 'unknown'}`,
    `* Updated: ${conversation.updated ?? 'unknown'}`,
    `* Messages: ${conversation.messages.length}`,
    '',
    '## Conversation',
    '',
  ];

  for (const message of conversation.messages) {
    lines.push(`### ${capitaliseRole(message.role)}`);
    lines.push('');

    if (message.created) {
      lines.push(`*Timestamp:* ${message.created}`);
      lines.push('');
    }

    lines.push(message.text);
    lines.push('');
  }

  return `${frontmatter}${lines.join('\n').trimEnd()}\n`;
}

/**
 * Render a date-sorted index note.
 *
 * @param conversations Conversations to index.
 * @param outputDir Relative vault conversation directory.
 * @param indexDir Relative vault index directory.
 * @returns Markdown document.
 */
export function renderByDateIndex(
  conversations: NormalisedConversation[],
  outputDir: string,
  indexDir: string,
  fileNamesByConversationId?: Map<string, string>,
): string {
  const lines: string[] = ['# ChatGPT conversations by date', ''];

  for (const conversation of conversations) {
    const fileName =
      fileNamesByConversationId?.get(conversation.id) ?? buildConversationFileName(conversation);
    const relativeTarget = buildRelativeLink(indexDir, outputDir, fileName);
    lines.push(
      `* ${conversation.updated ?? 'unknown'} - [[${relativeTarget}|${conversation.title}]]`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Render a title-sorted index note.
 *
 * @param conversations Conversations to index.
 * @param outputDir Relative vault conversation directory.
 * @param indexDir Relative vault index directory.
 * @returns Markdown document.
 */
export function renderByTitleIndex(
  conversations: NormalisedConversation[],
  outputDir: string,
  indexDir: string,
  fileNamesByConversationId?: Map<string, string>,
): string {
  const sorted = [...conversations].sort((left, right) =>
    left.title.localeCompare(right.title, 'en'),
  );
  const lines: string[] = ['# ChatGPT conversations by title', ''];

  for (const conversation of sorted) {
    const fileName =
      fileNamesByConversationId?.get(conversation.id) ?? buildConversationFileName(conversation);
    const relativeTarget = buildRelativeLink(indexDir, outputDir, fileName);
    lines.push(
      `* [[${relativeTarget}|${conversation.title}]] (${conversation.updated ?? 'unknown'})`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Build a deterministic Markdown file name for one conversation.
 *
 * @param conversation Normalised conversation.
 * @returns Markdown file name.
 */
export function buildConversationFileName(conversation: NormalisedConversation): string {
  const datePrefix = (conversation.updated ?? conversation.created ?? '').slice(0, 10).trim();
  const safeDate = datePrefix || 'undated';
  const safeTitle =
    slugify(conversation.title).slice(0, 80) || `conversation-${conversation.id.slice(0, 8)}`;

  return `${safeDate}-${safeTitle}.md`;
}

/**
 * Import normalised conversations into an Obsidian vault.
 *
 * @param config Import configuration.
 * @returns Import statistics.
 */
export async function importConversations(config: ImportConfig): Promise<{
  processed: number;
  created: number;
  updated: number;
  skipped: number;
}> {
  const conversations = await loadNormalisedConversations(config.inputDir);
  const outputAbsoluteDir = path.join(config.vaultDir, config.outputDir);
  const indexAbsoluteDir = path.join(config.vaultDir, config.indexDir);

  await ensureDirectory(outputAbsoluteDir, config.dryRun);
  await ensureDirectory(indexAbsoluteDir, config.dryRun);

  const existingConversationFiles = await loadExistingConversationFiles(outputAbsoluteDir);
  const usedPaths = new Set(existingConversationFiles.values());
  const fileNamesByConversationId = new Map<string, string>();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const conversation of conversations) {
    const fileName = buildConversationFileName(conversation);
    const preferredPath = path.join(outputAbsoluteDir, fileName);
    const knownPath = existingConversationFiles.get(conversation.id);
    const fullPath = resolveOutputPath(preferredPath, knownPath, conversation.id, usedPaths);
    fileNamesByConversationId.set(conversation.id, path.basename(fullPath));
    const markdown = renderConversationMarkdown(conversation);
    const existing = await readFileIfExists(fullPath);

    if (existing === null) {
      created += 1;
      await writeTextFile(fullPath, markdown, config.dryRun, config.verbose);
      continue;
    }

    if (existing !== markdown || config.force) {
      updated += 1;
      await writeTextFile(fullPath, markdown, config.dryRun, config.verbose);
    } else {
      skipped += 1;

      if (config.verbose) {
        console.log(`[chatgpt-import] Skipped unchanged file: ${fullPath}`);
      }
    }

    existingConversationFiles.set(conversation.id, fullPath);
  }

  await writeTextFile(
    path.join(indexAbsoluteDir, 'by-date.md'),
    renderByDateIndex(conversations, config.outputDir, config.indexDir, fileNamesByConversationId),
    config.dryRun,
    config.verbose,
  );

  await writeTextFile(
    path.join(indexAbsoluteDir, 'by-title.md'),
    renderByTitleIndex(conversations, config.outputDir, config.indexDir, fileNamesByConversationId),
    config.dryRun,
    config.verbose,
  );

  return {
    processed: conversations.length,
    created,
    updated,
    skipped,
  };
}

/**
 * Load existing conversation IDs from previously imported markdown files.
 *
 * @param outputAbsoluteDir Conversation output directory.
 * @returns Mapping of conversation ID to markdown file path.
 */
async function loadExistingConversationFiles(
  outputAbsoluteDir: string,
): Promise<Map<string, string>> {
  const entries = await readdir(outputAbsoluteDir, { withFileTypes: true });
  const byConversationId = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
      continue;
    }

    const fullPath = path.join(outputAbsoluteDir, entry.name);
    const content = await readFile(fullPath, 'utf8');
    const conversationId = parseConversationIdFromFrontmatter(content);

    if (conversationId) {
      byConversationId.set(conversationId, fullPath);
    }
  }

  return byConversationId;
}

/**
 * Parse `conversation_id` from YAML frontmatter.
 *
 * @param markdown Conversation markdown file.
 * @returns Parsed conversation ID or `null`.
 */
function parseConversationIdFromFrontmatter(markdown: string): string | null {
  const match = markdown.match(/^---\n[\s\S]*?\nconversation_id:\s*"?([^"\n]+)"?\n/mu);
  return match?.[1]?.trim() || null;
}

/**
 * Resolve output path while preserving canonical conversation IDs.
 *
 * @param preferredPath Default path from title/date slug.
 * @param knownPath Existing path for this conversation ID.
 * @param conversationId Canonical conversation ID.
 * @param usedPaths Paths reserved by existing files.
 * @returns File path to write.
 */
function resolveOutputPath(
  preferredPath: string,
  knownPath: string | undefined,
  conversationId: string,
  usedPaths: Set<string>,
): string {
  if (knownPath) {
    usedPaths.add(knownPath);
    return knownPath;
  }

  if (!usedPaths.has(preferredPath)) {
    usedPaths.add(preferredPath);
    return preferredPath;
  }

  const parsed = path.parse(preferredPath);
  const fallback = path.join(
    parsed.dir,
    `${parsed.name}-${conversationId.slice(0, 8)}${parsed.ext}`,
  );
  usedPaths.add(fallback);
  return fallback;
}

/**
 * Convert a role label into a heading label.
 *
 * @param role Normalised role.
 * @returns Human-readable role label.
 */
function capitaliseRole(role: AuthorRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
