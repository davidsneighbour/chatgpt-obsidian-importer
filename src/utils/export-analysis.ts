import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RawConversation, RawMappingNode, RawMessage } from '../types/chatgpt-export.js';

/**
 * Baseline schema expectations used for local pre-import validation.
 */
export interface ExportSchemaBaseline {
  conversationKeys: string[];
  mappingNodeKeys: string[];
  messageKeys: string[];
  authorKeys: string[];
  contentKeys: string[];
  roles: string[];
  contentTypes: string[];
  contentPartKinds: string[];
}

/**
 * Summary of one export's observed structure.
 */
export interface ExportSummary {
  conversationCount: number;
  messageCount: number;
  conversationKeys: Set<string>;
  mappingNodeKeys: Set<string>;
  messageKeys: Set<string>;
  authorKeys: Set<string>;
  contentKeys: Set<string>;
  contentPartKinds: Set<string>;
  roles: Set<string>;
  contentTypes: Set<string>;
  conversationIds: Set<string>;
  missingTextCount: number;
  earliestConversation: string | null;
  latestConversation: string | null;
}

/**
 * JSON-safe summary shape.
 */
export interface JsonExportSummary {
  conversationCount: number;
  messageCount: number;
  conversationKeys: string[];
  mappingNodeKeys: string[];
  messageKeys: string[];
  authorKeys: string[];
  contentKeys: string[];
  contentPartKinds: string[];
  roles: string[];
  contentTypes: string[];
  conversationIds: string[];
  missingTextCount: number;
  earliestConversation: string | null;
  latestConversation: string | null;
}

/**
 * Diff result between two export summaries.
 */
export interface ExportDiff {
  oldSummary: JsonExportSummary;
  newSummary: JsonExportSummary;
  conversationKeysAdded: string[];
  conversationKeysRemoved: string[];
  mappingNodeKeysAdded: string[];
  mappingNodeKeysRemoved: string[];
  messageKeysAdded: string[];
  messageKeysRemoved: string[];
  authorKeysAdded: string[];
  authorKeysRemoved: string[];
  contentKeysAdded: string[];
  contentKeysRemoved: string[];
  rolesAdded: string[];
  rolesRemoved: string[];
  contentTypesAdded: string[];
  contentTypesRemoved: string[];
  contentPartKindsAdded: string[];
  contentPartKindsRemoved: string[];
  conversationsOnlyInOld: string[];
  conversationsOnlyInNew: string[];
  conversationsInBoth: number;
}

/**
 * Local pre-import validation result.
 */
export interface PreImportCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: JsonExportSummary;
}

/**
 * Read and parse `conversations.json` from an extracted export folder.
 *
 * @param inputDir Folder containing `conversations.json`.
 * @returns Parsed conversation array.
 */
