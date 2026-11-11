export interface Note {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string | null;
  pinned: boolean;
}

export const TITLE_MAX = 200;
export const BODY_MAX = 5000;

export class ValidationError extends Error {}

/** Checks untrusted input and returns a clean title and body, or throws ValidationError. */
export function parseNoteInput(input: unknown): { title: string; body: string } {
  if (typeof input !== "object" || input === null)
    throw new ValidationError("body must be a JSON object");
  const { title, body = "" } = input as Record<string, unknown>;
  if (typeof title !== "string" || title.trim() === "")
    throw new ValidationError("title is required");
  if (typeof body !== "string") throw new ValidationError("body must be a string");
  if (title.trim().length > TITLE_MAX)
    throw new ValidationError(`title is longer than ${TITLE_MAX} characters`);
  if (body.length > BODY_MAX)
    throw new ValidationError(`body is longer than ${BODY_MAX} characters`);
  return { title: title.trim(), body };
}

/** Checks a partial edit: at least one of title, body or pinned, with the same limits as creation. */
export function parseNotePatch(input: unknown): {
  title?: string;
  body?: string;
  pinned?: boolean;
} {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new ValidationError("body must be a JSON object");
  const { title, body, pinned } = input as Record<string, unknown>;
  if (title === undefined && body === undefined && pinned === undefined)
    throw new ValidationError("title, body or pinned is required");
  const patch: { title?: string; body?: string; pinned?: boolean } = {};
  if (title !== undefined) {
    if (typeof title !== "string" || title.trim() === "")
      throw new ValidationError("title must be a non-empty string");
    if (title.trim().length > TITLE_MAX)
      throw new ValidationError(`title is longer than ${TITLE_MAX} characters`);
    patch.title = title.trim();
  }
  if (body !== undefined) {
    if (typeof body !== "string") throw new ValidationError("body must be a string");
    if (body.length > BODY_MAX)
      throw new ValidationError(`body is longer than ${BODY_MAX} characters`);
    patch.body = body;
  }
  if (pinned !== undefined) {
    if (typeof pinned !== "boolean") throw new ValidationError("pinned must be a boolean");
    patch.pinned = pinned;
  }
  return patch;
}

export interface NoteSnapshot {
  version: 1;
  nextId: number;
  notes: Note[];
}

export interface NotePersistence {
  initial: NoteSnapshot;
  /** Must durably store the snapshot or throw; called before memory changes. */
  save(snapshot: NoteSnapshot): void;
}

/** Note store; ids are never reused. Without persistence it lives in memory only. */
export class NoteStore {
  #notes = new Map<number, Note>();
  #nextId = 1;
  #now: () => Date;
  #save: ((snapshot: NoteSnapshot) => void) | undefined;

  constructor(now: () => Date = () => new Date(), persistence?: NotePersistence) {
    this.#now = now;
    if (persistence) {
      for (const n of persistence.initial.notes)
        this.#notes.set(n.id, { ...n, pinned: n.pinned ?? false });
      this.#nextId = persistence.initial.nextId;
      this.#save = persistence.save;
    }
  }

  /** A deep copy of the current state, ids ascending. */
  snapshot(): NoteSnapshot {
    return this.#snapshotWith(this.#nextId, [...this.#notes.values()]);
  }

  #snapshotWith(nextId: number, notes: Note[]): NoteSnapshot {
    return { version: 1, nextId, notes: notes.map((n) => ({ ...n })) };
  }

  /** Saves the next state first, so a failed write leaves memory matching the disk. */
  #persist(nextId: number, notes: Note[]): void {
    this.#save?.(this.#snapshotWith(nextId, notes));
  }

  /**
   * Lists pinned notes first, then the rest; each group keeps id order. A non-blank query keeps
   * notes whose title or body contains it, ignoring case.
   */
  list(query?: string): Note[] {
    const all = [...this.#notes.values()];
    const needle = query?.trim().toLowerCase();
    const matches = needle
      ? all.filter(
          (n) => n.title.toLowerCase().includes(needle) || n.body.toLowerCase().includes(needle),
        )
      : all;
    return [...matches.filter((n) => n.pinned), ...matches.filter((n) => !n.pinned)];
  }

  add(input: unknown): Note {
    const { title, body } = parseNoteInput(input);
    const note: Note = {
      id: this.#nextId,
      title,
      body,
      createdAt: this.#now().toISOString(),
      updatedAt: null,
      pinned: false,
    };
    this.#persist(this.#nextId + 1, [...this.#notes.values(), note]);
    this.#notes.set(note.id, note);
    this.#nextId++;
    return note;
  }

  /** Validates before looking the note up, so a bad body is a 400 even for an unknown id. */
  update(id: number, input: unknown): Note | undefined {
    const patch = parseNotePatch(input);
    const note = this.#notes.get(id);
    if (!note) return undefined;
    // Pinning is metadata: only an edit to title or body counts as "edited".
    const edited = patch.title !== undefined || patch.body !== undefined;
    const updated: Note = {
      ...note,
      ...patch,
      updatedAt: edited ? this.#now().toISOString() : note.updatedAt,
    };
    this.#persist(
      this.#nextId,
      [...this.#notes.values()].map((n) => (n.id === id ? updated : n)),
    );
    this.#notes.set(id, updated);
    return updated;
  }

  remove(id: number): boolean {
    if (!this.#notes.has(id)) return false;
    this.#persist(
      this.#nextId,
      [...this.#notes.values()].filter((n) => n.id !== id),
    );
    return this.#notes.delete(id);
  }
}
