# ⚡ Flux

**Your AI subscription command center.**

Flux is a lightweight desktop app that monitors your OpenCode Go and CommandCode GOAT subscriptions in real time — usage windows, credit balances, model catalogs, and pricing — all in one unified portfolio view.

![Flux](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- **Multi-account monitoring** — Add as many OpenCode Go and CommandCode GOAT subscriptions as you want
- **Live usage tracking** — 5-hour rolling, weekly, and monthly windows with progress bars
- **Credit balance** — Real-time remaining credits and spend per billing period
- **Unified portfolio** — See all accounts at a glance: total requests, spend, tokens
- **Model catalog** — Browse 130+ models from both providers with input/output/cache pricing
- **Search & filter** — Find models by name, filter by provider, sort by price or context window
- **Color-coded pricing** — Green (< $1), yellow (< $3), red (≥ $3) per 1M tokens
- **Native desktop app** — Runs as a standalone Electron app on macOS and Linux, no browser needed
- **Zero config** — Just add your API key and go

---

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Node.js](https://nodejs.org) (v18+)
- [Electron](https://www.electronjs.org) (installed via npm)

### Development

```bash
git clone https://github.com/klpanagi/flux.git
cd flux
npm install
npm run electron:dev
```

This starts the Bun server and opens the Electron window automatically.

### Build Desktop App

**macOS (DMG):**
```bash
npm run electron:dist:mac
```
Output: `dist-electron/Subscription Monitor-*.dmg`

**Linux (AppImage):**
```bash
npm run electron:dist:linux
```
Output: `dist-electron/Subscription Monitor-*.AppImage`

**Directory (unpacked):**
```bash
npm run electron:build
```
Output: `dist-electron/` folder with the app

### Run from Source (no Electron)

```bash
bun run start
# Opens at http://localhost:3000
```

---

## 📖 Usage

1. **Launch** the app — it opens automatically in a native window
2. **Add a subscription** — Go to the Subscriptions tab, select provider (OpenCode Go or CommandCode GOAT), enter a label and your API key
3. **Monitor** — The Portfolio tab shows all accounts with live usage, credits, and spend
4. **Browse models** — The Models & Prices tab lists all available models with pricing. Search, filter by provider, and sort by price or context window

### Getting API Keys

- **OpenCode Go**: Sign in at [opencode.ai](https://opencode.ai), subscribe to Go or Go Plus, copy your API key
- **CommandCode GOAT**: Sign in at [commandcode.ai](https://commandcode.ai), subscribe to GOAT, copy your API key from Studio

---

## 🏗 Architecture

```
flux/
├── src/
│   └── server.ts          # Bun HTTP server (API + static files)
├── public/
│   └── index.html         # Single-page frontend (vanilla JS)
├── electron/
│   └── main.js            # Electron main process
└── package.json
```

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Desktop | [Electron](https://www.electronjs.org) 41 |
| Frontend | Vanilla JS + CSS (no framework) |
| Server | Bun `serve()` |
| Packaging | electron-builder |

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/subscriptions` | GET | List all subscriptions |
| `/api/subscriptions` | POST | Add subscription `{provider, label, apiKey}` |
| `/api/subscriptions/:id` | DELETE | Remove subscription |
| `/api/usage/:id` | GET | Live usage for a subscription |
| `/api/models/opencode-go` | GET | OpenCode Go model list |
| `/api/models/commandcode` | GET | CommandCode model list |

---

## 📊 Supported Providers

### OpenCode Go
- **Plans**: Go ($10/mo), Go Plus ($40/mo)
- **Usage windows**: 5-hour (20%), weekly (50%), monthly (100%)
- **Models**: 37 models including DeepSeek, GLM, Kimi, Qwen, MiniMax, and more
- **API**: `https://opencode.ai/inference/go/v1/usage`

### CommandCode GOAT
- **Plan**: GOAT ($10/mo, $70 credits)
- **Usage windows**: 5-hour ($14), weekly ($35), monthly ($70)
- **Models**: 93 models including Claude, GPT, Gemini, DeepSeek, and more
- **API**: `https://api.commandcode.ai/alpha/billing/credits`

---

## 🛠 Development

```bash
# Install dependencies
npm install

# Run server only (browser mode)
bun run start

# Run with Electron (dev mode)
npm run electron:dev

# Build unpacked app
npm run electron:build

# Build distributable
npm run electron:dist:mac    # macOS DMG
npm run electron:dist:linux  # Linux AppImage
```

---

## 📝 License

MIT © klpanagi

---

_Built with ⚡ by a developer who got tired of checking usage dashboards manually._
EOF
echo "done"