export async function readConversationsFromDirectory(inputDir: string): Promise<RawConversation[]> {
  const conversationsPath = path.join(inputDir, 'conversations.json');
  const rawContent = await readFile(conversationsPath, 'utf8');
  const parsed: unknown = JSON.parse(rawContent);

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected ${conversationsPath} to contain a JSON array`);
  }

  return parsed as RawConversation[];
}

/**
 * Load and validate a JSON baseline file.
 *
 * @param baselineFile Absolute or relative path to the baseline file.
 * @returns Parsed and validated baseline.
 */
export async function readBaselineFile(baselineFile: string): Promise<ExportSchemaBaseline> {
  const rawContent = await readFile(baselineFile, 'utf8');
  const parsed: unknown = JSON.parse(rawContent);

  if (!isExportSchemaBaseline(parsed)) {
    throw new Error(`Invalid baseline file format: ${baselineFile}`);
  }

  return parsed;
}

/**
 * Summarise a ChatGPT export for diagnostics and diffing.
 *
 * @param conversations Parsed export conversations.
 * @returns Structural summary.
 */
export function summariseExport(conversations: RawConversation[]): ExportSummary {
  const summary: ExportSummary = {
    conversationCount: 0,
    messageCount: 0,
    conversationKeys: new Set<string>(),
    mappingNodeKeys: new Set<string>(),
    messageKeys: new Set<string>(),
    authorKeys: new Set<string>(),
    contentKeys: new Set<string>(),
    contentPartKinds: new Set<string>(),
    roles: new Set<string>(),
    contentTypes: new Set<string>(),
    conversationIds: new Set<string>(),
    missingTextCount: 0,
    earliestConversation: null,
    latestConversation: null,
  };

  for (const conversation of conversations) {
    summary.conversationCount += 1;

    for (const key of Object.keys(conversation)) {
      summary.conversationKeys.add(key);
    }

    if (typeof conversation.id === 'string' && conversation.id.length > 0) {
      summary.conversationIds.add(conversation.id);
    }

    const created = normaliseTimestampToIso(conversation.create_time);
    const updated = normaliseTimestampToIso(conversation.update_time);

    summary.earliestConversation = pickEarlier(summary.earliestConversation, created, updated);
    summary.latestConversation = pickLater(summary.latestConversation, created, updated);

    const mapping = conversation.mapping ?? {};

    for (const node of Object.values(mapping)) {
      summariseMappingNode(summary, node);
    }
  }

  return summary;
}

/**
 * Convert an export summary to a JSON-safe object.
 *
 * @param summary Structural summary.
 * @returns JSON-safe summary.
 */
export function toJsonExportSummary(summary: ExportSummary): JsonExportSummary {
  return {
    conversationCount: summary.conversationCount,
    messageCount: summary.messageCount,
    conversationKeys: sortSet(summary.conversationKeys),
    mappingNodeKeys: sortSet(summary.mappingNodeKeys),
    messageKeys: sortSet(summary.messageKeys),
    authorKeys: sortSet(summary.authorKeys),
    contentKeys: sortSet(summary.contentKeys),
    contentPartKinds: sortSet(summary.contentPartKinds),
    roles: sortSet(summary.roles),
    contentTypes: sortSet(summary.contentTypes),
    conversationIds: sortSet(summary.conversationIds),
    missingTextCount: summary.missingTextCount,
    earliestConversation: summary.earliestConversation,
    latestConversation: summary.latestConversation,
  };
}

/**
 * Compare two summaries and return a machine-readable diff.
 *
 * @param oldSummary Baseline or older summary.
 * @param newSummary Newer summary.
 * @returns Structured diff.
 */
export function diffExportSummaries(oldSummary: ExportSummary, newSummary: ExportSummary): ExportDiff {
  return {
    oldSummary: toJsonExportSummary(oldSummary),
    newSummary: toJsonExportSummary(newSummary),
    conversationKeysAdded: difference(newSummary.conversationKeys, oldSummary.conversationKeys),
    conversationKeysRemoved: difference(oldSummary.conversationKeys, newSummary.conversationKeys),
    mappingNodeKeysAdded: difference(newSummary.mappingNodeKeys, oldSummary.mappingNodeKeys),
    mappingNodeKeysRemoved: difference(oldSummary.mappingNodeKeys, newSummary.mappingNodeKeys),
    messageKeysAdded: difference(newSummary.messageKeys, oldSummary.messageKeys),
    messageKeysRemoved: difference(oldSummary.messageKeys, newSummary.messageKeys),
    authorKeysAdded: difference(newSummary.authorKeys, oldSummary.authorKeys),
    authorKeysRemoved: difference(oldSummary.authorKeys, newSummary.authorKeys),
    contentKeysAdded: difference(newSummary.contentKeys, oldSummary.contentKeys),
    contentKeysRemoved: difference(oldSummary.contentKeys, newSummary.contentKeys),
    rolesAdded: difference(newSummary.roles, oldSummary.roles),
    rolesRemoved: difference(oldSummary.roles, newSummary.roles),
    contentTypesAdded: difference(newSummary.contentTypes, oldSummary.contentTypes),
    contentTypesRemoved: difference(oldSummary.contentTypes, newSummary.contentTypes),
    contentPartKindsAdded: difference(newSummary.contentPartKinds, oldSummary.contentPartKinds),
    contentPartKindsRemoved: difference(oldSummary.contentPartKinds, newSummary.contentPartKinds),
    conversationsOnlyInOld: difference(oldSummary.conversationIds, newSummary.conversationIds),
    conversationsOnlyInNew: difference(newSummary.conversationIds, oldSummary.conversationIds),
    conversationsInBoth: intersectionSize(oldSummary.conversationIds, newSummary.conversationIds),
  };
}

/**
 * Validate a summary against a local baseline.
 *
 * @param summary Observed export summary.
 * @param baseline Allowed baseline values.
 * @param allowNewConversationIds Whether to ignore newly seen conversation IDs.
 * @returns Validation result.
 */
export function runPreImportCheck(
  summary: ExportSummary,
  baseline: ExportSchemaBaseline,
  allowNewConversationIds = true,
): PreImportCheckResult {
  const jsonSummary = toJsonExportSummary(summary);
  const errors: string[] = [];
  const warnings: string[] = [];

  pushUnexpected(errors, 'Conversation keys', jsonSummary.conversationKeys, baseline.conversationKeys);
  pushUnexpected(errors, 'Mapping node keys', jsonSummary.mappingNodeKeys, baseline.mappingNodeKeys);
  pushUnexpected(errors, 'Message keys', jsonSummary.messageKeys, baseline.messageKeys);
  pushUnexpected(errors, 'Author keys', jsonSummary.authorKeys, baseline.authorKeys);
  pushUnexpected(errors, 'Content keys', jsonSummary.contentKeys, baseline.contentKeys);
  pushUnexpected(errors, 'Roles', jsonSummary.roles, baseline.roles);
  pushUnexpected(errors, 'Content types', jsonSummary.contentTypes, baseline.contentTypes);
  pushUnexpected(errors, 'Content part shapes', jsonSummary.contentPartKinds, baseline.contentPartKinds);

  if (jsonSummary.missingTextCount > 0) {
    warnings.push(`Messages without text content detected: ${String(jsonSummary.missingTextCount)}`);
  }

  if (!allowNewConversationIds && jsonSummary.conversationIds.length > 0) {
    warnings.push('Conversation ID strictness is enabled, but ID comparison is not implemented in baseline mode.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: jsonSummary,
  };
}

/**
 * Describe one content-part shape.
 *
 * @param part Raw content part.
 * @returns Human-readable shape descriptor.
 */
export function describePart(part: unknown): string {
  if (typeof part === 'string') {
    return 'string';
  }

  if (part === null) {
    return 'null';
  }

  if (Array.isArray(part)) {
    return 'array';
  }

  if (typeof part === 'object') {
    const objectKeys = Object.keys(part as Record<string, unknown>).sort();
    return `object{${objectKeys.join(',')}}`;
  }

  return typeof part;
}

/**
 * Build a baseline object from a summary.
 *
 * @param summary Summary to convert.
 * @returns Baseline JSON payload.
 */
export function buildBaselineFromSummary(summary: ExportSummary): ExportSchemaBaseline {
  const jsonSummary = toJsonExportSummary(summary);

  return {
    conversationKeys: jsonSummary.conversationKeys,
    mappingNodeKeys: jsonSummary.mappingNodeKeys,
    messageKeys: jsonSummary.messageKeys,
    authorKeys: jsonSummary.authorKeys,
    contentKeys: jsonSummary.contentKeys,
    roles: jsonSummary.roles,
    contentTypes: jsonSummary.contentTypes,
    contentPartKinds: jsonSummary.contentPartKinds,
  };
}

/**
 * Check whether an unknown JSON value matches the expected baseline shape.
 *
 * @param value Unknown parsed JSON value.
 * @returns Whether the value is a valid baseline.
 */
function isExportSchemaBaseline(value: unknown): value is ExportSchemaBaseline {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ExportSchemaBaseline>;

  return (
    isStringArray(candidate.conversationKeys) &&
    isStringArray(candidate.mappingNodeKeys) &&
    isStringArray(candidate.messageKeys) &&
    isStringArray(candidate.authorKeys) &&
    isStringArray(candidate.contentKeys) &&
    isStringArray(candidate.roles) &&
    isStringArray(candidate.contentTypes) &&
    isStringArray(candidate.contentPartKinds)
  );
}

/**
 * Determine whether a value is a string array.
 *
 * @param value Unknown value.
 * @returns Type guard result.
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * Summarise one mapping node.
 *
 * @param summary Mutable export summary.
 * @param node Raw mapping node.
 */
function summariseMappingNode(summary: ExportSummary, node: RawMappingNode): void {
  for (const key of Object.keys(node)) {
    summary.mappingNodeKeys.add(key);
  }

  const message = node.message;
  if (!message) {
    return;
  }

  summary.messageCount += 1;
  summariseMessage(summary, message);
}

/**
 * Summarise one message.
 *
 * @param summary Mutable export summary.
 * @param message Raw message.
 */
function summariseMessage(summary: ExportSummary, message: RawMessage): void {
  for (const key of Object.keys(message)) {
    summary.messageKeys.add(key);
  }

  if (message.author && typeof message.author === 'object') {
    for (const key of Object.keys(message.author)) {
      summary.authorKeys.add(key);
    }

    summary.roles.add(typeof message.author.role === 'string' ? message.author.role : 'unknown');
  } else {
    summary.roles.add('unknown');
  }

  if (message.content && typeof message.content === 'object') {
    for (const key of Object.keys(message.content)) {
      summary.contentKeys.add(key);
    }

    summary.contentTypes.add(
      typeof message.content.content_type === 'string' ? message.content.content_type : 'unknown',
    );

    const parts = message.content.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        summary.contentPartKinds.add(describePart(part));
      }
    } else {
      summary.missingTextCount += 1;
    }
  } else {
    summary.contentTypes.add('unknown');
    summary.missingTextCount += 1;
  }
}

/**
 * Return sorted values from a set.
 *
 * @param values Input set.
 * @returns Sorted array.
 */
function sortSet(values: Set<string>): string[] {
  return [...values].sort();
}

/**
 * Return values present in target but not in base.
 *
 * @param target Target set.
 * @param base Base set.
 * @returns Sorted difference values.
 */
function difference(target: Set<string>, base: Set<string>): string[] {
  return [...target].filter((value) => !base.has(value)).sort();
}

/**
 * Count how many values exist in both sets.
 *
 * @param left Left set.
 * @param right Right set.
 * @returns Intersection size.
 */
function intersectionSize(left: Set<string>, right: Set<string>): number {
  return [...left].filter((value) => right.has(value)).length;
}

/**
 * Convert mixed timestamp input to an ISO string.
 *
 * @param value Raw timestamp value.
 * @returns ISO string or `null`.
 */
function normaliseTimestampToIso(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return normaliseTimestampToIso(numeric);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Pick the earliest non-null value from the current and candidate timestamps.
 *
 * @param current Current earliest ISO string.
 * @param candidates Candidate ISO strings.
 * @returns Earliest ISO string.
 */
function pickEarlier(current: string | null, ...candidates: Array<string | null>): string | null {
  const definedCandidates = candidates.filter((value): value is string => value !== null);
  const sorted = [current, ...definedCandidates].filter((value): value is string => value !== null).sort();
  return sorted[0] ?? null;
}

/**
 * Pick the latest non-null value from the current and candidate timestamps.
 *
 * @param current Current latest ISO string.
 * @param candidates Candidate ISO strings.
 * @returns Latest ISO string.
 */
function pickLater(current: string | null, ...candidates: Array<string | null>): string | null {
  const definedCandidates = candidates.filter((value): value is string => value !== null);
  const sorted = [current, ...definedCandidates].filter((value): value is string => value !== null).sort();
  return sorted.at(-1) ?? null;
}

/**
 * Add unexpected values to an error array.
 *
 * @param target Error target array.
 * @param label Human-readable category label.
 * @param observed Observed values.
 * @param allowed Allowed baseline values.
 */
function pushUnexpected(
  target: string[],
  label: string,
  observed: string[],
  allowed: string[],
): void {
  const unexpected = observed.filter((value) => !allowed.includes(value));

  if (unexpected.length > 0) {
    target.push(`${label} added: ${unexpected.join(', ')}`);
  }
}
