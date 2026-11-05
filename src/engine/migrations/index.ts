// Schema migrations of the stored log: pure functions, each from version n to n + 1. A copy of
// the data before any migration is returned as `backup`; the storage layer keeps it as
// 'backup_before_migration' (docs/SPEC.md 2 and 9, S-DATA-04).
import { SCHEMA_VERSION } from '../data.ts';
import { findStep, getTrack, trackIdOf } from '../lookup.ts';
import type { Program } from '../types.ts';

export interface StoredLog {
  schemaVersion: number;
  events: unknown[];
}

export interface Migration {
  from: number;
  to: number;
  migrate: (events: unknown[]) => unknown[];
}

/** Version 1 is the current schema; no migrations exist yet. */
export const MIGRATIONS: Migration[] = [];

export interface MigrationResult {
  log: StoredLog;
  /** Deep copy of the data before the first migration, or null when nothing ran. */
  backup: StoredLog | null;
  applied: number[];
}

export function migrate(
  log: StoredLog,
  migrations: readonly Migration[] = MIGRATIONS,
  target = SCHEMA_VERSION,
): MigrationResult {
  if (log.schemaVersion > target) {
    throw new Error(`Data has schema ${log.schemaVersion}, newer than ${target}`);
  }
  if (log.schemaVersion === target) return { log, backup: null, applied: [] };
  const backup: StoredLog = structuredClone(log);
  let current: StoredLog = structuredClone(log);
  const applied: number[] = [];
  while (current.schemaVersion < target) {
    const step = migrations.find((m) => m.from === current.schemaVersion);
    if (!step) throw new Error(`No migration from schema ${current.schemaVersion}`);
    current = { schemaVersion: step.to, events: step.migrate(current.events) };
    applied.push(step.to);
  }
  return { log: current, backup, applied };
}

/**
 * A step id from an older programme version: kept when it still exists (also after a rename),
 * otherwise mapped through `program.migrations` to the nearest lower step (S-DATA-05).
 */
export function currentStepId(program: Program, stepId: string): string {
  if (findStep(program, stepId)) return stepId;
  const mapped = program.migrations[stepId];
  if (mapped && findStep(program, mapped)) return mapped;
  return getTrack(program, trackIdOf(stepId)).steps[0]?.id ?? stepId;
}
