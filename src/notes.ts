export interface Note {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string | null;
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

/** Checks a partial edit: at least one of title or body, with the same limits as creation. */
export function parseNotePatch(input: unknown): { title?: string; body?: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new ValidationError("body must be a JSON object");
  const { title, body } = input as Record<string, unknown>;
  if (title === undefined && body === undefined)
    throw new ValidationError("title or body is required");
  const patch: { title?: string; body?: string } = {};
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
  return patch;
}

/** In-memory note store; ids are never reused. */
export class NoteStore {
  #notes = new Map<number, Note>();
  #nextId = 1;
  #now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.#now = now;
  }

  /** Lists notes by id; a non-blank query keeps notes whose title or body contains it, ignoring case. */
  list(query?: string): Note[] {
    const all = [...this.#notes.values()];
    const needle = query?.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (n) => n.title.toLowerCase().includes(needle) || n.body.toLowerCase().includes(needle),
    );
  }

  add(input: unknown): Note {
    const { title, body } = parseNoteInput(input);
    const note: Note = {
      id: this.#nextId++,
      title,
      body,
      createdAt: this.#now().toISOString(),
      updatedAt: null,
    };
    this.#notes.set(note.id, note);
    return note;
  }

  /** Validates before looking the note up, so a bad body is a 400 even for an unknown id. */
  update(id: number, input: unknown): Note | undefined {
    const patch = parseNotePatch(input);
    const note = this.#notes.get(id);
    if (!note) return undefined;
    Object.assign(note, patch, { updatedAt: this.#now().toISOString() });
    return note;
  }

  remove(id: number): boolean {
    return this.#notes.delete(id);
  }
}
