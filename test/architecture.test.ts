import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const IMPORT = /^\s*import\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gm;

interface Import {
  specifier: string;
  typeOnly: boolean;
}

function importsOf(file: string): Import[] {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  return [...source.matchAll(IMPORT)].map((m) => ({
    specifier: m[2] as string,
    typeOnly: Boolean(m[1]),
  }));
}

const sourceFiles = readdirSync(new URL("../src/", import.meta.url))
  .filter((f) => f.endsWith(".ts"))
  .map((f) => `src/${f}`);

test("src/notes.ts imports no I/O module, server or storage", () => {
  const banned = ["node:fs", "node:fs/promises", "node:http", "./server.ts", "./storage.ts"];
  for (const i of importsOf("src/notes.ts"))
    assert.ok(!banned.includes(i.specifier), `src/notes.ts must not import ${i.specifier}`);
});

test("src/storage.ts imports no http or server, and only types from notes.ts", () => {
  for (const i of importsOf("src/storage.ts")) {
    assert.ok(
      i.specifier !== "node:http" && i.specifier !== "./server.ts",
      `src/storage.ts must not import ${i.specifier}`,
    );
    if (i.specifier === "./notes.ts")
      assert.ok(i.typeOnly, "src/storage.ts may only import types from ./notes.ts");
  }
});

test("only src/main.ts imports src/storage.ts", () => {
  for (const file of sourceFiles.filter((f) => f !== "src/main.ts"))
    for (const i of importsOf(file))
      assert.notEqual(i.specifier, "./storage.ts", `${file} must not import ./storage.ts`);
});

test("package.json declares no runtime dependencies", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], "adding a dependency needs an ADR");
});
