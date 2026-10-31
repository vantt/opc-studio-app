import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { NoteStore } from "../src/notes.ts";
import { createApp } from "../src/server.ts";
import { loadSnapshot, saveSnapshot } from "../src/storage.ts";

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

test("a note deleted over HTTP stays gone after the server restarts (AC 1-2)", async () => {
  const file = join(mkdtempSync(join(tmpdir(), "notes-")), "notes.json");
  const start = async () => {
    const store = new NoteStore(undefined, {
      initial: loadSnapshot(file),
      save: (s) => saveSnapshot(file, s),
    });
    const server = createApp(store);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/notes` };
  };
  const first = await start();
  try {
    const add = (title: string) =>
      fetch(first.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
    await add("keep");
    const gone = await (await add("drop")).json();
    assert.equal((await fetch(`${first.url}/${gone.id}`, { method: "DELETE" })).status, 204);
  } finally {
    first.server.close();
  }
  const second = await start();
  try {
    const titles = (await (await fetch(second.url)).json()).map((n: { title: string }) => n.title);
    assert.deepEqual(titles, ["keep"]);
  } finally {
    second.server.close();
  }
});

test("the Delete button asks for confirmation and reports failures (AC 3-4)", () => {
  const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const handler = page.slice(
    page.indexOf('method: "DELETE"') - 200,
    page.indexOf('method: "DELETE"') + 400,
  );
  assert.match(handler, /if \(!confirm\(/, "must confirm before calling the API");
  assert.ok(
    handler.indexOf("confirm(") < handler.indexOf('method: "DELETE"'),
    "confirm comes first",
  );
  assert.match(handler, /res\.ok \|\| res\.status === 404/, "only 204/404 count as success");
  assert.match(handler, /alert\(/, "other failures are shown");
});
