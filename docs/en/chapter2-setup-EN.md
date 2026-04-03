---
title: "Chapter 2: Environment Setup and Quick Start"
chapter: 2
category: Introduction
priority: P0
estimated_words: 4000+
dependencies: [Chapter 1]
language: en
author: "Claude Code Tutorial Team"
version: 1.0.0
created: "2026-04-03"
---

# Chapter 2: Environment Setup and Quick Start

> **Chapter Goal**: Set up the Claude Code development environment, configure necessary tools and dependencies, and successfully run your first example

---

## 📚 Learning Objectives

After completing this chapter, you will be able to:

- [ ] Set up a complete Claude Code development environment
- [ ] Configure necessary system dependencies and environment variables
- [ ] Successfully run Claude Code and execute your first query
- [ ] Master basic troubleshooting methods

---

## 🔑 Prerequisites

Before reading this chapter, it's recommended to master:

- **Basic Command Line Operations**: Ability to execute basic commands in terminal
- **Git Basics**: Understanding how to clone code repositories
- **Text Editor**: Familiarity with VS Code or other editor basics

**Prerequisite Chapter**: [Chapter 1: Project Overview and Background](../en/chapter1-introduction-EN.md)

**Dependencies**:
```
Chapter 1 → Chapter 2 (This Chapter) → Chapter 3 → Chapter 4
```

---

## 2.1 Environment Requirements

Before starting installation, ensure your system meets the following requirements.

### 2.1.1 Operating System Requirements

Claude Code supports the following operating systems:

| Operating System | Version Requirements | Support Status | Notes |
|-----------------|---------------------|----------------|-------|
| **Windows** | Windows 10/11 | ✅ Fully Supported | Supports PowerShell and WSL |
| **macOS** | macOS 12+ (Monterey) | ✅ Fully Supported | Supports Intel and Apple Silicon |
| **Linux** | Ubuntu 20.04+, Debian 11+, Fedora 35+ | ✅ Fully Supported | Requires kernel 5.10+ |
| **WSL** | WSL 2 | ✅ Fully Supported | Running Linux environment on Windows |

**Recommended Configuration**:
- Development Environment: macOS or Linux (best compatibility)
- Production Environment: Choose based on team requirements
- Learning Environment: Any supported operating system

### 2.1.2 Hardware Requirements

**Minimum Configuration**:

| Resource | Minimum Requirement | Recommended Configuration |
|----------|---------------------|--------------------------|
| **CPU** | 2 cores | 4+ cores |
| **Memory** | 4 GB RAM | 8+ GB RAM |
| **Disk** | 500 MB free space | 2+ GB free space |
| **Network** | Stable internet connection | High-speed network (first-time download) |

**Performance Tips**:
- AI conversations require stable network connection (calling Claude API)
- Large project analysis suggests 8GB+ memory
- Multi-agent concurrency suggests 4+ CPU cores

### 2.1.3 Software Dependencies

**Required Software**:

1. **Git** (Version Control)
   ```bash
   # Check Git version
   git --version
   # Recommended: git version 2.30.0 or higher
   ```

2. **Bun** (JavaScript Runtime and Package Manager)
   ```bash
   # Check Bun version
   bun --version
   # Recommended: bun version 1.0.0 or higher
   ```

3. **Node.js** (Optional, for certain tools)
   ```bash
   # Check Node.js version
   node --version
   # Recommended: Node.js 20 LTS or higher
   ```

**Optional Software**:

- **VS Code** (Recommended editor)
- **Docker** (For containerized deployment)
- **Make** (For build scripts)

---

## 2.2 Installation Steps

### 2.2.1 Step 1: Install Bun

Bun is the core runtime of Claude Code and must be installed first.

**Windows Installation**:

```powershell
# Using PowerShell (administrator privileges)
powershell -c "irm bun.sh/install.ps1|iex"
```

**macOS/Linux Installation**:

```bash
# Using curl
curl -fsSL https://bun.sh/install | bash

# Or using npm
npm install -g bun
```

**Verify Installation**:

```bash
# Check Bun version
bun --version

# Should output: bun 1.x.x
```

**Configure Environment Variables** (if needed):

