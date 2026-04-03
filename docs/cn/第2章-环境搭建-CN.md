---
title: "第2章：环境搭建与快速开始"
chapter: 2
category: 入门
priority: P0
estimated_words: 4000+
dependencies: [第1章]
language: cn
author: "Claude Code Tutorial Team"
version: 1.0.0
created: "2026-04-03"
---

# 第2章：环境搭建与快速开始

> **本章目标**：搭建 Claude Code 开发环境，配置必要的工具和依赖，成功运行第一个示例

---

## 📚 学习目标

完成本章后，你将能够：

- [ ] 搭建完整的 Claude Code 开发环境
- [ ] 配置必要的系统依赖和环境变量
- [ ] 成功运行 Claude Code 并执行第一个查询
- [ ] 掌握基本的故障排查方法

---

## 🔑 前置知识

在阅读本章之前，建议先掌握：

- **基本命令行操作**：能够使用终端执行基本命令
- **Git 基础**：了解如何克隆代码仓库
- **文本编辑器**：熟悉 VS Code 或其他编辑器的基本操作

**前置章节**：[第1章：项目概述与背景](./第1章-项目概述-CN.md)

**依赖关系**：
```
第1章 → 第2章（本章）→ 第3章 → 第4章
```

---

## 2.1 环境要求

在开始安装之前，请确保你的系统满足以下要求。

### 2.1.1 操作系统要求

Claude Code 支持以下操作系统：

| 操作系统 | 版本要求 | 支持状态 | 说明 |
|---------|---------|---------|------|
| **Windows** | Windows 10/11 | ✅ 完全支持 | 支持 PowerShell 和 WSL |
| **macOS** | macOS 12+ (Monterey) | ✅ 完全支持 | 支持 Intel 和 Apple Silicon |
| **Linux** | Ubuntu 20.04+, Debian 11+, Fedora 35+ | ✅ 完全支持 | 需要内核 5.10+ |
| **WSL** | WSL 2 | ✅ 完全支持 | 在 Windows 上运行 Linux 环境 |

**推荐配置**：
- 开发环境：macOS 或 Linux（最佳兼容性）
- 生产环境：根据团队需求选择
- 学习环境：任意支持的操作系统

### 2.1.2 硬件要求

**最低配置**：

| 资源 | 最低要求 | 推荐配置 |
|------|---------|---------|
| **CPU** | 2 核 | 4 核+ |
| **内存** | 4 GB RAM | 8 GB+ RAM |
| **磁盘** | 500 MB 可用空间 | 2 GB+ 可用空间 |
| **网络** | 稳定的互联网连接 | 高速网络（首次下载） |

**性能提示**：
- AI 对话需要稳定的网络连接（调用 Claude API）
- 大型项目分析建议 8GB+ 内存
- 多 Agent 并发建议 4 核+ CPU

### 2.1.3 软件依赖

**必需软件**：

1. **Git**（版本控制）
   ```bash
   # 检查 Git 版本
   git --version
   # 推荐：git version 2.30.0 或更高
   ```

2. **Bun**（JavaScript 运行时和包管理器）
   ```bash
   # 检查 Bun 版本
   bun --version
   # 推荐：bun version 1.0.0 或更高
   ```

3. **Node.js**（可选，用于某些工具）
   ```bash
   # 检查 Node.js 版本
   node --version
   # 推荐：Node.js 20 LTS 或更高
   ```

**可选软件**：

- **VS Code**（推荐编辑器）
- **Docker**（用于容器化部署）
- **Make**（用于构建脚本）

---

## 2.2 安装步骤

### 2.2.1 步骤 1：安装 Bun

Bun 是 Claude Code 的核心运行时，必须首先安装。

**Windows 安装**：

```powershell
# 使用 PowerShell（管理员权限）
powershell -c "irm bun.sh/install.ps1|iex"
```

**macOS/Linux 安装**：

```bash
# 使用 curl
curl -fsSL https://bun.sh/install | bash

# 或使用 npm
npm install -g bun
```

**验证安装**：

```bash
# 检查 Bun 版本
bun --version

# 应该输出：bun 1.x.x
```

**配置环境变量**（如果需要）：

```bash
# 添加到 PATH（macOS/Linux）
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 2.2.2 步骤 2：克隆 Claude Code 源码

**使用 Git 克隆仓库**：

```bash
# 克隆官方仓库
git clone https://github.com/anthropics/claude-code.git

