---
title: "第4章：第一个 Claude 应用"
chapter: 4
category: 入门
priority: P1
estimated_words: 4000+
dependencies: [第2章, 第3章]
language: cn
author: "Claude Code Tutorial Team"
version: 1.0.0
created: "2026-04-03"
---

# 第4章：第一个 Claude 应用

> **本章目标**：通过构建一个完整的 Claude 应用，掌握自定义工具和命令的开发流程

---

## 📚 学习目标

完成本章后，你将能够：

- [ ] 创建并配置 Claude 应用项目
- [ ] 实现自定义工具（Custom Tool）
- [ ] 实现自定义命令（Custom Command）
- [ ] 集成工具和命令到应用
- [ ] 测试和调试应用

---

## 🔑 前置知识

在阅读本章之前，建议先掌握：

- **TypeScript 基础**：类型、接口、异步函数
- **模块系统**：import/export、依赖管理
- **命令行操作**：终端使用、文件操作

**前置章节**：
- [第2章：环境搭建与快速开始](./第2章-环境搭建-CN.md)
- [第3章：核心概念与术语](./第3章-核心概念-CN.md)

**依赖关系**：
```
第2章 → 第4章（本章）
第3章 → 第4章（本章）
```

---

## 4.1 项目概述

### 4.1.1 应用目标

我们将构建一个 **代码分析助手（Code Analysis Assistant）**，具备以下功能：

1. **代码统计工具**：统计代码行数、文件数量
2. **代码搜索工具**：搜索代码中的特定模式
3. **代码质量命令**：生成代码质量报告

### 4.1.2 技术栈

- **运行时**：Bun 1.0+
- **语言**：TypeScript 5.0+
- **框架**：Claude Code SDK
- **工具**：自定义 Tool + Command

### 4.1.3 项目结构

```
code-analysis-assistant/
├── src/
│   ├── tools/
│   │   ├── CodeStatsTool.ts      # 代码统计工具
│   │   └── CodeSearchTool.ts     # 代码搜索工具
│   ├── commands/
│   │   └── QualityCommand.ts     # 质量报告命令
│   ├── index.ts                  # 入口文件
│   └── types.ts                  # 类型定义
├── package.json
├── tsconfig.json
└── bun.lockb
```

---

## 4.2 项目初始化

### 4.2.1 创建项目目录

```bash
# 创建项目目录
mkdir code-analysis-assistant
cd code-analysis-assistant

# 初始化项目
bun init -y

# 创建源代码目录
mkdir -p src/tools src/commands
```

### 4.2.2 配置 package.json

```json
{
  "name": "code-analysis-assistant",
  "version": "1.0.0",
  "description": "A Claude Code application for code analysis",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "bun build src/index.ts --outdir dist",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.3.3"
  }
}
```

### 4.2.3 配置 TypeScript

