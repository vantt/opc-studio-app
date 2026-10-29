import { NoteStore } from "./notes.ts";
import { createApp } from "./server.ts";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

createApp(new NoteStore()).listen(port, host, () => {
  console.log(`opc-studio-app listening on http://${host}:${port}`);
});
