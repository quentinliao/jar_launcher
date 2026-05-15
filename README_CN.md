<h1 align="center">☕ JarBox</h1>

<p align="center">
  <strong>一个跨平台的 JAR 应用启动器，内置 JDK 版本管理。</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#安装">安装</a> •
  <a href="#开发">开发</a> •
  <a href="#开源协议">开源协议</a>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README_CN.md">中文</a>
</p>

---

## 功能特性

- **一键启动** — 双击任意 JAR 应用即可运行
- **拖拽添加** — 将 JAR 文件拖入窗口即可添加
- **自动 JDK 管理** — 自动发现系统已安装的 JDK，支持下载安装新版本
- **JavaFX 检测** — 自动识别支持 JavaFX 的 JDK（如 Liberica Full、Zulu FX 等）
- **按应用指定 JDK** — 为每个应用单独配置 JDK 版本
- **自定义 JVM 参数** — 支持配置 JVM 参数和应用参数
- **深色模式** — 跟随系统自动切换深色/浅色主题
- **跨平台** — 支持 macOS、Linux 和 Windows

## 截图

> *（即将添加）*

## 安装

从 [Releases](https://github.com/quentinliao/jar_launcher/releases) 页面下载最新版本。

| 平台    | 格式 |
|---------|------|
| macOS   | `.dmg` |
| Linux   | `.deb` / `.AppImage` |
| Windows | `.msi` / `.exe` |

## 开发

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install)（最新稳定版）
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/quentinliao/jar_launcher.git
cd jar_launcher

# 安装前端依赖
npm install

# 启动开发服务器
npm run tauri dev
```

### 构建

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`。

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS + Vite
- **后端**: Rust + Tauri v2

## 开源协议

本项目基于 [MIT 协议](LICENSE) 开源。
