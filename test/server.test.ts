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
