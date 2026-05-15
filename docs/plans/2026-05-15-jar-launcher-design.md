# JarBox - 跨平台 JAR 启动器设计文档

## 概述

JarBox 是一个面向普通用户的跨平台桌面应用，用于集中管理和启动 JAR 应用程序，无需用户手动配置 Java 环境。

**核心价值**：把"安装 JDK → 配置环境变量 → 命令行启动 JAR"这个流程简化为"拖入 JAR → 双击启动"。

## 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 框架 | Tauri 2 | Rust 后端 + WebView 前端 |
| 前端 | React 18 + TypeScript | SPA |
| 样式 | Tailwind CSS 4 | 快速构建 UI |
| 构建 | Vite | 开发热更新 |
| 图标 | Lucide React | 轻量图标库 |

## 架构

```
┌─────────────────────────────────────┐
│           Web 前端 (UI)             │
│   React + Tailwind CSS              │
│   应用列表 / JDK管理 / 设置         │
├─────────────────────────────────────┤
│         Tauri Core (Rust)           │
│   ┌───────────┬───────────┬────────┐│
│   │ JAR管理器 │ JDK管理器 │ 启动器  ││
│   │ 复制/解析 │ 发现/下载 │ 执行器  ││
│   │ 版本对比  │ 安装/配置 │ 进程管  ││
│   └───────────┴───────────┴────────┘│
├─────────────────────────────────────┤
│          本地文件系统                │
│  ~/.jarbox/                         │
│  ├── apps/        (JAR库)           │
│  ├── jdks/        (已安装JDK)       │
│  ├── icons/       (应用图标缓存)    │
│  └── config.json  (应用配置)        │
└─────────────────────────────────────┘
```

## 数据模型

`config.json` 结构：

```json
{
  "apps": [
    {
      "id": "uuid",
      "name": "MyApp",
      "version": "2.1.0",
      "jarPath": "apps/uuid/myapp.jar",
      "jdkId": "jdk-17-adoptium",
      "jvmArgs": ["-Xmx512m"],
      "appArgs": [],
      "iconPath": null,
      "showConsole": false,
      "addedAt": "2026-05-15T00:00:00Z"
    }
  ],
  "jdks": [
    {
      "id": "jdk-17-adoptium",
      "version": "17.0.10",
      "majorVersion": 17,
      "vendor": "Adoptium",
      "path": "/Library/Java/...",
      "source": "system | downloaded"
    }
  ],
  "settings": {
    "appsDir": "~/.jarbox/apps",
    "jdksDir": "~/.jarbox/jdks",
    "autoStart": false,
    "closeBehavior": "minimize-to-tray",
    "defaultJdkPolicy": "auto-match",
    "launchBehavior": "background",
    "theme": "system"
  }
}
```

## 功能模块

### 1. JAR 应用管理

**添加流程**：
1. 用户通过拖拽或文件选择器添加 JAR 文件
2. Rust 后端将 JAR 复制到 `~/.jarbox/apps/{uuid}/` 目录
3. 解析 `META-INF/MANIFEST.MF` 提取元数据：
   - `Implementation-Title` / `Bundle-Name` → 应用名称
   - `Implementation-Version` / `Bundle-Version` → 版本号
   - `Main-Class` → 主类
   - 回退：从文件名推导（如 `myapp-2.1.0.jar` → 名称 "myapp"，版本 "2.1.0"）
4. 分配默认 Java 图标，用户可手动更换

**版本升降级**：
- 拖入已有应用的新 JAR → 对比版本号
- 版本更高 → 静默替换（升级）
- 版本更低 → 弹窗提醒确认降级
- 无法解析版本 → 提示用户手动确认

**拖拽到卡片上**：直接更新该应用的 JAR 文件

### 2. JDK 管理

**发现已有 JDK**：扫描系统路径
- macOS: `/Library/Java/JavaVirtualMachines/`, `~/.sdkman/candidates/java/`
- Windows: `C:\Program Files\Java\`, `C:\Program Files\Eclipse Adoptium\`
- Linux: `/usr/lib/jvm/`, `~/.sdkman/candidates/java/`

**下载安装**：
- 通过 Adoptium API 下载主流 JDK 发行版
- 支持 Java 8、11、17、21 版本
- 发行版选择：Adoptium (默认) / Corretto / GraalVM
- 下载到 `~/.jarbox/jdks/` 并自动解压注册
- 实时进度展示

**自动匹配 JDK**：
- 从 JAR 的 `Build-Jdk` / `Created-By` 推断编译 JDK 版本
- 优先匹配同大版本已安装 JDK
- 无匹配时使用最新已安装 JDK
- 无任何 JDK 时提示下载

### 3. 应用启动

- 双击卡片启动应用
- 组装命令：`{jdk-path}/bin/java [-JVM参数] -jar {jar-path} [应用参数]`
- 子进程管理，显示"运行中"状态
- 可选控制台面板查看进程输出
- 需要图形界面的 JAR 不传 `-Djava.awt.headless=true`

## UI 界面

### 主界面（应用列表）

卡片网格布局，自适应列数。每个卡片显示图标、名称、版本、使用的 JDK。底部状态栏显示 JDK 数量和运行中应用数。支持拖拽 JAR 到窗口任意位置添加。

**交互**：
- 双击卡片 → 启动应用
- 右键/长按 → 上下文菜单（启动、编辑、打开文件位置、更新 JAR、删除）
- 拖拽 JAR 到窗口 → 添加应用
- 拖拽 JAR 到卡片 → 更新该应用

### 右键菜单

启动、编辑、打开文件位置、更新 JAR、删除

### 编辑应用对话框

可修改：应用图标、名称、版本号（只读显示）、JDK 绑定（下拉选择或手动指定路径）、JVM 参数、应用参数、是否显示控制台输出

### JDK 管理页面

上半部分列出已安装 JDK（来源：系统发现/已下载），每个条目显示版本、供应商、路径。下半部分提供下载功能：选择版本和发行版，点击下载安装，实时进度条。

### 版本降级确认弹窗

显示应用名称、当前版本、拖入版本，提示降级风险，提供取消和确认降级按钮。

### 设置页面

分组设置：通用（库目录、JDK 目录、开机自启、关闭行为）、启动（默认 JDK 策略、启动后行为）、外观（主题）、关于（版本号、检查更新）。

## 项目名称

JarBox（可在后续调整）

## 平台支持

- macOS (aarch64, x86_64)
- Windows (x86_64)
- Linux (x86_64, aarch64)