创建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["bun-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4.2.4 安装依赖

```bash
# 安装依赖
bun install

# 验证安装
bun --version
```

---

## 4.3 实现自定义工具

### 4.3.1 工具接口定义

首先定义工具的通用接口和类型：

**文件：`src/types.ts`**

```typescript
// 文件位置：src/types.ts
// 行号：1-50
// 说明：类型定义文件

import { z } from 'zod'

/**
 * 工具执行上下文
 */
export interface ToolContext {
  // 工作目录
  cwd: string
  
  // 配置选项
  options: {
    verbose?: boolean
    dryRun?: boolean
  }
}

/**
 * 工具结果
 */
export interface ToolResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 代码统计结果
 */
export interface CodeStats {
  totalFiles: number
  totalLines: number
  codeLines: number
  commentLines: number
  blankLines: number
  languages: Record<string, number>
}

/**
 * 代码搜索结果
 */
export interface SearchResult {
  file: string
  line: number
  column: number
  content: string
  context: {
    before: string[]
    after: string[]
  }
}
```

---

### 4.3.2 实现代码统计工具

**文件：`src/tools/CodeStatsTool.ts`**

```typescript
// 文件位置：src/tools/CodeStatsTool.ts
// 行号：1-150
// 说明：代码统计工具实现

import { z } from 'zod'
import { readdir, readFile } from 'fs/promises'
import { join, extname } from 'path'
import { ToolContext, ToolResult, CodeStats } from '../types.js'

/**
 * 代码统计工具
 * 
 * 功能：
 * - 统计指定目录下的代码文件数量
 * - 统计代码行数、注释行数、空白行数
 * - 按语言分类统计
 */
export const CodeStatsTool = {
  // 工具元数据
  name: 'code_stats',
  description: '统计代码文件的行数、注释数、空白行数等信息',
  
  // 输入验证模式
  inputSchema: z.object({
    directory: z.string().default('.'),         // 要统计的目录
    extensions: z.array(z.string()).default([   // 文件扩展名
      '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'
    ]),
    verbose: z.boolean().default(false)         // 详细输出
  }),
  
  /**
   * 执行代码统计
   * 
   * @param input - 输入参数
   * @param context - 工具上下文
   * @returns 异步生成器，逐步返回统计结果
   */
  async *execute(
    input: z.infer<typeof CodeStatsTool.inputSchema>,
    context: ToolContext
  ): AsyncGenerator<ToolResult<Partial<CodeStats> | CodeStats>> {
    try {
      const { directory, extensions, verbose } = input
      const targetDir = join(context.cwd, directory)
      
      // 发送进度更新
      yield {
        success: true,
        data: { status: 'scanning', message: `扫描目录: ${targetDir}` }
      }
      
      // 获取所有文件
      const files = await getAllFiles(targetDir, extensions)
      
      yield {
        success: true,
        data: { 
          status: 'counting', 
          message: `找到 ${files.length} 个文件`,
          totalFiles: files.length
        }
      }
      
      // 统计每个文件
      const stats: CodeStats = {
        totalFiles: files.length,
        totalLines: 0,
        codeLines: 0,
        commentLines: 0,
        blankLines: 0,
        languages: {}
      }
      
      for (const file of files) {
        const fileStats = await countFile(file)
        
        stats.totalLines += fileStats.total
        stats.codeLines += fileStats.code
        stats.commentLines += fileStats.comment
        stats.blankLines += fileStats.blank
        
        // 按语言分类
        const ext = extname(file).slice(1)
        stats.languages[ext] = (stats.languages[ext] || 0) + 1
        
        if (verbose) {
          yield {
            success: true,
            data: {
              file,
              stats: fileStats
            }
          }
        }
      }
      
      // 返回最终结果
      yield {
        success: true,
        data: stats
      }
      
    } catch (error) {
      yield {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

/**
 * 获取目录下所有符合扩展名的文件
 */
async function getAllFiles(
  dir: string,
  extensions: string[]
): Promise<string[]> {
  const files: string[] = []
  
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      
      if (entry.isDirectory()) {
        // 递归处理子目录（跳过 node_modules）
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          const subFiles = await getAllFiles(fullPath, extensions)
          files.push(...subFiles)
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name)
        if (extensions.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch (error) {
    // 忽略无法访问的目录
  }
  
  return files
}

/**
 * 统计单个文件的行数
 */
async function countFile(filePath: string) {
  const content = await readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  
  let code = 0
  let comment = 0
  let blank = 0
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    if (trimmed.length === 0) {
      blank++
    } else if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
      comment++
    } else {
      code++
    }
  }
  
  return {
    total: lines.length,
    code,
    comment,
    blank
  }
}
```

---

### 4.3.3 实现代码搜索工具

**文件：`src/tools/CodeSearchTool.ts`**

```typescript
// 文件位置：src/tools/CodeSearchTool.ts
// 行号：1-120
// 说明：代码搜索工具实现

import { z } from 'zod'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { ToolContext, ToolResult, SearchResult } from '../types.js'

/**
 * 代码搜索工具
 * 
 * 功能：
 * - 在指定目录搜索代码模式
 * - 支持正则表达式搜索
 * - 提供上下文行
 */
export const CodeSearchTool = {
  name: 'code_search',
  description: '在代码文件中搜索特定的模式或字符串',
  
  inputSchema: z.object({
    pattern: z.string(),                    // 搜索模式
    directory: z.string().default('.'),     // 搜索目录
    extensions: z.array(z.string()).default([ // 文件扩展名
      '.ts', '.tsx', '.js', '.jsx'
    ]),
    caseSensitive: z.boolean().default(false), // 区分大小写
    contextLines: z.number().min(0).max(5).default(2), // 上下文行数
    maxResults: z.number().min(1).max(100).default(50) // 最大结果数
  }),
  
  async *execute(
    input: z.infer<typeof CodeSearchTool.inputSchema>,
    context: ToolContext
  ): AsyncGenerator<ToolResult<SearchResult[] | SearchResult>> {
    try {
      const { 
        pattern, 
        directory, 
        extensions, 
        caseSensitive,
        contextLines,
        maxResults
      } = input
      
      // 构建正则表达式
      const flags = caseSensitive ? 'g' : 'gi'
      const regex = new RegExp(pattern, flags)
      
      const targetDir = join(context.cwd, directory)
      
      yield {
        success: true,
        data: { status: 'searching', pattern }
      }
      
      // 获取所有文件
      const files = await getAllFiles(targetDir, extensions)
      
      const results: SearchResult[] = []
      
      for (const file of files) {
        if (results.length >= maxResults) break
        
        const content = await readFile(file, 'utf-8')
        const lines = content.split('\n')
        
        // 搜索匹配
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) break
          
          const line = lines[i]
          if (regex.test(line)) {
            // 计算列位置
            const match = line.match(regex)
            const column = match ? line.indexOf(match[0]) : 0
            
            // 获取上下文
            const contextBefore = lines.slice(
              Math.max(0, i - contextLines),
              i
            )
            const contextAfter = lines.slice(
              i + 1,
              Math.min(lines.length, i + contextLines + 1)
            )
            
            results.push({
              file,
              line: i + 1,
              column,
              content: line.trim(),
              context: {
                before: contextBefore,
                after: contextAfter
              }
            })
          }
        }
        
        // 实时返回结果
        if (results.length > 0 && results.length % 10 === 0) {
          yield {
            success: true,
            data: [...results]
          }
        }
      }
      
      // 返回最终结果
      yield {
        success: true,
        data: results
      }
      
    } catch (error) {
      yield {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

/**
 * 获取目录下所有符合扩展名的文件（复用实现）
 */
async function getAllFiles(
  dir: string,
  extensions: string[]
): Promise<string[]> {
  const files: string[] = []
  
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          const subFiles = await getAllFiles(fullPath, extensions)
          files.push(...subFiles)
        }
      } else if (entry.isFile()) {
        const ext = require('path').extname(entry.name)
        if (extensions.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch (error) {
    // 忽略无法访问的目录
  }
  
  return files
}
```

---

## 4.4 实现自定义命令

### 4.4.1 命令接口定义

**文件：`src/commands/types.ts`**

```typescript
// 文件位置：src/commands/types.ts
// 行号：1-40
// 说明：命令类型定义

import { z } from 'zod'

/**
 * 命令上下文
 */
export interface CommandContext {
  cwd: string
  args: string[]
  verbose?: boolean
}

/**
 * 命令接口
 */
export interface Command {
  name: string                    // 命令名称
  description: string             // 命令描述
  parameters?: z.ZodType         // 参数验证
  execute: (params: any, context: CommandContext) => Promise<void>
}
```

---

### 4.4.2 实现代码质量命令

**文件：`src/commands/QualityCommand.ts`**

```typescript
// 文件位置：src/commands/QualityCommand.ts
// 行号：1-100
// 说明：代码质量报告命令

import { z } from 'zod'
import { CommandContext } from './types.js'
import { CodeStatsTool } from '../tools/CodeStatsTool.js'

/**
 * 代码质量报告命令
 * 
 * 功能：
 * - 生成代码质量报告
 * - 分析代码复杂度指标
 * - 提供改进建议
 */
export const QualityCommand: Command = {
  name: 'quality',
  description: '生成代码质量报告，包括代码统计、复杂度分析和改进建议',
  
  // 参数验证
  parameters: z.object({
    directory: z.string().default('.'),
    output: z.enum(['console', 'json', 'markdown']).default('console'),
    verbose: z.boolean().default(false)
  }),
  
  /**
   * 执行命令
   */
  async execute(
    params: z.infer<typeof QualityCommand.parameters>,
    context: CommandContext
  ) {
    try {
      const { directory, output, verbose } = params
      
      console.log('📊 正在生成代码质量报告...\n')
      
      // 执行代码统计
      const statsTool = new CodeStatsTool()
      const results: any[] = []
      
      for await (const result of statsTool.execute(
        { directory, verbose },
        { cwd: context.cwd, options: {} }
      )) {
        if (result.success && result.data) {
          results.push(result.data)
        }
      }
      
      // 获取最终统计
      const stats = results[results.length - 1]
      
      if (!stats) {
        console.error('❌ 无法获取代码统计信息')
        return
      }
      
      // 生成报告
      const report = generateReport(stats)
      
      // 输出报告
      if (output === 'console') {
        console.log(report.console)
      } else if (output === 'json') {
        console.log(JSON.stringify(report.json, null, 2))
      } else if (output === 'markdown') {
        console.log(report.markdown)
      }
      
      console.log('\n✅ 代码质量报告生成完成')
      
    } catch (error) {
      console.error('❌ 生成报告时出错:', error)
    }
  }
}

/**
 * 生成质量报告
 */
function generateReport(stats: any) {
  const avgLinesPerFile = Math.round(stats.totalLines / stats.totalFiles)
  const commentRatio = ((stats.commentLines / stats.totalLines) * 100).toFixed(1)
  
  // 计算代码质量评分
  let score = 100
  if (commentRatio < 10) score -= 10
  if (commentRatio > 30) score -= 5
  if (avgLinesPerFile > 500) score -= 15
  if (avgLinesPerFile > 1000) score -= 20
  
  // 控制台报告
  const consoleReport = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        代码质量报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 文件统计
  总文件数: ${stats.totalFiles}
  总行数: ${stats.totalLines}
  平均每文件: ${avgLinesPerFile} 行

📝 代码分布
  代码行: ${stats.codeLines} (${((stats.codeLines/stats.totalLines)*100).toFixed(1)}%)
  注释行: ${stats.commentLines} (${commentRatio}%)
  空白行: ${stats.blankLines} (${((stats.blankLines/stats.totalLines)*100).toFixed(1)}%)

🌐 语言分布
${Object.entries(stats.languages)
  .map(([lang, count]) => `  ${lang}: ${count} 个文件`)
  .join('\n')}

⭐ 质量评分: ${score}/100

${getRecommendations(score, commentRatio, avgLinesPerFile)}
`
  
  return {
    console: consoleReport,
    json: stats,
    markdown: consoleReport // 简化实现
  }
}

