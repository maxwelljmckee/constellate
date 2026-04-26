export const SHARED_PACKAGE_NAME = '@audri/shared';

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type AgentId = Brand<string, 'AgentId'>;
export type WikiPageId = Brand<string, 'WikiPageId'>;
export type WikiSectionId = Brand<string, 'WikiSectionId'>;
export type CallTranscriptId = Brand<string, 'CallTranscriptId'>;
export type AgentTaskId = Brand<string, 'AgentTaskId'>;
