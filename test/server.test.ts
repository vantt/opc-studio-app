import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { NoteStore } from "../src/notes.ts";
import { createApp } from "../src/server.ts";

const app = createApp(new NoteStore());
let base = "";

before(async () => {
  await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
});
after(() => app.close());

const post = (body: string) =>
  fetch(`${base}/api/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

test("serves the page and health check", async () => {
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<title>OPC Notes<\/title>/);
  assert.deepEqual(await (await fetch(`${base}/healthz`)).json(), { status: "ok" });
});

test("create, list and delete a note", async () => {
  const created = await post(JSON.stringify({ title: "hello", body: "world" }));
  assert.equal(created.status, 201);
  const note = await created.json();
  assert.deepEqual(
    (await (await fetch(`${base}/api/notes`)).json()).map((n: { id: number }) => n.id),
    [note.id],
  );
  assert.equal((await fetch(`${base}/api/notes/${note.id}`, { method: "DELETE" })).status, 204);
  assert.equal((await fetch(`${base}/api/notes/${note.id}`, { method: "DELETE" })).status, 404);
});

test("rejects invalid JSON, invalid notes, oversized bodies and unknown routes", async () => {
  assert.equal((await post("{")).status, 400);
  assert.deepEqual(await (await post("{}")).json(), { error: "title is required" });
  assert.equal((await post(JSON.stringify({ title: "a", body: "x".repeat(20_000) }))).status, 413);
  assert.equal((await fetch(`${base}/nope`)).status, 404);
  assert.equal((await fetch(`${base}/api/notes`, { method: "PUT" })).status, 405);
});

test("GET /api/notes?q= filters notes and ignores an empty q", async () => {
  const own = createApp(new NoteStore());
  await new Promise<void>((resolve) => own.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(own.address() as AddressInfo).port}/api/notes`;
  const add = (title: string, body: string) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
  try {
    await add("Groceries", "Milk and eggs");
    await add("Work", "ship it");
    const ids = async (qs: string) =>
      (await (await fetch(`${url}${qs}`)).json()).map((n: { id: number }) => n.id);
    assert.deepEqual(await ids("?q=GROCER"), [1]);
    assert.deepEqual(await ids("?q=ship"), [2]);
    assert.deepEqual(await ids("?q=zzz"), []);
    assert.deepEqual(await ids(""), [1, 2]);
    assert.deepEqual(await ids("?q="), [1, 2]);
    assert.deepEqual(await ids("?q=%20%20"), [1, 2]);
    assert.deepEqual(await ids("?q=%25"), []);
  } finally {
    own.close();
  }
});

test("PATCH /api/notes/:id edits a note (AC 1-7)", async () => {
  const own = createApp(new NoteStore());
  await new Promise<void>((resolve) => own.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(own.address() as AddressInfo).port}/api/notes`;
  const send = (method: string, path: string, body: string) =>
    fetch(`${url}${path}`, { method, headers: { "content-type": "application/json" }, body });
  try {
    const created = await (
      await send("POST", "", JSON.stringify({ title: "a", body: "b" }))
    ).json();
    assert.equal(created.updatedAt, null);

    const titleRes = await send("PATCH", "/1", JSON.stringify({ title: "  new " }));
    assert.equal(titleRes.status, 200);
    const edited = await titleRes.json();
    assert.deepEqual([edited.title, edited.body, edited.id], ["new", "b", 1]);
    assert.equal(edited.createdAt, created.createdAt);
    assert.match(edited.updatedAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);

    const both = await (await send("PATCH", "/1", JSON.stringify({ title: "t", body: "" }))).json();
    assert.deepEqual([both.title, both.body], ["t", ""]);
    const bodyOnly = await (await send("PATCH", "/1", JSON.stringify({ body: "z" }))).json();
    assert.deepEqual([bodyOnly.title, bodyOnly.body], ["t", "z"]);

    const bad = [
      "{}",
      "[]",
      "null",
      JSON.stringify({ title: " " }),
      JSON.stringify({ title: 1 }),
      JSON.stringify({ body: 1 }),
      JSON.stringify({ title: "a".repeat(201) }),
      JSON.stringify({ body: "a".repeat(5001) }),
      "{",
    ];
    for (const body of bad) {
      const res = await send("PATCH", "/1", body);
      assert.equal(res.status, 400, body);
      assert.equal(typeof (await res.json()).error, "string");
    }
    const [after] = await (await fetch(url)).json();
    assert.deepEqual(after, bodyOnly);

    const missing = await send("PATCH", "/99", JSON.stringify({ title: "x" }));
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "note not found" });
    assert.equal((await send("PATCH", "/99", "{}")).status, 400);
    await fetch(`${url}/1`, { method: "DELETE" });
    assert.equal((await send("PATCH", "/1", JSON.stringify({ title: "x" }))).status, 404);
    assert.equal((await send("PUT", "/1", "{}")).status, 404);
  } finally {
    own.close();
  }
});

test("PATCH with a non-numeric id is a 404 note not found (AC 5)", async () => {
  for (const id of ["abc", "-1", "1.5", "0x1"]) {
    const res = await fetch(`${base}/api/notes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    assert.equal(res.status, 404, id);
    assert.deepEqual(await res.json(), { error: "note not found" }, id);
  }
});

