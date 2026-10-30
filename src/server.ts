import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { type NoteStore, ValidationError } from "./notes.ts";

const INDEX_HTML = new URL("../public/index.html", import.meta.url);
const MAX_BODY_BYTES = 16 * 1024;

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "request body too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "request body is not valid JSON");
  }
}

async function route(store: NoteStore, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { pathname, searchParams } = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";

  if (method === "GET" && pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(await readFile(INDEX_HTML));
    return;
  }
  if (method === "GET" && pathname === "/healthz") return sendJson(res, 200, { status: "ok" });
  if (pathname === "/api/notes") {
    if (method === "GET") return sendJson(res, 200, store.list(searchParams.get("q") ?? undefined));
    if (method === "POST") return sendJson(res, 201, store.add(await readJson(req)));
    throw new HttpError(405, "method not allowed");
  }
  const match = /^\/api\/notes\/(\d+)$/.exec(pathname);
  if (match && method === "DELETE") {
    if (!store.remove(Number(match[1]))) throw new HttpError(404, "note not found");
    res.writeHead(204).end();
    return;
  }
  throw new HttpError(404, "not found");
}

export function createApp(store: NoteStore): Server {
  return createServer((req, res) => {
    route(store, req, res).catch((err: unknown) => {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
      console.error(err);
      sendJson(res, 500, { error: "internal error" });
    });
  });
}