/**
 * 获取改进建议
 */
function getRecommendations(score: number, commentRatio: string, avgLinesPerFile: number) {
  const recommendations: string[] = []
  
  if (parseFloat(commentRatio) < 10) {
    recommendations.push('⚠️  注释比例过低，建议增加代码注释')
  }
  
  if (avgLinesPerFile > 500) {
    recommendations.push('⚠️  文件过大，建议拆分模块')
  }
  
  if (score >= 80) {
    recommendations.push('✅ 代码质量良好，继续保持！')
  }
  
  return recommendations.length > 0
    ? '\n💡 改进建议\n' + recommendations.join('\n')
    : ''
}
```

---

## 4.5 应用集成

### 4.5.1 创建入口文件

**文件：`src/index.ts`**

```typescript
// 文件位置：src/index.ts
// 行号：1-80
// 说明：应用入口文件

import { CodeStatsTool } from './tools/CodeStatsTool.js'
import { CodeSearchTool } from './tools/CodeSearchTool.js'
import { QualityCommand } from './commands/QualityCommand.js'

/**
 * Code Analysis Assistant
 * 
 * 一个用于代码分析的 Claude Code 应用
 */
class CodeAnalysisAssistant {
  private tools: Map<string, any>
  private commands: Map<string, any>
  