# 进入项目目录
cd claude-code
```

**验证克隆**：

```bash
# 查看项目结构
ls -la

# 应该看到：
# - src/          源代码目录
# - package.json  项目配置
# - bun.lockb     依赖锁定文件
# - README.md     项目说明
```

### 2.2.3 步骤 3：安装项目依赖

**使用 Bun 安装依赖**：

```bash
# 在项目根目录执行
bun install

# 这将安装所有必需的依赖包
# 包括：React, Ink, Zod, Claude API SDK 等
```

**安装输出示例**：

```bash
$ bun install
bun install v1.0.0
+ react@18.2.0
+ ink@4.4.1
+ zod@3.22.4
+ @anthropic-ai/sdk@0.20.0
...
144 packages installed [2.3s]
```

**故障排查**：

如果安装失败，尝试：

```bash
# 清理缓存并重新安装
rm -rf node_modules bun.lockb
bun install --force
```

### 2.2.4 步骤 4：配置环境变量

**创建环境变量文件**：

```bash
# 复制示例配置文件
cp .env.example .env

# 编辑配置文件
# VS Code: code .env
# Vim: vim .env
# Nano: nano .env
```

**必需的环境变量**：

```bash
# .env 文件内容

# Anthropic API Key（必需）
ANTHROPIC_API_KEY=your_api_key_here

# 日志级别（可选：debug, info, warn, error）
LOG_LEVEL=info

# 最大并发工具调用（可选）
MAX_CONCURRENT_TOOLS=10
```

**获取 API Key**：

1. 访问 [Anthropic Console](https://console.anthropic.com)
2. 注册或登录账户
3. 进入 API Keys 页面
4. 创建新的 API Key
5. 复制 Key 并粘贴到 `.env` 文件

**验证配置**：

```bash
# 测试环境变量加载
bun run env:test

# 应该输出所有配置的环境变量
```

### 2.2.5 步骤 5：构建和运行

**开发模式运行**：

```bash
# 启动开发服务器
bun run dev

# 或使用 watch 模式（自动重载）
bun run dev:watch
```

**生产模式构建**：

```bash
# 构建生产版本
bun run build

# 运行生产版本
bun run start
```

**验证运行**：

```bash
# 应该看到 Claude Code 启动日志
$ bun run dev
[INFO] Starting Claude Code...
[INFO] Environment: development
[INFO] QueryEngine initialized
[INFO] 60 tools loaded
[INFO] 100 commands loaded
[INFO] Ready to accept queries
```

---

## 2.3 Hello World

### 2.3.1 第一个查询

**启动 Claude Code**：

```bash
# 在项目根目录
bun run dev
```

**输入第一个查询**：

```
你好，请介绍一下你自己。
```

**预期输出**：

```
🤖 Claude Code v1.0.0

你好！我是 Claude Code，由 Anthropic 开发的 AI 编程助手。

我可以帮助你：
- 理解和修改代码
- 执行命令行操作
- 搜索和分析代码库
- 创建和运行测试
- 生成文档和注释

让我开始帮助你吧！
```

### 2.3.2 第一个工具调用

**示例：读取文件内容**

```
请读取 src/Tool.ts 文件的内容。
```

**执行流程**：

```mermaid
sequenceDiagram
    participant User
    participant QueryEngine
    participant ToolSystem
    participant FileTool
    participant FileSystem
    
    User->>QueryEngine: "读取 src/Tool.ts"
    QueryEngine->>ToolSystem: 检测到文件读取意图
    ToolSystem->>FileTool: 调用 FileReadTool
    FileTool->>FileSystem: 读取文件
    FileSystem-->>FileTool: 返回文件内容
    FileTool-->>ToolSystem: 返回结果
    ToolSystem-->>QueryEngine: 工具执行结果
    QueryEngine-->>User: 显示文件内容
```

**预期输出**：

```
✅ 正在使用 FileReadTool 读取 src/Tool.ts...

// 文件位置：src/Tool.ts
// 行数：250 LOC

export interface Tool<Input, Output> {
  name: string
  description: string
  inputSchema: z.ZodType<Input>
  execute: (
    input: Input,
    context: ToolUseContext
  ) => AsyncGenerator<Result>
}

