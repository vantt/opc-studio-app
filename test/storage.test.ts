import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { type NotePersistence, NoteStore } from "../src/notes.ts";
import { loadSnapshot, StorageError, saveSnapshot } from "../src/storage.ts";

const tempFile = () => join(mkdtempSync(join(tmpdir(), "notes-")), "sub", "notes.json");
const at = () => new Date("2026-10-30T00:00:00Z");

function openStore(path: string, now = at): NoteStore {
  const persistence: NotePersistence = {
    initial: loadSnapshot(path),
    save: (s) => saveSnapshot(path, s),
  };
  return new NoteStore(now, persistence);
}

test("a restart keeps id, title, body, createdAt and updatedAt", () => {
  const path = tempFile();
  const a = openStore(path);
  a.add({ title: "one", body: "text" });
  a.add({ title: "two" });
  a.update(1, { body: "edited" });
  const before = a.list();

  const b = openStore(path);
  assert.deepEqual(b.list(), before);
  assert.equal(b.list()[0]?.updatedAt, "2026-10-30T00:00:00.000Z");
});

test("deleting the largest id then restarting does not reuse it", () => {
  const path = tempFile();
  const a = openStore(path);
  a.add({ title: "one" });
  a.add({ title: "two" });
  assert.equal(a.remove(2), true);

  const b = openStore(path);
  assert.equal(b.add({ title: "three" }).id, 3);
});

test("edit and delete survive a restart", () => {
  const path = tempFile();
  const a = openStore(path);
  a.add({ title: "one" });
  a.add({ title: "two" });
  a.update(2, { title: "renamed" });
  a.remove(1);
  assert.deepEqual(
    openStore(path)
      .list()
      .map((n) => n.title),
    ["renamed"],
  );
});

test("search still works on loaded notes", () => {
  const path = tempFile();
  const a = openStore(path);
  a.add({ title: "Milk" });
  a.add({ title: "Eggs" });
  assert.deepEqual(
    openStore(path)
      .list("MILK")
      .map((n) => n.title),
    ["Milk"],
  );
});

test("a missing file loads as an empty snapshot and is not created", () => {
  const path = tempFile();
  assert.deepEqual(loadSnapshot(path), { version: 1, nextId: 1, notes: [] });
  assert.equal(existsSync(path), false);
});

for (const [name, content] of [
  ["invalid JSON", "{not json"],
  ["wrong version", JSON.stringify({ version: 2, nextId: 1, notes: [] })],
  ["non-integer nextId", JSON.stringify({ version: 1, nextId: 1.5, notes: [] })],
  ["notes not an array", JSON.stringify({ version: 1, nextId: 1, notes: {} })],
  [
    "duplicate ids",
    JSON.stringify({
      version: 1,
      nextId: 3,
      notes: [
        { id: 1, title: "a", body: "", createdAt: "x", updatedAt: null },
        { id: 1, title: "b", body: "", createdAt: "x", updatedAt: null },
      ],
    }),
  ],
  [
    "id not below nextId",
    JSON.stringify({
      version: 1,
      nextId: 1,
      notes: [{ id: 1, title: "a", body: "", createdAt: "x", updatedAt: null }],
    }),
  ],
  [
    "bad field type",
    JSON.stringify({
      version: 1,
      nextId: 2,
      notes: [{ id: 1, title: 5, body: "", createdAt: "x", updatedAt: null }],
    }),
  ],
] as const) {
  test(`a corrupt file (${name}) throws StorageError naming the path and stays untouched`, () => {
    const path = tempFile();
    saveSnapshot(path, { version: 1, nextId: 1, notes: [] });
    writeFileSync(path, content);
    assert.throws(
      () => loadSnapshot(path),
      (e) => e instanceof StorageError && e.message.includes(path),
    );
    assert.equal(readFileSync(path, "utf8"), content);
  });
}

test("when save throws, the store reports the error and memory is unchanged", () => {
  const initial = { version: 1 as const, nextId: 1, notes: [] };
  let failing = false;
  const store = new NoteStore(at, {
    initial,
    save: () => {
      if (failing) throw new Error("disk full");
    },
  });
  store.add({ title: "kept" });
  failing = true;
  assert.throws(() => store.add({ title: "lost" }), /disk full/);
  assert.throws(() => store.update(1, { title: "changed" }), /disk full/);
  assert.throws(() => store.remove(1), /disk full/);
  assert.deepEqual(
    store.list().map((n) => [n.id, n.title, n.updatedAt]),
    [[1, "kept", null]],
  );
  failing = false;
  assert.equal(store.add({ title: "next" }).id, 2);
});