```bash
# Add to PATH (macOS/Linux)
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 2.2.2 Step 2: Clone Claude Code Source

**Clone Repository Using Git**:

```bash
# Clone official repository
git clone https://github.com/anthropics/claude-code.git

# Enter project directory
cd claude-code
```

**Verify Clone**:

```bash
# View project structure
ls -la

# Should see:
# - src/          Source code directory
# - package.json  Project configuration
# - bun.lockb     Dependency lock file
# - README.md     Project documentation
```

### 2.2.3 Step 3: Install Project Dependencies

**Install Dependencies Using Bun**:

```bash
# Execute in project root directory
bun install

# This will install all required dependency packages
# Including: React, Ink, Zod, Claude API SDK, etc.
```

**Installation Output Example**:

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

**Troubleshooting**:

If installation fails, try:

```bash
# Clear cache and reinstall
rm -rf node_modules bun.lockb
bun install --force
```

### 2.2.4 Step 4: Configure Environment Variables

**Create Environment Variable File**:

```bash
# Copy example configuration file
cp .env.example .env

# Edit configuration file
# VS Code: code .env
# Vim: vim .env
# Nano: nano .env
```

**Required Environment Variables**:

```bash
# .env file content

# Anthropic API Key (required)
ANTHROPIC_API_KEY=your_api_key_here

# Log level (optional: debug, info, warn, error)
LOG_LEVEL=info

# Maximum concurrent tool calls (optional)
MAX_CONCURRENT_TOOLS=10
```

**Obtaining API Key**:

1. Visit [Anthropic Console](https://console.anthropic.com)
2. Register or login to your account
3. Navigate to API Keys page
4. Create a new API Key
5. Copy the Key and paste it into `.env` file

**Verify Configuration**:

```bash
# Test environment variable loading
bun run env:test

# Should output all configured environment variables
```

### 2.2.5 Step 5: Build and Run

**Development Mode**:

```bash
# Start development server
bun run dev

# Or use watch mode (auto-reload)
bun run dev:watch
```

**Production Build**:

```bash
# Build production version
bun run build

# Run production version
bun run start
```

**Verify Running**:

```bash
# Should see Claude Code startup logs
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

### 2.3.1 First Query

**Start Claude Code**:

```bash
# In project root directory
bun run dev
```

**Enter Your First Query**:

```
Hello, please introduce yourself.
```

**Expected Output**:

```
🤖 Claude Code v1.0.0

Hello! I'm Claude Code, an AI programming assistant developed by Anthropic.

I can help you:
- Understand and modify code
- Execute command-line operations
- Search and analyze codebases
- Create and run tests
- Generate documentation and comments

Let me help you get started!
```

### 2.3.2 First Tool Call

**Example: Read File Content**

```
Please read the content of src/Tool.ts file.
```

**Execution Flow**:

```mermaid
sequenceDiagram
    participant User
    participant QueryEngine
    participant ToolSystem
    participant FileTool
    participant FileSystem
    
    User->>QueryEngine: "Read src/Tool.ts"
    QueryEngine->>ToolSystem: Detected file read intent
    ToolSystem->>FileTool: Call FileReadTool
    FileTool->>FileSystem: Read file
    FileSystem-->>FileTool: Return file content
    FileTool-->>ToolSystem: Return result
    ToolSystem-->>QueryEngine: Tool execution result
    QueryEngine-->>User: Display file content
```

**Expected Output**:

```
✅ Using FileReadTool to read src/Tool.ts...

// File location: src/Tool.ts
// Lines: 250 LOC

export interface Tool<Input, Output> {
  name: string
  description: string
  inputSchema: z.ZodType<Input>
  execute: (
    input: Input,
    context: ToolUseContext
  ) => AsyncGenerator<Result>
}

// ... more content
```

### 2.3.3 First Custom Command

**Slash Command Example**:

```
/help
```

**Expected Output**:

```
📖 Claude Code Command Help

Core Commands:
  /help        - Display this help information
  /clear       - Clear conversation history
  /exit        - Exit program

Configuration Commands:
  /config      - Manage configuration
  /model       - Switch AI model

Development Commands:
  /agents      - Manage agents
  /skills      - Manage skills
  /plugins     - Manage plugins

Enter "/help <command>" to view detailed help for specific commands.
```