// ... 更多内容
```

### 2.3.3 第一个自定义命令

**斜杠命令示例**：

```
/help
```

**预期输出**：

```
📖 Claude Code 命令帮助

核心命令：
  /help        - 显示此帮助信息
  /clear       - 清空对话历史
  /exit        - 退出程序

配置命令：
  /config      - 管理配置
  /model       - 切换 AI 模型

开发命令：
  /agents      - 管理 Agent
  /skills      - 管理技能
  /plugins     - 管理插件

输入 "/help <command>" 查看具体命令的详细帮助。
```

**配置管理示例**：

```
/config set LOG_LEVEL debug
```

**预期输出**：

```
✅ 配置已更新

LOG_LEVEL: info → debug

配置已保存到 ~/.claude/config.json
```

---

## 2.4 常见问题

### Q1: Bun 安装失败怎么办？

**问题症状**：

```bash
$ curl -fsSL https://bun.sh/install | bash
curl: (7) Failed to connect to bun.sh port 443
```

**原因分析**：
- 网络连接问题
- 防火墙阻止
- DNS 解析失败

**解决方案**：

**方法 1：使用代理**

```bash
# 设置代理
export https_proxy=http://127.0.0.1:7890
export http_proxy=http://127.0.0.1:7890

# 重新安装
curl -fsSL https://bun.sh/install | bash
```

**方法 2：使用 npm 安装**

```bash
npm install -g bun
```

**方法 3：手动下载**

1. 访问 [Bun Releases](https://github.com/oven-sh/bun/releases)
2. 下载适合你系统的二进制文件
3. 解压并添加到 PATH

**验证安装**：

```bash
bun --version
```

### Q2: 依赖安装失败

**问题症状**：

```bash
$ bun install
error: package "react@18.2.0" not found
```

**原因分析**：
- 网络连接不稳定
- npm registry 配置错误
- bun.lockb 文件损坏

**解决方案**：

**步骤 1：清理缓存**

```bash
# 清理 Bun 缓存
bun pm cache rm

# 清理项目依赖
rm -rf node_modules bun.lockb
```

**步骤 2：切换 npm 源**

```bash
# 使用淘宝镜像（中国用户）
bun install --registry https://registry.npmmirror.com

# 或配置永久使用
bun pm set config registry https://registry.npmmirror.com
```

**步骤 3：重新安装**

```bash
bun install --force
```

### Q3: API Key 配置错误

**问题症状**：

```
[ERROR] ANTHROPIC_API_KEY not set or invalid
[ERROR] Failed to initialize QueryEngine
```

**原因分析**：
- 环境变量未设置
- API Key 格式错误
- API Key 已过期

**解决方案**：

**步骤 1：检查环境变量**

```bash
# Linux/macOS
echo $ANTHROPIC_API_KEY

# Windows PowerShell
echo $Env:ANTHROPIC_API_KEY

# 应该输出你的 API Key
```

**步骤 2：验证 API Key 格式**

```bash
# API Key 格式：sk-ant-api03-xxxxxxxxx
# 示例：sk-ant-api03-1234567890abcdef
```

**步骤 3：重新配置**

```bash
# 编辑 .env 文件
vim .env

# 确保：
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxx
# 没有引号
# 没有额外空格
```

**步骤 4：重启应用**

```bash
# 退出当前运行
# Ctrl+C 或 exit

# 重新启动
bun run dev
```

### Q4: 权限问题（Windows）

**问题症状**：

```powershell
PS C:\> bun run dev
AccessDenied: Permission denied
```

**原因分析**：
- PowerShell 执行策略限制
- 文件权限问题

**解决方案**：

**方法 1：以管理员身份运行**

```powershell
# 右键点击 PowerShell
# 选择"以管理员身份运行"
```

**方法 2：修改执行策略**

```powershell
# 查看当前策略
Get-ExecutionPolicy

# 修改为 RemoteSigned
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**方法 3：使用 WSL**

```bash
# 在 WSL 中运行（推荐）
wsl
cd /mnt/c/path/to/claude-code
bun run dev
```

### Q5: 端口占用问题

**问题症状**：

```
[ERROR] Port 3000 already in use
```

**解决方案**：

**查找占用进程**：

```bash
# Linux/macOS
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

**终止进程**：

```bash
# Linux/macOS
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

**或更换端口**：

```bash
# 设置环境变量
export PORT=3001

# 重新启动
bun run dev
```

---

## 2.5 验证安装

