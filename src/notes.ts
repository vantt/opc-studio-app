export interface Note {
  id: number;
  title: string;
  body: string;
  createdAt: string;
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

/** In-memory note store; ids are never reused. */
export class NoteStore {
  #notes = new Map<number, Note>();
  #nextId = 1;
  #now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.#now = now;
  }

  list(): Note[] {
    return [...this.#notes.values()];
  }

  add(input: unknown): Note {
    const { title, body } = parseNoteInput(input);
    const note = { id: this.#nextId++, title, body, createdAt: this.#now().toISOString() };
    this.#notes.set(note.id, note);
    return note;
  }

  remove(id: number): boolean {
    return this.#notes.delete(id);
  }
}
