# opc-studio-app

Sample product for the OPC Studio coding team (Multica). A notes API and web page on Node 24, no runtime dependencies.

```bash
npm ci
make check     # everything CI checks
npm start      # http://127.0.0.1:3000
```

Notes are saved to `./data/notes.json` (override with `DATA_FILE`) and survive restarts. Run one process per data file. If the file is unreadable or corrupt the app refuses to start and names the file; it never overwrites it.

Working rules: [AGENTS.md](AGENTS.md). Structure: [ARCHITECTURE.md](ARCHITECTURE.md).
