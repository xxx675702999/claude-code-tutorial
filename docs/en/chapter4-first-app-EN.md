---
title: "Chapter 4: First Claude Application"
chapter: 4
category: Introduction
priority: P1
estimated_words: 4000+
dependencies: [Chapter 2, Chapter 3]
language: en
author: "Claude Code Tutorial Team"
version: 1.0.0
created: "2026-04-03"
---

# Chapter 4: First Claude Application

> **Chapter Goal**: Build a complete Claude application to master the development workflow of custom tools and commands

---

## 📚 Learning Objectives

After completing this chapter, you will be able to:

- [ ] Create and configure a Claude application project
- [ ] Implement custom tools
- [ ] Implement custom commands
- [ ] Integrate tools and commands into the application
- [ ] Test and debug the application

---

## 🔑 Prerequisites

Before reading this chapter, it's recommended to master:

- **TypeScript Basics**: Types, interfaces, async functions
- **Module System**: import/export, dependency management
- **Command Line Operations**: Terminal usage, file operations

**Prerequisite Chapters**:
- [Chapter 2: Environment Setup and Quick Start](../en/chapter2-setup-EN.md)
- [Chapter 3: Core Concepts and Terminology](../en/chapter3-concepts-EN.md)

**Dependencies**:
```
Chapter 2 → Chapter 4 (This Chapter)
Chapter 3 → Chapter 4 (This Chapter)
```

---

## 4.1 Project Overview

### 4.1.1 Application Goal

We will build a **Code Analysis Assistant** with the following capabilities:

1. **Code Statistics Tool**: Count lines of code, number of files
2. **Code Search Tool**: Search for specific patterns in code
3. **Code Quality Command**: Generate code quality reports

### 4.1.2 Tech Stack

- **Runtime**: Bun 1.0+
- **Language**: TypeScript 5.0+
- **Framework**: Claude Code SDK
- **Tools**: Custom Tool + Command

### 4.1.3 Project Structure

```
code-analysis-assistant/
├── src/
│   ├── tools/
│   │   ├── CodeStatsTool.ts      # Code statistics tool
│   │   └── CodeSearchTool.ts     # Code search tool
│   ├── commands/
│   │   └── QualityCommand.ts     # Quality report command
│   ├── index.ts                  # Entry file
│   └── types.ts                  # Type definitions
├── package.json
├── tsconfig.json
└── bun.lockb
```

---

## 4.2 Project Initialization

### 4.2.1 Create Project Directory

```bash
# Create project directory
mkdir code-analysis-assistant
cd code-analysis-assistant

# Initialize project
bun init -y

# Create source code directories
mkdir -p src/tools src/commands
```

### 4.2.2 Configure package.json

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

### 4.2.3 Configure TypeScript

Create `tsconfig.json`:

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

### 4.2.4 Install Dependencies

```bash
# Install dependencies
bun install

# Verify installation
bun --version
```

---

## 4.3 Implement Custom Tools

### 4.3.1 Tool Interface Definition

First, define common interfaces and types for tools:

**File: `src/types.ts`**

```typescript
// File location: src/types.ts
// Lines: 1-50
// Description: Type definitions file

import { z } from 'zod'

/**
 * Tool execution context
 */
export interface ToolContext {
  // Working directory
  cwd: string
  
  // Configuration options
  options: {
    verbose?: boolean
    dryRun?: boolean
  }
}

/**
 * Tool result
 */
export interface ToolResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Code statistics result
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
 * Code search result
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

### 4.3.2 Implement Code Statistics Tool

**File: `src/tools/CodeStatsTool.ts`**

```typescript
// File location: src/tools/CodeStatsTool.ts
// Lines: 1-150
// Description: Code statistics tool implementation

import { z } from 'zod'
import { readdir, readFile } from 'fs/promises'
import { join, extname } from 'path'
import { ToolContext, ToolResult, CodeStats } from '../types.js'

/**
 * Code Statistics Tool
 * 
 * Features:
 * - Count code files in specified directory
 * - Count code lines, comment lines, blank lines
 * - Statistics by language
 */
