# Tentacle Plugin - Seer

Media discovery and request management plugin for [Tentacle TV](https://github.com/Knaox/Tentacle-TV), powered by [Jellyseerr](https://github.com/Fallenbagel/jellyseerr) / [Overseerr](https://overseerr.dev/).

## Features

- **Discover** - Browse trending movies, TV shows, and anime
- **Search** - Search the full media catalog
- **Request** - Request movies and series in 1 click
- **Track** - Follow the status of your requests (pending, approved, downloading, available)
- **Admin config** - Configure Jellyseerr URL, API key, and auto-approval settings
- **i18n** - English and French translations included

## Requirements

- Tentacle TV >= 0.9.0
- A running Jellyseerr or Overseerr instance

## Installation

### Via the Marketplace (recommended)

1. Open Tentacle TV as admin
2. Go to **Admin > Marketplace**
3. Find **Seer** and click **Install**
4. Go to **Admin > Seer** to configure Jellyseerr URL and API key

### Manual installation

1. Download the latest release from [Releases](https://github.com/Knaox/Tentacle-Plugin-Seer/releases)
2. Extract the archive into `data/plugins/seer/` on your Tentacle server
3. Restart the backend

## Development

### Prerequisites

- Node.js >= 20
- npm

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

This produces `dist/plugin-seer.iife.js` - a single self-contained bundle that auto-registers with Tentacle TV at runtime.

### Typecheck

```bash
npm run typecheck
```

### Package for release

```bash
npm run build
tar -czf plugin-seer-v1.0.0.tar.gz dist/ plugin.json
```

## Architecture

This plugin is built as an **IIFE bundle** (Immediately Invoked Function Expression). Shared dependencies (React, React Query, react-i18next) are provided by the host app via `window.TentacleShared` and are not bundled into the plugin.

| External | Mapped to |
|----------|-----------|
| `react` | `TentacleShared.React` |
| `react/jsx-runtime` | `TentacleShared.ReactJSXRuntime` |
| `react-i18next` | `TentacleShared.ReactI18next` |
| `@tanstack/react-query` | `TentacleShared.TanStackQuery` |
| `@tentacle-tv/plugins-api` | `TentacleShared.PluginsAPI` |

When loaded, the plugin auto-registers via `window.__tentacle.registerPlugin()`.

## License

MIT
