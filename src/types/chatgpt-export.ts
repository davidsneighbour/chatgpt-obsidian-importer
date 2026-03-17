/**
 * Supported author roles after normalisation.
 */
export type AuthorRole = 'user' | 'assistant' | 'system' | 'tool' | 'unknown';

/**
 * CLI configuration for the direct importer.
 */
export interface ImportConfig {
  inputDir: string;
  vaultDir: string;
  outputDir: string;
  indexDir: string;
  verbose: boolean;
  dryRun: boolean;
  force: boolean;
}

/**
 * CLI configuration for the ZIP wrapper.
 */
export interface ImportLatestConfig {
  inboxDir: string;
  workingDir: string;
  archiveDir: string;
  vaultDir: string;
  outputDir: string;
  indexDir: string;
  verbose: boolean;
  dryRun: boolean;
  force: boolean;
}

/**
 * Raw ChatGPT export conversation record.
 */
export interface RawConversation {
  id?: string;
  title?: string;
  create_time?: number | string | null;
  update_time?: number | string | null;
  mapping?: Record<string, RawMappingNode>;
}

/**
 * Raw ChatGPT export mapping node.
 */
export interface RawMappingNode {
  id?: string;
  parent?: string | null;
  children?: string[];
  message?: RawMessage | null;
}

/**
 * Raw ChatGPT export message record.
 */
export interface RawMessage {
  id?: string;
  author?: {
    role?: string;
    name?: string | null;
  } | null;
  create_time?: number | string | null;
  content?: {
    content_type?: string;
    parts?: unknown[];
    text?: string;
  } | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Normalised message used by the importer.
 */
export interface NormalisedMessage {
  id: string;
  role: AuthorRole;
  created: string | null;
  text: string;
}

/**
 * Normalised conversation used by the importer.
 */
export interface NormalisedConversation {
  id: string;
  title: string;
  created: string | null;
  updated: string | null;
  messages: NormalisedMessage[];
}