export const CodeStatsTool = {
  // Tool metadata
  name: 'code_stats',
  description: 'Count lines of code, comments, and blank lines in code files',
  
  // Input validation schema
  inputSchema: z.object({
    directory: z.string().default('.'),         // Directory to count
    extensions: z.array(z.string()).default([   // File extensions
      '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'
    ]),
    verbose: z.boolean().default(false)         // Verbose output
  }),
  
  /**
   * Execute code statistics
   * 
   * @param input - Input parameters
   * @param context - Tool context
   * @returns Async generator, gradually returns statistics
   */
  async *execute(
    input: z.infer<typeof CodeStatsTool.inputSchema>,
    context: ToolContext
  ): AsyncGenerator<ToolResult<Partial<CodeStats> | CodeStats>> {
    try {
      const { directory, extensions, verbose } = input
      const targetDir = join(context.cwd, directory)
      
      // Send progress update
      yield {
        success: true,
        data: { status: 'scanning', message: `Scanning directory: ${targetDir}` }
      }
      
      // Get all files
      const files = await getAllFiles(targetDir, extensions)
      
      yield {
        success: true,
        data: { 
          status: 'counting', 
          message: `Found ${files.length} files`,
          totalFiles: files.length
        }
      }
      
      // Count each file
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
        
        // Classify by language
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
      
      // Return final result
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
 * Get all files with matching extensions in directory
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
        // Recursively process subdirectories (skip node_modules)
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
    // Ignore inaccessible directories
  }
  
  return files
}

/**
 * Count lines in a single file
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

### 4.3.3 Implement Code Search Tool

**File: `src/tools/CodeSearchTool.ts`**

```typescript
// File location: src/tools/CodeSearchTool.ts
// Lines: 1-120
// Description: Code search tool implementation

import { z } from 'zod'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { ToolContext, ToolResult, SearchResult } from '../types.js'

/**
 * Code Search Tool
 * 
 * Features:
 * - Search for code patterns in specified directory
 * - Support regular expression search
 * - Provide context lines
 */
export const CodeSearchTool = {
  name: 'code_search',
  description: 'Search for specific patterns or strings in code files',
  
  inputSchema: z.object({
    pattern: z.string(),                    // Search pattern
    directory: z.string().default('.'),     // Search directory
    extensions: z.array(z.string()).default([ // File extensions
      '.ts', '.tsx', '.js', '.jsx'
    ]),
    caseSensitive: z.boolean().default(false), // Case sensitive
    contextLines: z.number().min(0).max(5).default(2), // Context lines
    maxResults: z.number().min(1).max(100).default(50) // Max results
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
      
      // Build regex
      const flags = caseSensitive ? 'g' : 'gi'
      const regex = new RegExp(pattern, flags)
      
      const targetDir = join(context.cwd, directory)
      
      yield {
        success: true,
        data: { status: 'searching', pattern }
      }
      
      // Get all files
      const files = await getAllFiles(targetDir, extensions)
      
      const results: SearchResult[] = []
      
      for (const file of files) {
        if (results.length >= maxResults) break
        
        const content = await readFile(file, 'utf-8')
        const lines = content.split('\n')
        
        // Search for matches
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) break
          
          const line = lines[i]
          if (regex.test(line)) {
            // Calculate column position
            const match = line.match(regex)
            const column = match ? line.indexOf(match[0]) : 0
            
            // Get context
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
        
        // Return results in real-time
        if (results.length > 0 && results.length % 10 === 0) {
          yield {
            success: true,
            data: [...results]
          }
        }
      }
      
      // Return final result
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
 * Get all files with matching extensions (reuse implementation)
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
    // Ignore inaccessible directories
  }
  
  return files
}
```

---

## 4.4 Implement Custom Commands

### 4.4.1 Command Interface Definition

**File: `src/commands/types.ts`**

```typescript
// File location: src/commands/types.ts
// Lines: 1-40
// Description: Command type definitions

import { z } from 'zod'

/**
 * Command context
 */
export interface CommandContext {
  cwd: string
  args: string[]
  verbose?: boolean
}

/**
 * Command interface
 */
export interface Command {
  name: string                    // Command name
  description: string             // Command description
  parameters?: z.ZodType         // Parameter validation
  execute: (params: any, context: CommandContext) => Promise<void>
}
```

---

### 4.4.2 Implement Code Quality Command

**File: `src/commands/QualityCommand.ts`**

```typescript
// File location: src/commands/QualityCommand.ts
// Lines: 1-100
// Description: Code quality report command

import { z } from 'zod'
import { CommandContext } from './types.js'
import { CodeStatsTool } from '../tools/CodeStatsTool.js'

/**
 * Code Quality Report Command
 * 
 * Features:
 * - Generate code quality report
 * - Analyze code complexity metrics
 * - Provide improvement suggestions
 */
export const QualityCommand: Command = {
  name: 'quality',
  description: 'Generate code quality report including statistics, complexity analysis, and improvement suggestions',
  
  // Parameter validation
  parameters: z.object({
    directory: z.string().default('.'),
    output: z.enum(['console', 'json', 'markdown']).default('console'),
    verbose: z.boolean().default(false)
  }),
  
  /**
   * Execute command
   */
  async execute(
    params: z.infer<typeof QualityCommand.parameters>,
    context: CommandContext
  ) {
    try {
      const { directory, output, verbose } = params
      
      console.log('📊 Generating code quality report...\n')
      
      // Execute code statistics
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
      
      // Get final statistics
      const stats = results[results.length - 1]
      
      if (!stats) {
        console.error('❌ Unable to get code statistics')
        return
      }
      
      // Generate report
      const report = generateReport(stats)
      
      // Output report
      if (output === 'console') {
        console.log(report.console)
      } else if (output === 'json') {
        console.log(JSON.stringify(report.json, null, 2))
      } else if (output === 'markdown') {
        console.log(report.markdown)
      }
      
      console.log('\n✅ Code quality report generated')
      
    } catch (error) {
      console.error('❌ Error generating report:', error)
    }
  }
}

/**
 * Generate quality report
 */
function generateReport(stats: any) {
  const avgLinesPerFile = Math.round(stats.totalLines / stats.totalFiles)
  const commentRatio = ((stats.commentLines / stats.totalLines) * 100).toFixed(1)
  
  // Calculate code quality score
  let score = 100
  if (commentRatio < 10) score -= 10
  if (commentRatio > 30) score -= 5
  if (avgLinesPerFile > 500) score -= 15
  if (avgLinesPerFile > 1000) score -= 20
  
  // Console report
  const consoleReport = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        Code Quality Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 File Statistics
  Total Files: ${stats.totalFiles}
  Total Lines: ${stats.totalLines}
  Avg per File: ${avgLinesPerFile} lines

📝 Code Distribution
  Code Lines: ${stats.codeLines} (${((stats.codeLines/stats.totalLines)*100).toFixed(1)}%)
  Comment Lines: ${stats.commentLines} (${commentRatio}%)
  Blank Lines: ${stats.blankLines} (${((stats.blankLines/stats.totalLines)*100).toFixed(1)}%)

🌐 Language Distribution
${Object.entries(stats.languages)
  .map(([lang, count]) => `  ${lang}: ${count} files`)
  .join('\n')}

⭐ Quality Score: ${score}/100

${getRecommendations(score, commentRatio, avgLinesPerFile)}
`
  
  return {
    console: consoleReport,
    json: stats,
    markdown: consoleReport // Simplified implementation
  }
}

/**
 * Get improvement suggestions
 */
function getRecommendations(score: number, commentRatio: string, avgLinesPerFile: number) {
  const recommendations: string[] = []
  
  if (parseFloat(commentRatio) < 10) {
    recommendations.push('⚠️  Low comment ratio, consider adding more code comments')
  }
  
  if (avgLinesPerFile > 500) {
    recommendations.push('⚠️  Files are too large, consider splitting modules')
  }
  
  if (score >= 80) {
    recommendations.push('✅ Good code quality, keep it up!')
  }
  
  return recommendations.length > 0
    ? '\n💡 Improvement Suggestions\n' + recommendations.join('\n')
    : ''
}
```

---

## 4.5 Application Integration

### 4.5.1 Create Entry File

**File: `src/index.ts`**

```typescript
// File location: src/index.ts
// Lines: 1-80
// Description: Application entry file

import { CodeStatsTool } from './tools/CodeStatsTool.js'
import { CodeSearchTool } from './tools/CodeSearchTool.js'
import { QualityCommand } from './commands/QualityCommand.js'

/**
 * Code Analysis Assistant
 * 
 * A Claude Code application for code analysis
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
   * Register tools
   */
  private registerTools() {
    this.tools.set('code_stats', CodeStatsTool)
    this.tools.set('code_search', CodeSearchTool)
    
    console.log(`✅ Registered ${this.tools.size} tools`)
  }
  
  /**
   * Register commands
   */
  private registerCommands() {
    this.commands.set('quality', QualityCommand)
    
    console.log(`✅ Registered ${this.commands.size} commands`)
  }
  
  /**
   * Get tool
   */
  getTool(name: string) {
    return this.tools.get(name)
  }
  
  /**
   * Get command
   */
  getCommand(name: string) {
    return this.commands.get(name)
  }
  
  /**
   * List all tools
   */
  listTools() {
    console.log('\n📦 Available Tools:')
    for (const [name, tool] of this.tools) {
      console.log(`  - ${name}: ${tool.description}`)
    }
  }
  
  /**
   * List all commands
   */
  listCommands() {
    console.log('\n🔧 Available Commands:')
    for (const [name, command] of this.commands) {
      console.log(`  - ${name}: ${command.description}`)
    }
  }
}

// Main function
async function main() {
  console.log('🚀 Code Analysis Assistant v1.0.0\n')
  
  const assistant = new CodeAnalysisAssistant()
  
  // Display available tools and commands
  assistant.listTools()
  assistant.listCommands()
  
  console.log('\n💡 Usage Examples:')
  console.log('  const statsTool = assistant.getTool("code_stats")')
  console.log('  const qualityCmd = assistant.getCommand("quality")')
  console.log('\n✅ Application initialized')
}

// Run main function
main().catch(console.error)
```

---

## 4.6 Testing Application

### 4.6.1 Run Application

```bash
# Run in development mode
bun run dev

# Expected output:
# 🚀 Code Analysis Assistant v1.0.0
#
# ✅ Registered 2 tools
# ✅ Registered 1 commands
#
# 📦 Available Tools:
#   - code_stats: Count lines of code, comments, and blank lines in code files
#   - code_search: Search for specific patterns or strings in code files
#
# 🔧 Available Commands:
#   - quality: Generate code quality report
#
# 💡 Usage Examples:
#   const statsTool = assistant.getTool("code_stats")
#   const qualityCmd = assistant.getCommand("quality")
#
# ✅ Application initialized
```

### 4.6.2 Test Code Statistics Tool

Create test script `test-stats.ts`:

```typescript
// File location: test-stats.ts
// Description: Test code statistics tool

import { CodeStatsTool } from './src/tools/CodeStatsTool.js'

async function testStatsTool() {
  console.log('🧪 Testing Code Statistics Tool\n')
  
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

Run test:

```bash
bun run test-stats.ts
```

### 4.6.3 Test Code Search Tool

Create test script `test-search.ts`:

```typescript
// File location: test-search.ts
// Description: Test code search tool

import { CodeSearchTool } from './src/tools/CodeSearchTool.js'

async function testSearchTool() {
  console.log('🧪 Testing Code Search Tool\n')
  
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
      console.log('✅ Found matches:', Array.isArray(result.data) ? result.data.length : 1)
      if (Array.isArray(result.data) && result.data.length > 0) {
        console.log('Sample result:', result.data[0])
      }
    } else {
      console.error('❌', result.error)
    }
  }
}

testSearchTool()
```

Run test:

```bash
bun run test-search.ts
```

---

## 4.7 Debugging Methods

### 4.7.1 Use TypeScript Compilation Check

```bash
# Type checking
bun run type-check

# Continue after fixing type errors
```

### 4.7.2 Use Debugger

Create `.vscode/launch.json` in VS Code:

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

### 4.7.3 Add Logging

```typescript
// Add logs at key locations
console.log('[DEBUG] Input:', input)
console.log('[DEBUG] Context:', context)
console.log('[DEBUG] Result:', result)
```

### 4.7.4 Error Handling

```typescript
// Improve error handling
try {
  // Operation
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

## 4.8 Best Practices

### 4.8.1 Tool Design Principles

1. **Single Responsibility**: Each tool does one thing
2. **Input Validation**: Use Zod to validate inputs
3. **Streaming Output**: Use AsyncGenerator to gradually return results
4. **Error Handling**: Gracefully handle errors with useful error messages

### 4.8.2 Command Design Principles

1. **Clear Naming**: Start with verbs, like `quality`, `search`
2. **Parameter Validation**: Validate all input parameters
3. **Output Formats**: Support multiple output formats (console, json, markdown)
4. **Progress Feedback**: Provide execution progress feedback

### 4.8.3 Code Organization

1. **Modularization**: Organize code by functionality
2. **Type Safety**: Leverage TypeScript's type system
3. **Documentation Comments**: Add comments for exported functions and classes
4. **Test-Driven**: Write tests first, then implement

---

## 📊 Chapter Summary

### Key Points

1. **Project Initialization**
   - Configure package.json and tsconfig.json
   - Create project directory structure
   - Install necessary dependencies

2. **Tool Development**
   - Implement Tool interface
   - Use Zod for input validation
   - Use AsyncGenerator for streaming output
   - Handle errors and exceptions

3. **Command Development**
   - Implement Command interface
   - Parameter validation and execution logic
   - Multiple output format support

4. **Integration Testing**
   - Unit test tools
   - Integration test application
   - Debug and optimize

### Learning Check

After completing this chapter, you should be able to:

- [ ] Create Claude Code application projects
- [ ] Implement custom tools
- [ ] Implement custom commands
- [ ] Test and debug applications
- [ ] Follow best practices

---

## 🚀 Next Steps

**Next Chapter**: [Chapter 5: QueryEngine Deep Dive](../en/chapter5-queryengine-EN.md)

**Learning Path**:

```
Chapters 1-3: Basics and Concepts
  ↓
Chapter 4: First Application (This Chapter) ✅
  ↓
Chapter 5: QueryEngine Deep Dive ← Next
  ↓
Chapter 6: BashTool and Command Execution
```

**Practice Recommendations**:

1. **Extend Functionality**
   - Add more tools (code duplication detection, dependency analysis)
   - Add more commands (formatting, refactoring)
   - Support more programming languages

2. **Optimize and Improve**
   - Performance optimization (parallel processing, caching)
   - User experience (colored output, progress bars)
   - Error handling (more detailed error messages)

3. **Publish and Share**
   - Write complete documentation
   - Add unit tests
   - Publish to npm

---

## 📚 Further Reading

### Related Chapters
- **Prerequisite Chapter**: [Chapter 3: Core Concepts and Terminology](../en/chapter3-concepts-EN.md)
- **Following Chapter**: [Chapter 5: QueryEngine Deep Dive](../en/chapter5-queryengine-EN.md)
- **Practice Chapter**: [Chapter 22: Comprehensive Practice Project](../en/chapter22-practice-EN.md)

### External Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Zod Documentation](https://zod.dev)
- [Bun Documentation](https://bun.sh/docs)
- [Node.js Documentation](https://nodejs.org/docs)

---

## 🔗 Quick Reference

### Project Structure

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

### Key Commands

```bash
# Initialize project
bun init -y

# Install dependencies
bun install

# Development run
bun run dev

# Type checking
bun run type-check

# Build
bun run build
```

### Tool Interface

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

### Command Interface

```typescript
const command = {
  name: 'command_name',
  description: 'Command description',
  parameters: z.object({}),
  async execute(params, context) {
    // Implementation
  }
}
```

---

**Version**: 1.0.0  
**Last Updated**: 2026-04-03  
**Maintainer**: Claude Code Tutorial Team
