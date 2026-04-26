// Re-exports of Drizzle row types from the server's schema modules.
// Consumers (mobile, server, worker) import row shapes from here so the
// schema stays a single source of truth.
//
// The schema files live in apps/server/src/db/schema/ — that's intentional:
// they own the migration history. This package only re-types them.
//
// Import path uses `workspace:*` against @audri/server's published surface.
// Currently apps/server doesn't ship types externally; we re-declare the
// row shapes here as a thin layer until that pattern matures.

// For MVP we expose the minimum row shapes needed for cross-app type sharing.
// Add more as cross-package consumers actually need them.

export type Uuid = string;
export type IsoDatetime = string;

// Enum unions mirroring the pgEnum value sets in apps/server/src/db/schema/enums.ts
export type WikiScope = 'user' | 'agent';

export type PageType =
  | 'person'
  | 'concept'
  | 'project'
  | 'place'
  | 'org'
  | 'source'
  | 'event'
  | 'note'
  | 'profile'
  | 'todo'
  | 'agent';

export type EditedBy = 'ai' | 'user' | 'lint' | 'task';

export type AgentTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type AgentTaskKind = 'research';

export type WikiLogKind = 'ingest' | 'agent_scope_ingest' | 'query' | 'lint' | 'task';

export type UsageEventKind =
  | 'call_live'
  | 'ingestion_prefilter'
  | 'ingestion'
  | 'agent_scope_ingestion'
  | 'plugin_research'
  | 'tool_search_wiki'
  | 'tool_fetch_page';

export type ArtifactKind = 'research';

export type CallType = 'generic' | 'onboarding';

export type EndReason =
  | 'user_ended'
  | 'silence_timeout'
  | 'network_drop'
  | 'app_backgrounded'
  | 'cancelled';
