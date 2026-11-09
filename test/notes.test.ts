import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BODY_MAX,
  NoteStore,
  parseNoteInput,
  parseNotePatch,
  TITLE_MAX,
  ValidationError,
} from "../src/notes.ts";

test("add trims the title and assigns increasing ids", () => {
  const store = new NoteStore(() => new Date("2026-10-30T00:00:00Z"));
  const a = store.add({ title: "  first  " });
  const b = store.add({ title: "second", body: "text" });
  assert.deepEqual(a, {
    id: 1,
    title: "first",
    body: "",
    createdAt: "2026-10-30T00:00:00.000Z",
    updatedAt: null,
    pinned: false,
  });
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

test("list filters by keyword in title or body, ignoring case and surrounding spaces", () => {
  const store = new NoteStore();
  store.add({ title: "Shopping", body: "milk" });
  store.add({ title: "Work", body: "Call the SHOP" });
  store.add({ title: "Other", body: "nothing" });
  assert.deepEqual(
    store.list("shop").map((n) => n.id),
    [1, 2],
  );
  assert.deepEqual(
    store.list("  MILK ").map((n) => n.id),
    [1],
  );
  assert.deepEqual(store.list("absent"), []);
});

test("list without a usable query returns everything", () => {
  const store = new NoteStore();
  store.add({ title: "a" });
  store.add({ title: "b" });
  for (const q of [undefined, "", "   "]) assert.equal(store.list(q).length, 2);
});

test("list treats special characters as plain text", () => {
  const store = new NoteStore();
  store.add({ title: "100% sure", body: "a.b" });
  store.add({ title: "axb" });
  assert.deepEqual(
    store.list("a.b").map((n) => n.id),
    [1],
  );
  assert.deepEqual(
    store.list(".*").map((n) => n.id),
    [],
  );
  assert.deepEqual(
    store.list("%").map((n) => n.id),
    [1],
  );
});

test("update changes title, body or both and keeps the rest (AC 1, 2)", () => {
  const store = new NoteStore();
  store.add({ title: "a", body: "b" });
  assert.deepEqual(
    [store.update(1, { title: "  new  " })?.title, store.update(1, { title: "new" })?.body],
    ["new", "b"],
  );
  const bodyOnly = store.update(1, { body: "c" });
  assert.deepEqual([bodyOnly?.title, bodyOnly?.body], ["new", "c"]);
  const both = store.update(1, { title: "t", body: "" });
  assert.deepEqual([both?.title, both?.body], ["t", ""]);
});

test("parseNotePatch enforces the creation limits and needs a field (AC 3, 4)", () => {
  const bad = [
    null,
    "x",
    [],
    {},
    { title: "   " },
    { title: 1 },
    { body: 2 },
    { title: "a".repeat(TITLE_MAX + 1) },
    { body: "a".repeat(BODY_MAX + 1) },
  ];
  for (const input of bad) assert.throws(() => parseNotePatch(input), ValidationError);
  assert.deepEqual(parseNotePatch({ title: " t " }), { title: "t" });
  assert.deepEqual(parseNotePatch({ body: "" }), { body: "" });
  assert.doesNotThrow(() =>
    parseNotePatch({ title: "a".repeat(TITLE_MAX), body: "a".repeat(BODY_MAX) }),
  );
});

test("a rejected update leaves the note untouched (AC 3, 6)", () => {
  const store = new NoteStore();
  const before = { ...store.add({ title: "a", body: "b" }) };
  assert.throws(() => store.update(1, { title: "" }), ValidationError);
  assert.deepEqual(store.list()[0], before);
});

test("update on a missing or removed id returns undefined, after validating (AC 5)", () => {
  const store = new NoteStore();
  assert.equal(store.update(9, { title: "x" }), undefined);
  store.add({ title: "a" });
  store.remove(1);
  assert.equal(store.update(1, { title: "x" }), undefined);
  assert.throws(() => store.update(1, {}), ValidationError);
});

test("update stamps updatedAt and keeps id and createdAt (AC 6)", () => {
  let now = new Date("2026-10-30T00:00:00Z");
  const store = new NoteStore(() => now);
  const created = store.add({ title: "a" });
  assert.equal(created.updatedAt, null);
  now = new Date("2026-10-31T00:00:00Z");
  const updated = store.update(1, { title: "b" });
  assert.equal(updated?.updatedAt, "2026-10-31T00:00:00.000Z");
  assert.equal(updated?.createdAt, "2026-10-30T00:00:00.000Z");
  assert.equal(updated?.id, 1);
});

test("search sees edited text (AC 7)", () => {
  const store = new NoteStore();
  store.add({ title: "old", body: "old" });
  store.update(1, { title: "fresh", body: "text" });
  assert.deepEqual(store.list("fresh").length, 1);
  assert.deepEqual(store.list("old"), []);
});

test("new notes are unpinned (AC 1, D2)", () => {
  const store = new NoteStore();
  assert.equal(store.add({ title: "a" }).pinned, false);
  assert.equal(store.add({ title: "b", pinned: true }).pinned, false);
  assert.equal(store.list("a")[0]?.pinned, false);
});

test("pin and unpin keep updatedAt, title and body (AC 2, 3, 11)", () => {
  let now = new Date("2026-10-30T00:00:00Z");
  const store = new NoteStore(() => now);
  store.add({ title: "a", body: "b" });
  now = new Date("2026-10-31T00:00:00Z");
  const pinned = store.update(1, { pinned: true });
  assert.deepEqual([pinned?.pinned, pinned?.updatedAt, pinned?.title], [true, null, "a"]);
  assert.equal(store.list()[0]?.pinned, true);
  assert.equal(store.update(1, { pinned: false })?.pinned, false);
  const both = store.update(1, { title: "c", pinned: true });
  assert.deepEqual([both?.title, both?.pinned], ["c", true]);
  assert.equal(both?.updatedAt, "2026-10-31T00:00:00.000Z");
  assert.equal(store.update(1, { body: "z" })?.pinned, true);
});

test("parseNotePatch rejects a non-boolean pinned and an empty patch (AC 4, 5)", () => {
  for (const pinned of ["yes", 1, null, 0, {}]) {
    assert.throws(() => parseNotePatch({ pinned }), /pinned must be a boolean/);
    assert.throws(() => parseNotePatch({ title: "a", pinned }), ValidationError);
  }
  assert.throws(() => parseNotePatch({}), /title, body or pinned is required/);
  assert.deepEqual(parseNotePatch({ pinned: false }), { pinned: false });
});

test("pinning does not reorder the list (AC 10)", () => {
  const store = new NoteStore();
  for (const t of ["a", "b", "c"]) store.add({ title: t });
  store.update(3, { pinned: true });
  assert.deepEqual(
    store.list().map((n) => n.id),
    [1, 2, 3],
  );
});

test("a snapshot note without pinned loads as unpinned (AC 8)", () => {
  const old = { id: 1, title: "a", body: "", createdAt: "x", updatedAt: null };
  const store = new NoteStore(undefined, {
    initial: { version: 1, nextId: 2, notes: [old as never] },
    save: () => {},
  });
  assert.equal(store.list()[0]?.pinned, false);
});