test("PATCH pinned over HTTP (AC 1-6, 10)", async () => {
  const own = createApp(new NoteStore());
  await new Promise<void>((resolve) => own.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(own.address() as AddressInfo).port}/api/notes`;
  const send = (method: string, path: string, body: string) =>
    fetch(`${url}${path}`, { method, headers: { "content-type": "application/json" }, body });
  try {
    for (const t of ["a", "b"]) await send("POST", "", JSON.stringify({ title: t }));
    assert.equal(
      (await (await send("POST", "", JSON.stringify({ title: "c" }))).json()).pinned,
      false,
    );
    assert.equal((await (await fetch(`${url}?q=a`)).json())[0].pinned, false);

    const pin = await send("PATCH", "/1", JSON.stringify({ pinned: true }));
    assert.equal(pin.status, 200);
    const pinned = await pin.json();
    assert.equal(pinned.pinned, true);
    assert.equal(pinned.updatedAt, null);
    const list = await (await fetch(url)).json();
    assert.deepEqual(
      list.map((n: { id: number; pinned: boolean }) => [n.id, n.pinned]),
      [
        [1, true],
        [2, false],
        [3, false],
      ],
    );
    const unpin = await send("PATCH", "/1", JSON.stringify({ pinned: false }));
    assert.equal((await unpin.json()).pinned, false);

    // STU-61 AC1, AC2, AC4: pinned first over HTTP, with and without ?q=
    await send("PATCH", "/3", JSON.stringify({ pinned: true }));
    const ids = async (q = "") =>
      (await (await fetch(`${url}${q}`)).json()).map((n: { id: number }) => n.id);
    assert.deepEqual(await ids(), [3, 1, 2]);
    await send("PATCH", "/1", JSON.stringify({ title: "ab" }));
    await send("PATCH", "/3", JSON.stringify({ title: "cb" }));
    assert.deepEqual(await ids("?q=b"), [3, 1, 2]);
    await send("PATCH", "/3", JSON.stringify({ pinned: false }));
    assert.deepEqual(await ids(), [1, 2, 3]);

    await send("PATCH", "/2", JSON.stringify({ pinned: true }));
    for (const pinnedValue of ["yes", 1, null]) {
      const res = await send("PATCH", "/2", JSON.stringify({ pinned: pinnedValue }));
      assert.equal(res.status, 400);
      assert.equal(typeof (await res.json()).error, "string");
    }
    assert.equal((await send("PATCH", "/2", "{}")).status, 400);
    assert.equal((await (await fetch(url)).json())[0].pinned, true);
    assert.equal((await send("PATCH", "/99", JSON.stringify({ pinned: true }))).status, 404);
  } finally {
    own.close();
  }
});