**Configuration Management Example**:

```
/config set LOG_LEVEL debug
```

**Expected Output**:

```
✅ Configuration updated

LOG_LEVEL: info → debug

Configuration saved to ~/.claude/config.json
```

---

## 2.4 Common Issues

### Q1: What if Bun installation fails?

**Problem Symptoms**:

```bash
$ curl -fsSL https://bun.sh/install | bash
curl: (7) Failed to connect to bun.sh port 443
```

**Root Cause Analysis**:
- Network connection issues
- Firewall blocking
- DNS resolution failure

**Solutions**:

**Method 1: Use Proxy**

```bash
# Set proxy
export https_proxy=http://127.0.0.1:7890
export http_proxy=http://127.0.0.1:7890

# Reinstall
curl -fsSL https://bun.sh/install | bash
```

**Method 2: Use npm**

```bash
npm install -g bun
```

**Method 3: Manual Download**

1. Visit [Bun Releases](https://github.com/oven-sh/bun/releases)
2. Download binary suitable for your system
3. Extract and add to PATH

**Verify Installation**:

```bash
bun --version
```

### Q2: Dependency Installation Failure

**Problem Symptoms**:

```bash
$ bun install
error: package "react@18.2.0" not found
```

**Root Cause Analysis**:
- Unstable network connection
- Incorrect npm registry configuration
- Corrupted bun.lockb file

**Solutions**:

**Step 1: Clear Cache**

```bash
# Clear Bun cache
bun pm cache rm

# Clear project dependencies
rm -rf node_modules bun.lockb
```

**Step 2: Switch npm Source**

```bash
# Use Taobao mirror (Chinese users)
bun install --registry https://registry.npmmirror.com

# Or configure permanently
bun pm set config registry https://registry.npmmirror.com
```

**Step 3: Reinstall**

```bash
bun install --force
```

### Q3: API Key Configuration Error

**Problem Symptoms**:

```
[ERROR] ANTHROPIC_API_KEY not set or invalid
[ERROR] Failed to initialize QueryEngine
```

**Root Cause Analysis**:
- Environment variable not set
- Incorrect API Key format
- Expired API Key

**Solutions**:

**Step 1: Check Environment Variables**

```bash
# Linux/macOS
echo $ANTHROPIC_API_KEY

# Windows PowerShell
echo $Env:ANTHROPIC_API_KEY

# Should output your API Key
```

**Step 2: Verify API Key Format**

```bash
# API Key format: sk-ant-api03-xxxxxxxxx
# Example: sk-ant-api03-1234567890abcdef
```

**Step 3: Reconfigure**

```bash
# Edit .env file
vim .env

# Ensure:
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxx
# No quotes
# No extra spaces
```

**Step 4: Restart Application**

```bash
# Exit current run
# Ctrl+C or exit

# Restart
bun run dev
```

### Q4: Permission Issues (Windows)

**Problem Symptoms**:

```powershell
PS C:\> bun run dev
AccessDenied: Permission denied
```

**Root Cause Analysis**:
- PowerShell execution policy restrictions
- File permission issues

**Solutions**:

**Method 1: Run as Administrator**

```powershell
# Right-click PowerShell
# Select "Run as Administrator"
```

**Method 2: Modify Execution Policy**

```powershell
# View current policy
Get-ExecutionPolicy

# Change to RemoteSigned
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Method 3: Use WSL**

```bash
# Run in WSL (recommended)
wsl
cd /mnt/c/path/to/claude-code
bun run dev
```

### Q5: Port Already in Use

**Problem Symptoms**:

```
[ERROR] Port 3000 already in use
```

**Solutions**:

**Find Process Using Port**:

```bash
# Linux/macOS
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

**Terminate Process**:

```bash
# Linux/macOS
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

**Or Change Port**:

```bash
# Set environment variable
export PORT=3001

# Restart
bun run dev
```

---

## 2.5 Verify Installation

### 2.5.1 Integrity Check

Run system diagnostics:

```bash
# Run diagnostic script
bun run doctor
```

**Expected Output**:

```
🔍 Claude Code System Diagnostics

✅ Bun: 1.0.0 (OK)
✅ Node.js: 20.11.0 (OK)
✅ Git: 2.43.0 (OK)
✅ ANTHROPIC_API_KEY: Set (OK)
✅ Dependencies: All installed (OK)
✅ File Permissions: OK

Overall Status: ✅ All checks passed
```

### 2.5.2 Functional Testing

**Test 1: Basic Query**

```bash
bun run dev
```

Input:

```
What is 1 + 1?
```

Expected:

```
1 + 1 = 2
```

**Test 2: Tool Call**

Input:

```
List all files in the current directory.
```

Expected:

```
Current directory files:
- src/
- package.json
- bun.lockb
- README.md
...
```

**Test 3: Command Execution**

Input:

```
/config get LOG_LEVEL
```

Expected:

```
LOG_LEVEL: info
```

---

## 📊 Chapter Summary

### Key Points

1. **Environment Preparation**
   - Operating System: Windows/macOS/Linux/WSL
   - Required Software: Git, Bun
   - API Key: Anthropic API Key

2. **Installation Process**
   - Install Bun runtime
   - Clone Claude Code source
   - Install project dependencies
   - Configure environment variables

3. **Basic Usage**
   - Start Claude Code
   - Execute first query
   - Call first tool
   - Use first command

4. **Troubleshooting**
   - Network issues: Use proxy or mirror
   - Dependency issues: Clear cache and reinstall
   - Configuration issues: Check environment variables
   - Permission issues: Admin mode or WSL

### Learning Check

After completing this chapter, you should be able to:

- [ ] Independently set up Claude Code development environment
- [ ] Correctly configure all required environment variables
- [ ] Successfully start Claude Code and execute basic queries
- [ ] Troubleshoot and resolve common installation issues
- [ ] Understand the basic usage workflow of Claude Code

---

## 🚀 Next Steps

**Next Chapter**: [Chapter 3: Core Concepts and Terminology](../en/chapter3-concepts-EN.md)

**Learning Path**:

```
Chapter 1: Project Overview
  ↓
Chapter 2: Environment Setup (This Chapter) ✅
  ↓
Chapter 3: Core Concepts ← Next
  ↓
Chapter 4: First Application
```

**Practice Recommendations**:

After completing this chapter, it's recommended to:

1. **Familiarize Yourself with the Environment**
   - Try different queries
   - Explore available tools
   - Test various commands

2. **Optimize Configuration**
   - Adjust log levels
   - Configure shortcuts
   - Customize themes

3. **Deepen Learning**
   - Read official documentation
   - View source code
   - Join community discussions

---

## 📚 Further Reading

### Related Chapters
- **Prerequisite Chapter**: [Chapter 1: Project Overview and Background](../en/chapter1-introduction-EN.md)
- **Following Chapter**: [Chapter 3: Core Concepts and Terminology](../en/chapter3-concepts-EN.md)
- **Practical Chapter**: [Chapter 4: First Claude Application](../en/chapter4-first-app-EN.md)

### External Resources
- [Bun Official Documentation](https://bun.sh/docs)
- [Anthropic API Documentation](https://docs.anthropic.com)
- [Claude Code GitHub Repository](https://github.com/anthropics/claude-code)
- [TypeScript Official Documentation](https://www.typescriptlang.org/docs)

### Community Resources
- [Claude Code Discord](https://discord.gg/claude-code)
- [Stack Overflow - claude-code](https://stackoverflow.com/questions/tagged/claude-code)
- [Reddit - r/claudecode](https://reddit.com/r/claudecode)

---

## 🔗 Quick Reference

### Key Commands

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Clone repository
git clone https://github.com/anthropics/claude-code.git

# Install dependencies
bun install

# Development mode
bun run dev

# Build production version
bun run build

# Run diagnostics
bun run doctor
```

### Environment Variables

```bash
# API Key (required)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxx

# Log level
LOG_LEVEL=info|debug|warn|error

# Maximum concurrency
MAX_CONCURRENT_TOOLS=10
```

### Common Paths

```bash
# Configuration file
~/.claude/config.json

# Environment variables
./.env

# Log files
~/.claude/logs/
```

---

**Version**: 1.0.0  
**Last Updated**: 2026-04-03  
**Maintainer**: Claude Code Tutorial Team