  constructor() {
    this.tools = new Map()
    this.commands = new Map()
    
    this.registerTools()
    this.registerCommands()
  }
  
  /**
   * 注册工具
   */
  private registerTools() {
    this.tools.set('code_stats', CodeStatsTool)
    this.tools.set('code_search', CodeSearchTool)
    
    console.log(`✅ 已注册 ${this.tools.size} 个工具`)
  }
  
  /**
   * 注册命令
   */
  private registerCommands() {
    this.commands.set('quality', QualityCommand)
    
    console.log(`✅ 已注册 ${this.commands.size} 个命令`)
  }
  
  /**
   * 获取工具
   */
  getTool(name: string) {
    return this.tools.get(name)
  }
  
  /**
   * 获取命令
   */
  getCommand(name: string) {
    return this.commands.get(name)
  }
  
  /**
   * 列出所有工具
   */
  listTools() {
    console.log('\n📦 可用工具:')
    for (const [name, tool] of this.tools) {
      console.log(`  - ${name}: ${tool.description}`)
    }
  }
  
  /**
   * 列出所有命令
   */
  listCommands() {
    console.log('\n🔧 可用命令:')
    for (const [name, command] of this.commands) {
      console.log(`  - ${name}: ${command.description}`)
    }
  }
}

// 主函数
async function main() {
  console.log('🚀 Code Analysis Assistant v1.0.0\n')
  
  const assistant = new CodeAnalysisAssistant()
  
  // 显示可用工具和命令
  assistant.listTools()
  assistant.listCommands()
  
  console.log('\n💡 使用示例:')
  console.log('  const statsTool = assistant.getTool("code_stats")')
  console.log('  const qualityCmd = assistant.getCommand("quality")')
  console.log('\n✅ 应用初始化完成')
}

