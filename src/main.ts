import { NoteStore } from "./notes.ts";
import { createApp } from "./server.ts";
import { loadSnapshot, saveSnapshot } from "./storage.ts";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const dataFile = process.env.DATA_FILE ?? "./data/notes.json";

let store: NoteStore;
try {
  const initial = loadSnapshot(dataFile);
  store = new NoteStore(undefined, { initial, save: (s) => saveSnapshot(dataFile, s) });
} catch (e) {
  console.error(`cannot start: ${(e as Error).message}`);
  process.exit(1);
}

createApp(store).listen(port, host, () => {
  console.log(`opc-studio-app listening on http://${host}:${port} (data: ${dataFile})`);
});
