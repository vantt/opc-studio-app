import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";
import type { NoteSnapshot } from "./notes.ts";

/** Raised when the data file cannot be read or is not a valid snapshot; the message names the path. */
export class StorageError extends Error {}

const isString = (v: unknown): v is string => typeof v === "string";

function checkShape(path: string, data: unknown): NoteSnapshot {
  const fail = (why: string) => new StorageError(`${path}: ${why}`);
  if (typeof data !== "object" || data === null) throw fail("not a JSON object");
  const { version, nextId, notes } = data as Record<string, unknown>;
  if (version !== 1) throw fail("unsupported version");
  if (!Number.isInteger(nextId) || (nextId as number) < 1) throw fail("invalid nextId");
  if (!Array.isArray(notes)) throw fail("notes is not an array");
  const seen = new Set<number>();
  for (const n of notes as Record<string, unknown>[]) {
    if (typeof n !== "object" || n === null) throw fail("invalid note");
    const { id, title, body, createdAt, updatedAt } = n;
    if (!Number.isInteger(id) || (id as number) < 1) throw fail("invalid note id");
    if (seen.has(id as number)) throw fail(`duplicate note id ${id}`);
    if ((id as number) >= (nextId as number)) throw fail(`note id ${id} is not below nextId`);
    seen.add(id as number);
    if (!isString(title) || !isString(body) || !isString(createdAt))
      throw fail(`invalid fields on note ${id}`);
    if (updatedAt !== null && !isString(updatedAt)) throw fail(`invalid updatedAt on note ${id}`);
  }
  return data as NoteSnapshot;
}

/** Reads the snapshot. A missing file means no notes yet; anything unreadable throws and is never overwritten. */
export function loadSnapshot(path: string): NoteSnapshot {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, nextId: 1, notes: [] };
    throw new StorageError(`${path}: cannot read (${(e as Error).message})`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new StorageError(`${path}: invalid JSON`);
  }
  return checkShape(path, data);
}

/** Writes a temp file, fsyncs it and renames it over the target, so a crash never leaves a half-written file. */
export function saveSnapshot(path: string, snapshot: NoteSnapshot): void {
  mkdirSync(dirname(path), { recursive: true });
  const json = JSON.stringify(snapshot, null, 2);
  const tmp = `${path}.tmp`;
  const fd = openSync(tmp, "w");
  try {
    writeSync(fd, json);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
}