// 运行主函数
main().catch(console.error)
```

---

## 4.6 测试应用

### 4.6.1 运行应用

```bash
# 开发模式运行
bun run dev

# 预期输出：
# 🚀 Code Analysis Assistant v1.0.0
#
# ✅ 已注册 2 个工具
# ✅ 已注册 1 个命令
#
# 📦 可用工具:
#   - code_stats: 统计代码文件的行数、注释数、空白行数等信息
#   - code_search: 在代码文件中搜索特定的模式或字符串
#
# 🔧 可用命令:
#   - quality: 生成代码质量报告
#
# 💡 使用示例:
#   const statsTool = assistant.getTool("code_stats")
#   const qualityCmd = assistant.getCommand("quality")
#
# ✅ 应用初始化完成
```

### 4.6.2 测试代码统计工具

创建测试脚本 `test-stats.ts`：

```typescript
// 文件位置：test-stats.ts
// 说明：测试代码统计工具

import { CodeStatsTool } from './src/tools/CodeStatsTool.js'

async function testStatsTool() {
  console.log('🧪 测试代码统计工具\n')
  
  const tool = new CodeStatsTool()
  
  for await (const result of tool.execute(
    { directory: './src', verbose: true },
    { cwd: process.cwd(), options: {} }
  )) {
    if (result.success) {
      console.log('✅', result.data)
    } else {
      console.error('❌', result.error)
    }
  }
}

testStatsTool()
```

运行测试：

```bash
bun run test-stats.ts
```

### 4.6.3 测试代码搜索工具

创建测试脚本 `test-search.ts`：

```typescript
// 文件位置：test-search.ts
// 说明：测试代码搜索工具

import { CodeSearchTool } from './src/tools/CodeSearchTool.js'

async function testSearchTool() {
  console.log('🧪 测试代码搜索工具\n')
  
  const tool = new CodeSearchTool()
  
  for await (const result of tool.execute(
    { 
      pattern: 'function|async|export',
      directory: './src',
      caseSensitive: false,
      contextLines: 2
    },
    { cwd: process.cwd(), options: {} }
  )) {
    if (result.success) {
      console.log('✅ 找到匹配:', Array.isArray(result.data) ? result.data.length : 1)
      if (Array.isArray(result.data) && result.data.length > 0) {
        console.log('示例结果:', result.data[0])
      }
    } else {
      console.error('❌', result.error)
    }
  }
}

testSearchTool()
```

运行测试：

```bash
bun run test-search.ts
```

---

## 4.7 调试方法

### 4.7.1 使用 TypeScript 编译检查

```bash
# 类型检查
bun run type-check

# 修复类型错误后继续
```

### 4.7.2 使用调试器

在 VS Code 中创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Bun",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["run", "src/index.ts"],
      "cwd": "${workspaceFolder}",
      "internalConsoleOptions": "openOnSessionStart"
    }
  ]
}
```

### 4.7.3 添加日志

```typescript
// 在关键位置添加日志
console.log('[DEBUG] Input:', input)
console.log('[DEBUG] Context:', context)
console.log('[DEBUG] Result:', result)
```

### 4.7.4 错误处理

