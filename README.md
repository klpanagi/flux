# ⚡ Flux

**Your AI subscription command center.**

Flux is a lightweight desktop app that monitors your OpenCode Go and CommandCode GOAT subscriptions in real time — usage windows, credit balances, model catalogs, and pricing — all in one unified portfolio view.

![Flux](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Runtime](https://img.shields.io/badge/runtime-Bun%20%2B%20Electron-6366f1)

---

## ✨ Features

- **Multi-account monitoring** — Track as many OpenCode Go and CommandCode GOAT subscriptions as you want
- **Live usage tracking** — 5-hour rolling, weekly, and monthly windows with progress bars
- **Credit balance** — Real-time remaining credits and spend per billing period
- **Unified portfolio** — All accounts at a glance: total requests, spend, tokens
- **Model catalog** — Browse 130+ models from both providers with input/output/cache pricing
- **Search & filter** — Find models by name, filter by provider, sort by price or context window
- **Color-coded pricing** — Green (< $1), yellow (< $3), red (≥ $3) per 1M tokens
- **Cost calculator** — Estimate per-request and monthly cost for any model
- **Usage alerts** — Configurable thresholds with desktop notifications
- **Usage history** — Local snapshots with hand-rolled canvas charts
- **Model comparison** — Side-by-side comparison of 2–4 models with winner highlighting
- **Native desktop app** — Standalone Electron app on macOS and Linux
- **Zero config** — Just add your API key and go

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Node.js](https://nodejs.org) (v18+)

### Run from source

```bash
git clone https://github.com/klpanagi/flux.git
cd flux
npm install
npm run electron:dev
```

This starts the Bun server and opens the Electron window automatically.

### Build desktop app

```bash
npm run electron:dist:mac     # macOS DMG
npm run electron:dist:linux   # Linux AppImage
```

### Run server only (browser mode)

```bash
bun run start   # opens at http://localhost:4000
```

## 🏗 Architecture

```
flux/
├── src/server.ts       # Bun HTTP server (API + static files)
├── public/index.html   # Single-page frontend (vanilla JS)
├── electron/main.js    # Electron main process
└── package.json
```

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Desktop | [Electron](https://www.electronjs.org) 41 |
| Frontend | Vanilla JS + CSS (no framework) |
| Server | Bun `serve()` |
| Packaging | electron-builder |

## 📊 Supported Providers

### OpenCode Go
- **Plans**: Go ($10/mo), Go Plus ($40/mo)
- **Usage windows**: 5-hour (20%), weekly (50%), monthly (100%)
- **Models**: 37 models including DeepSeek, GLM, Kimi, Qwen, MiniMax, and more

### CommandCode GOAT
- **Plan**: GOAT ($10/mo, $70 credits)
- **Usage windows**: 5-hour ($14), weekly ($35), monthly ($70)
- **Models**: 93 models including Claude, GPT, Gemini, DeepSeek, and more

## 🔌 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/subscriptions` | GET | List all subscriptions |
| `/api/subscriptions` | POST | Add subscription `{provider, label, apiKey}` |
| `/api/subscriptions/:id` | DELETE | Remove subscription |
| `/api/usage/:id` | GET | Live usage for a subscription |
| `/api/models/opencode-go` | GET | OpenCode Go model list |
| `/api/models/commandcode` | GET | CommandCode model list |

## 🛠 Development

```bash
npm install
npm run electron:dev      # dev mode with hot reload
npm run electron:build   # unpacked build
```

Environment variables:
- `FLUX_PORT` — server port (default `4000`)
- `FLUX_DB` — SQLite database path (default `~/.flux/flux.db`)

## 📝 License

MIT © klpanagi

---

_Built with ⚡ by a developer who got tired of checking usage dashboards manually._
