<h1 align="center">☕ JarBox</h1>

<p align="center">
  <strong>A cross-platform JAR application launcher with built-in JDK management.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#development">Development</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README_CN.md">中文</a>
</p>

---

## Features

- **One-click launch** — Double-click any JAR app to run it instantly
- **Drag & drop** — Add JAR files by dragging them into the window
- **Automatic JDK management** — Auto-discover system JDKs, or download and install new ones
- **JavaFX detection** — Identifies JDKs with JavaFX support (Liberica Full, Zulu FX, etc.)
- **JDK per app** — Assign specific JDK versions to individual applications
- **Custom JVM args** — Configure JVM and application arguments per app
- **Dark mode** — System-aware dark/light theme support
- **Cross-platform** — macOS, Linux, and Windows

## Screenshots

> *(Coming soon)*

## Installation

Download the latest release from the [Releases](https://github.com/quentinliao/jar_launcher/releases) page.

| Platform | Format |
|----------|--------|
| macOS    | `.dmg` |
| Linux    | `.deb` / `.AppImage` |
| Windows  | `.msi` / `.exe` |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### Setup

```bash
# Clone the repository
git clone https://github.com/quentinliao/jar_launcher.git
cd jar_launcher

# Install frontend dependencies
npm install

# Start development server
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

The built artifacts will be in `src-tauri/target/release/bundle/`.

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Rust + Tauri v2

## License

This project is licensed under the [MIT License](LICENSE).