```typescript
// 改进错误处理
try {
  // 操作
} catch (error) {
  if (error instanceof Error) {
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
  } else {
    console.error('Unknown error:', error)
  }
}
```

---

## 4.8 最佳实践

### 4.8.1 工具设计原则

1. **单一职责**：每个工具只做一件事
2. **输入验证**：使用 Zod 验证输入
3. **流式输出**：使用 AsyncGenerator 逐步返回结果
4. **错误处理**：优雅处理错误，提供有用的错误信息

### 4.8.2 命令设计原则

1. **清晰命名**：使用动词开头，如 `quality`, `search`
2. **参数验证**：验证所有输入参数
3. **输出格式**：支持多种输出格式（console、json、markdown）
4. **进度反馈**：提供执行进度反馈

### 4.8.3 代码组织

1. **模块化**：按功能组织代码
2. **类型安全**：充分利用 TypeScript 类型系统
3. **文档注释**：为导出的函数和类添加注释
4. **测试驱动**：先写测试，再写实现

---

## 📊 本章小结

### 核心要点

1. **项目初始化**
   - 配置 package.json 和 tsconfig.json
   - 创建项目目录结构
   - 安装必要依赖

2. **工具开发**
   - 实现 Tool 接口
   - 使用 Zod 验证输入
   - 使用 AsyncGenerator 流式输出
   - 处理错误和异常

3. **命令开发**
   - 实现 Command 接口
   - 参数验证和执行逻辑
   - 多种输出格式支持

4. **集成测试**
   - 单元测试工具
   - 集成测试应用
   - 调试和优化

### 学习检查

完成本章后，你应该能够：

- [ ] 创建 Claude Code 应用项目
- [ ] 实现自定义工具
- [ ] 实现自定义命令
- [ ] 测试和调试应用
- [ ] 遵循最佳实践

---

## 🚀 下一步

**下一章**：[第5章：QueryEngine 详解](./第5章-QueryEngine详解-CN.md)

**学习路径**：

```
第1-3章：基础知识和概念
  ↓
第4章：第一个应用（本章）✅
  ↓
第5章：QueryEngine 详解 ← 下一章
  ↓
第6章：BashTool 与命令执行
```

**实践建议**：

1. **扩展功能**
   - 添加更多工具（代码重复检测、依赖分析）
   - 添加更多命令（格式化、重构）
   - 支持更多编程语言

2. **优化改进**
   - 性能优化（并行处理、缓存）
   - 用户体验（彩色输出、进度条）
   - 错误处理（更详细的错误信息）

3. **发布分享**
   - 编写完整文档
   - 添加单元测试
   - 发布到 npm

---

## 📚 扩展阅读

### 相关章节
- **前置章节**：[第3章：核心概念与术语](./第3章-核心概念-CN.md)
- **后续章节**：[第5章：QueryEngine 详解](./第5章-QueryEngine详解-CN.md)
- **实战章节**：[第22章：综合实战项目](./第22章-综合实战项目-CN.md)

### 外部资源
- [TypeScript 手册](https://www.typescriptlang.org/docs)
- [Zod 文档](https://zod.dev)
- [Bun 文档](https://bun.sh/docs)
- [Node.js 文档](https://nodejs.org/docs)

---

## 🔗 快速参考

### 项目结构

```
code-analysis-assistant/
├── src/
│   ├── tools/
│   │   ├── CodeStatsTool.ts
│   │   └── CodeSearchTool.ts
│   ├── commands/
│   │   └── QualityCommand.ts
│   ├── index.ts
│   └── types.ts
├── package.json
├── tsconfig.json
└── bun.lockb
```

### 关键命令

```bash
# 初始化项目
bun init -y

# 安装依赖
bun install

# 开发运行
bun run dev

# 类型检查
bun run type-check

# 构建
bun run build
```

### 工具接口

```typescript
const tool = {
  name: 'tool_name',
  description: 'Tool description',
  inputSchema: z.object({}),
  async *execute(input, context) {
    yield { success: true, data: '...' }
  }
}
```

### 命令接口

```typescript
const command = {
  name: 'command_name',
  description: 'Command description',
  parameters: z.object({}),
  async execute(params, context) {
    // 实现
  }
}
```

---

**版本**: 1.0.0  
**最后更新**: 2026-04-03  
**维护者**: Claude Code Tutorial Team
