import assert from "node:assert/strict";
import { test } from "node:test";
import { BODY_MAX, NoteStore, parseNoteInput, TITLE_MAX, ValidationError } from "../src/notes.ts";

test("add trims the title and assigns increasing ids", () => {
  const store = new NoteStore(() => new Date("2026-10-30T00:00:00Z"));
  const a = store.add({ title: "  first  " });
  const b = store.add({ title: "second", body: "text" });
  assert.deepEqual(a, { id: 1, title: "first", body: "", createdAt: "2026-10-30T00:00:00.000Z" });
  assert.equal(b.id, 2);
  assert.equal(store.list().length, 2);
});

test("ids are not reused after a delete", () => {
  const store = new NoteStore();
  store.add({ title: "a" });
  assert.equal(store.remove(1), true);
  assert.equal(store.add({ title: "b" }).id, 2);
  assert.equal(store.remove(1), false);
});

test("parseNoteInput rejects bad input", () => {
  for (const input of [null, "x", {}, { title: "   " }, { title: 1 }, { title: "a", body: 2 }]) {
    assert.throws(() => parseNoteInput(input), ValidationError);
  }
  assert.throws(() => parseNoteInput({ title: "a".repeat(TITLE_MAX + 1) }), ValidationError);
  assert.throws(
    () => parseNoteInput({ title: "a", body: "a".repeat(BODY_MAX + 1) }),
    ValidationError,
  );
  assert.doesNotThrow(() =>
    parseNoteInput({ title: "a".repeat(TITLE_MAX), body: "a".repeat(BODY_MAX) }),
  );
});