### 2.5.1 完整性检查

运行系统诊断：

```bash
# 运行诊断脚本
bun run doctor
```

**预期输出**：

```
🔍 Claude Code 系统诊断

✅ Bun: 1.0.0 (OK)
✅ Node.js: 20.11.0 (OK)
✅ Git: 2.43.0 (OK)
✅ ANTHROPIC_API_KEY: Set (OK)
✅ Dependencies: All installed (OK)
✅ File Permissions: OK

总体状态：✅ 所有检查通过
```

### 2.5.2 功能测试

**测试 1：基本查询**

```bash
bun run dev
```

输入：

```
计算 1 + 1 等于多少？
```

预期：

```
1 + 1 = 2
```

**测试 2：工具调用**

输入：

```
列出当前目录的所有文件。
```

预期：

```
当前目录文件：
- src/
- package.json
- bun.lockb
- README.md
...
```

**测试 3：命令执行**

输入：

```
/config get LOG_LEVEL
```

预期：

```
LOG_LEVEL: info
```

---

## 📊 本章小结

### 核心要点

1. **环境准备**
   - 操作系统：Windows/macOS/Linux/WSL
   - 必需软件：Git、Bun
   - API Key：Anthropic API Key

2. **安装流程**
   - 安装 Bun 运行时
   - 克隆 Claude Code 源码
   - 安装项目依赖
   - 配置环境变量

3. **基本使用**
   - 启动 Claude Code
   - 执行第一个查询
   - 调用第一个工具
   - 使用第一个命令

4. **故障排查**
   - 网络问题：使用代理或镜像
   - 依赖问题：清理缓存重装
   - 配置问题：检查环境变量
   - 权限问题：管理员模式或 WSL

### 学习检查

完成本章后，你应该能够：

- [ ] 独立搭建 Claude Code 开发环境
- [ ] 正确配置所有必需的环境变量
- [ ] 成功启动 Claude Code 并执行基本查询
- [ ] 排查和解决常见的安装问题
- [ ] 理解 Claude Code 的基本使用流程

---

## 🚀 下一步

**下一章**：[第3章：核心概念与术语](./第3章-核心概念-CN.md)

**学习路径**：

```
第1章：项目概述
  ↓
第2章：环境搭建（本章）✅
  ↓
第3章：核心概念 ← 下一章
  ↓
第4章：第一个应用
```

**实践建议**：

完成本章学习后，建议：

1. **熟悉环境**
   - 尝试不同的查询
   - 探索可用的工具
   - 测试各种命令

2. **配置优化**
   - 调整日志级别
   - 配置快捷键
   - 自定义主题

3. **深入学习**
   - 阅读官方文档
   - 查看源代码
   - 加入社区讨论

---

## 📚 扩展阅读

### 相关章节
- **前置章节**：[第1章：项目概述与背景](./第1章-项目概述-CN.md)
- **后续章节**：[第3章：核心概念与术语](./第3章-核心概念-CN.md)
- **实战章节**：[第4章：第一个 Claude 应用](./第4章-第一个应用-CN.md)

### 外部资源
- [Bun 官方文档](https://bun.sh/docs)
- [Anthropic API 文档](https://docs.anthropic.com)
- [Claude Code GitHub 仓库](https://github.com/anthropics/claude-code)
- [TypeScript 官方文档](https://www.typescriptlang.org/docs)

### 社区资源
- [Claude Code Discord](https://discord.gg/claude-code)
- [Stack Overflow - claude-code](https://stackoverflow.com/questions/tagged/claude-code)
- [Reddit - r/claudecode](https://reddit.com/r/claudecode)

---

## 🔗 快速参考

### 关键命令

```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 克隆仓库
git clone https://github.com/anthropics/claude-code.git

# 安装依赖
bun install

# 开发模式
bun run dev

# 构建生产版本
bun run build

# 运行诊断
bun run doctor
```

### 环境变量

```bash
# API Key（必需）
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxx

# 日志级别
LOG_LEVEL=info|debug|warn|error

# 最大并发
MAX_CONCURRENT_TOOLS=10
```

### 常用路径

```bash
# 配置文件
~/.claude/config.json

# 环境变量
./.env

# 日志文件
~/.claude/logs/
```

---

**版本**: 1.0.0  
**最后更新**: 2026-04-03  
**维护者**: Claude Code Tutorial Team