test("removing an unknown id does not write", () => {
  let saves = 0;
  const store = new NoteStore(at, {
    initial: { version: 1, nextId: 1, notes: [] },
    save: () => {
      saves++;
    },
  });
  assert.equal(store.remove(9), false);
  assert.equal(saves, 0);
});

test("a validation error does not write", () => {
  let saves = 0;
  const store = new NoteStore(at, {
    initial: { version: 1, nextId: 1, notes: [] },
    save: () => {
      saves++;
    },
  });
  assert.throws(() => store.add({ title: "" }));
  assert.throws(() => store.update(1, {}));
  assert.equal(saves, 0);
});

test("a note returned by update is not shared with the stored one after a failed save", () => {
  const store = new NoteStore(at, {
    initial: { version: 1, nextId: 1, notes: [] },
    save: () => {},
  });
  const added = store.add({ title: "a" });
  const updated = store.update(1, { title: "b" });
  assert.equal(added.title, "a");
  assert.equal(updated?.title, "b");
});

test("snapshot is a deep copy", () => {
  const store = new NoteStore(at);
  store.add({ title: "a" });
  const snap = store.snapshot();
  assert.equal(snap.nextId, 2);
  const first = snap.notes[0];
  assert.ok(first);
  first.title = "mutated";
  assert.equal(store.list()[0]?.title, "a");
});

test("saveSnapshot creates the directory and leaves no .tmp file", () => {
  const path = tempFile();
  saveSnapshot(path, { version: 1, nextId: 1, notes: [] });
  assert.equal(existsSync(path), true);
  assert.deepEqual(
    readdirSync(join(path, "..")).filter((f) => f.endsWith(".tmp")),
    [],
  );
});

test("a failed saveSnapshot keeps the previous file intact", () => {
  const path = tempFile();
  saveSnapshot(path, { version: 1, nextId: 1, notes: [] });
  const before = readFileSync(path, "utf8");
  const circular = { version: 1 as const, nextId: 2, notes: [] as never[] };
  (circular as Record<string, unknown>).self = circular;
  assert.throws(() => saveSnapshot(path, circular));
  assert.equal(readFileSync(path, "utf8"), before);
});

test("pinned survives a restart (AC 7)", () => {
  const path = tempFile();
  const a = openStore(path);
  a.add({ title: "one" });
  a.update(1, { pinned: true });
  assert.equal(openStore(path).list()[0]?.pinned, true);
});

test("a failed save leaves pinned unchanged (AC 7)", () => {
  let failing = false;
  const store = new NoteStore(at, {
    initial: { version: 1, nextId: 1, notes: [] },
    save: () => {
      if (failing) throw new Error("disk full");
    },
  });
  store.add({ title: "a" });
  failing = true;
  assert.throws(() => store.update(1, { pinned: true }), /disk full/);
  assert.equal(store.list()[0]?.pinned, false);
});

test("an old file without pinned loads as unpinned and is not rewritten (AC 8)", () => {
  const path = tempFile();
  saveSnapshot(path, { version: 1, nextId: 1, notes: [] });
  const content = JSON.stringify({
    version: 1,
    nextId: 2,
    notes: [{ id: 1, title: "a", body: "", createdAt: "x", updatedAt: null }],
  });
  writeFileSync(path, content);
  assert.equal(loadSnapshot(path).notes[0]?.pinned, false);
  assert.equal(openStore(path).list()[0]?.pinned, false);
  assert.equal(readFileSync(path, "utf8"), content);
});

test("a non-boolean pinned in the file throws StorageError naming path and id (AC 9)", () => {
  const path = tempFile();
  saveSnapshot(path, { version: 1, nextId: 1, notes: [] });
  const content = JSON.stringify({
    version: 1,
    nextId: 8,
    notes: [{ id: 7, title: "a", body: "", createdAt: "x", updatedAt: null, pinned: "yes" }],
  });
  writeFileSync(path, content);
  assert.throws(
    () => loadSnapshot(path),
    (e) => e instanceof StorageError && e.message.includes(path) && e.message.includes("7"),
  );
  assert.equal(readFileSync(path, "utf8"), content);
});
