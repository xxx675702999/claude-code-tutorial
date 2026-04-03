# Chapter 14 Custom Tool Development

## Overview

Claude Code's power lies in its extensible tool system. Through custom tools, developers can integrate any external functionality, from simple file operations to complex API calls. This chapter will deeply explain how to develop, test, and integrate custom tools.

**Chapter Highlights:**

- **Tool Interface Deep Dive**: Complete Tool type definition and lifecycle
- **buildTool Builder**: Creating tools using the builder pattern
- **Input Schema Design**: Zod validation, type safety, best practices
- **Permission Integration**: checkPermissions, validateInput, security strategies
- **Testing Strategy**: Unit tests, integration tests, end-to-end tests
- **Real-World Example**: Complete custom tool development case

## Tool Interface Deep Dive

### Tool Type Definition

```typescript
// src/Tool.ts
export type Tool<
  Input extends AnyObject = AnyObject,
  Output = unknown,
  P extends ToolProgressData = ToolProgressData,
> = {
  // === Metadata ===
  /**
   * Unique identifier for the tool
   * Used to lookup and invoke tools in the system
   */
  name: string

  /**
   * Description of tool functionality
   * Used by the model to decide when to call the tool
   */
  description: string

  /**
   * Optional aliases (backwards compatibility)
   * Tool can be looked up by aliases after renaming
   */
  aliases?: string[]

  /**
   * Search hint
   * 3-10 keywords to help the model find tools via keyword search
   */
  searchHint?: string

  // === Input/Output ===
  /**
   * Input validation Schema (Zod)
   * Defines parameter structure and validation rules
   */
  readonly inputSchema: Input

  /**
   * Output Schema (optional)
   * Defines data structure returned by tool
   */
  outputSchema?: z.ZodType<unknown>

  // === Core Methods ===
  /**
   * Execute tool logic
   * @param args Validated input parameters
   * @param context Tool use context
   * @param canUseTool Function to check if tool is available
   * @param parentMessage Parent message (AssistantMessage)
   * @param onProgress Progress callback
   * @returns Tool execution result
   */
  call(
    args: z.infer<Input>,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    parentMessage: AssistantMessage,
    onProgress?: ToolCallProgress<P>,
  ): Promise<ToolResult<Output>>

  // === Lifecycle Hooks ===
  /**
   * Input validation
   * Executes before permission check to validate input validity
   */
  validateInput?(
    input: z.infer<Input>,
    context: ToolUseContext,
  ): Promise<ValidationResult>

  /**
   * Permission check
   * Determines whether user approval is needed
   */
  checkPermissions(
    input: z.infer<Input>,
    context: ToolUseContext,
  ): Promise<PermissionResult>

  // === Tool Characteristics ===
  /**
   * Whether tool is enabled
   */
  isEnabled(): boolean

  /**
   * Whether concurrency-safe
   * true: Can execute concurrently with other tools
   * false: Must execute exclusively
   */
  isConcurrencySafe(input: z.infer<Input>): boolean

  /**
   * Whether read-only operation
   * true: Does not modify filesystem or external state
   * false: May modify state
   */
  isReadOnly(input: z.infer<Input>): boolean

  /**
   * Whether destructive operation
   * true: Irreversible operation (delete, overwrite, send)
   * false: Reversible or non-destructive
   */
  isDestructive?(input: z.infer<Input>): boolean

  // === Rendering Methods ===
  /**
   * Render tool invocation message
   */
  renderToolUseMessage?(/* ... */): ReactNode | null

  /**
   * Render tool result message
   */
  renderToolResultMessage?(/* ... */): ReactNode | null

  /**
   * Render tool error message
   */
  renderToolUseErrorMessage?(/* ... */): ReactNode | null

  // === Other Methods ===
  /**
   * User-friendly tool name
   */
  userFacingName(input?: Partial<z.infer<Input>>): string

  /**
   * Generate tool prompt
   */
  prompt(options: {
    getToolPermissionContext: () => Promise<ToolPermissionContext>
    tools: Tools
    agents: AgentDefinition[]
    allowedAgentTypes?: string[]
  }): Promise<string>
}
```

### ToolUseContext

Tool execution context provides interfaces to access system state and services.

```typescript
export type ToolUseContext = {
  // === System Options ===
  options: {
    commands: Command[]           // Available commands list
    debug: boolean                 // Debug mode
    mainLoopModel: string          // Current model in use
    tools: Tools                   // All available tools
    verbose: boolean               // Verbose output mode
    thinkingConfig: ThinkingConfig // Thinking configuration
    mcpClients: MCPServerConnection[] // MCP client list
    mcpResources: Record<string, ServerResource[]> // MCP resources
    isNonInteractiveSession: boolean  // Whether non-interactive session
    agentDefinitions: AgentDefinitionsResult // Agent definitions
    maxBudgetUsd?: number          // Maximum budget (USD)
    customSystemPrompt?: string    // Custom system prompt
    appendSystemPrompt?: string    // Append system prompt
    querySource?: QuerySource      // Query source
    refreshTools?: () => Tools     // Refresh tool list
  }

  // === Lifecycle Hooks ===
  /**
   * Append system message
   */
  appendSystemMessage: (message: SystemMessage) => void

  /**
   * Get AppState
   */
  getAppState: () => AppState

  /**
   * Get current directory
   */
  getCurrentWorkingDir: () => string

  // === Abort Control ===
  /**
   * Abort controller
   * Used to cancel long-running operations
   */
  abortController: AbortController

  // === Analytics Tracking ===
  /**
   * Query tracking information
   * Used for analytics and monitoring
   */
  queryTracking?: QueryChainTracking
}
```

### ToolResult

Return type of tool execution result.

```typescript
export type ToolResult<T> = {
  // === Core Data ===
  /**
   * Data returned by tool
   * Passed to model and renderer
   */
  data: T

  // === Message Generation ===
  /**
   * Optional new messages
   * Can be added to conversation history
   */
  newMessages?: (
    | UserMessage
    | AssistantMessage
    | AttachmentMessage
    | SystemMessage
  )[]

  // === Context Modification ===
  /**
   * Context modifier
   * Only effective when tool is not concurrency-safe
   */
  contextModifier?: (context: ToolUseContext) => ToolUseContext

  // === MCP Metadata ===
  /**
   * MCP protocol metadata
   * Passed to SDK consumers
   */
  mcpMeta?: {
    _meta?: Record<string, unknown>
    structuredContent?: Record<string, unknown>
  }
}
```

## buildTool Builder

### Basic Usage

`buildTool` is the standard method for creating tools, providing sensible defaults and simplifying tool definition.

```typescript
// src/Tool.ts
export function buildTool<D extends AnyToolDef>(def: D): BuiltTool<D> {
  return {
    ...TOOL_DEFAULTS,
    userFacingName: () => def.name,
    ...def,
  } as BuiltTool<D>
}

// Default values
const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: (_input?: unknown) => false,
  isReadOnly: (_input?: unknown) => false,
  isDestructive: (_input?: unknown) => false,
  checkPermissions: (
    input: { [key: string]: unknown },
    _ctx?: ToolUseContext,
  ): Promise<PermissionResult> =>
    Promise.resolve({ behavior: 'allow', updatedInput: input }),
  toAutoClassifierInput: (_input?: unknown) => '',
  userFacingName: (_input?: unknown) => '',
}
```

### Simple Tool Example

Create a simple greeting tool.

```typescript
import { z } from 'zod/v4'
import { buildTool } from 'src/Tool.js'
import { lazySchema } from 'src/utils/lazySchema.js'

// Define input Schema
const inputSchema = lazySchema(() =>
  z.strictObject({
    name: z.string()
      .min(1)
      .describe('Name to greet'),
    times: z.number()
      .int()
      .positive()
      .default(1)
      .describe('Number of greetings'),
  })
)

type InputSchema = ReturnType<typeof inputSchema>

// Create tool
export const GreetingTool = buildTool({
  name: 'greeting',

  async description() {
    return 'Greet a person by name'
  },

  get inputSchema(): InputSchema {
    return inputSchema()
  },

  // Tool logic
  async call(
    args: z.infer<InputSchema>,
    context: ToolUseContext,
    canUseTool: (toolName: string) => boolean,
    parentMessage: AssistantMessage,
  ) {
    const { name, times } = args

    const greetings: string[] = []
    for (let i = 0; i < times; i++) {
      greetings.push(`Hello, ${name}!`)
    }

    return {
      data: greetings.join('\n'),
    }
  },

  // User-friendly name
  userFacingName(input) {
    return input ? `Greet ${input.name}` : 'Greeting'
  },

  // Search hint
  searchHint: 'greet hello welcome',
})
```

### Complex Tool Example

Create a file statistics tool.

```typescript
import { z } from 'zod/v4'
import { buildTool, type ToolResult } from 'src/Tool.js'
import { lazySchema } from 'src/utils/lazySchema.js'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'

const inputSchema = lazySchema(() =>
  z.strictObject({
    directory: z.string()
      .describe('Directory path to统计'),
    pattern: z.string()
      .optional()
      .default('*')
      .describe('File matching pattern (glob)'),
    recursive: z.boolean()
      .optional()
      .default(false)
      .describe('Whether to recursively统计 subdirectories'),
  })
)

type InputSchema = ReturnType<typeof inputSchema>
type Output = {
  totalFiles: number
  totalSize: number
  fileTypes: Record<string, number>
}

export const FileStatsTool = buildTool({
  name: 'file_stats',

  async description() {
    return '统计 file count, size, and type distribution in a directory'
  },

  async prompt() {
    return `统计 specified directory's file information, including:
- Total file count
- Total size (bytes)
- File type distribution (by extension)

适用于 understanding project structure and storage usage.`
  },

  get inputSchema(): InputSchema {
    return inputSchema()
  },

  // Input validation
  async validateInput(input, context) {
    const fs = await import('fs/promises')

    try {
      await fs.access(input.directory)
      return { valid: true }
    } catch {
      return {
        valid: false,
        error: `Directory does not exist: ${input.directory}`,
      }
    }
  },

  // Permission check
  async checkPermissions(input, context) {
    // Default allow for read operations
    return {
      behavior: 'allow',
    }
  },

  // Read-only operation
  isReadOnly: () => true,

  // Tool logic
  async call(
    args: z.infer<InputSchema>,
    context: ToolUseContext,
  ): Promise<ToolResult<Output>> {
    const { directory, pattern, recursive } = args

    const files = await readdir(directory, { withFileTypes: true })
    const fileTypes: Record<string, number> = {}
    let totalSize = 0
    let totalFiles = 0

    for (const file of files) {
      if (file.isDirectory()) {
        if (recursive) {
          // Recursively process subdirectories
          const subPath = join(directory, file.name)
          // Simplified handling, should actually recurse
        }
        continue
      }

      // Match file pattern
      const matches = pattern === '*' || file.name.endsWith(pattern.replace('*', ''))
      if (!matches) continue

      totalFiles++

      // 统计 file type
      const ext = file.name.includes('.')
        ? file.name.split('.').pop()!
        : '(no extension)'
      fileTypes[ext] = (fileTypes[ext] || 0) + 1

      // 统计 size
      const filePath = join(directory, file.name)
      const stats = await stat(filePath)
      totalSize += stats.size
    }

    return {
      data: {
        totalFiles,
        totalSize,
        fileTypes,
      },
    }
  },

  // Render result
  renderToolResultMessage(content, progressMessages, options) {
    const { totalFiles, totalSize, fileTypes } = content

    const sizeMB = (totalSize / 1024 / 1024).toFixed(2)
    const typesStr = Object.entries(fileTypes)
      .sort(([, a], [, b]) => b - a)
      .map(([ext, count]) => `${ext}: ${count}`)
      .join(', ')

    return (
      <Box flexDirection="column">
        <Text bold>File Statistics Results</Text>
        <Text>Total files: {totalFiles}</Text>
        <Text>Total size: {sizeMB} MB</Text>
        <Text>File types: {typesStr}</Text>
      </Box>
    )
  },

  userFacingName() {
    return 'File Statistics'
  },
})
```

## Input Schema Design

### Zod Schema Basics

Use Zod library to define input validation rules.

```typescript
import { z } from 'zod/v4'
import { lazySchema } from 'src/utils/lazySchema.js'

// Basic types
const basicSchema = lazySchema(() =>
  z.strictObject({
    // String
    name: z.string().min(1).max(100),

    // Number
    age: z.number().int().positive().max(150),

    // Boolean
    active: z.boolean().default(true),

    // Optional field
    nickname: z.string().optional(),

    // Nullable field
    middleName: z.string().nullable().optional(),

    // Enum
    role: z.enum(['admin', 'user', 'guest']),

    // Array
    tags: z.array(z.string()).default([]),

    // Object
    address: z.object({
      street: z.string(),
      city: z.string(),
      zipCode: z.string().regex(/^\d{5}$/),
    }),

    // Union type
    status: z.union([
      z.literal('active'),
      z.literal('inactive'),
      z.literal('pending'),
    ]),

    // Literal
    mode: z.literal('read').or(z.literal('write')),
  })
)
```

### Schema Best Practices

**1. Use `.describe()` to add descriptions**

```typescript
// ✅ Good Schema (detailed descriptions)
const goodSchema = lazySchema(() =>
  z.strictObject({
    filePath: z.string()
      .describe('Absolute path to the file'),
    maxResults: z.number()
      .positive()
      .describe('Maximum number of results to return')
      .default(100),
    caseSensitive: z.boolean()
      .describe('Whether to distinguish case')
      .default(false),
  })
)

// ❌ Bad Schema (missing descriptions)
const badSchema = lazySchema(() =>
  z.object({
    path: z.string(),        // Relative or absolute?
    n: z.number(),           // Abbreviation, unclear meaning
    c: z.boolean(),          // What does c stand for?
  })
)
```

**2. Use `strictObject` instead of `object`**

```typescript
// ✅ strictObject: reject unknown fields
const strictSchema = lazySchema(() =>
  z.strictObject({
    name: z.string(),
  })
)

strictSchema.parse({ name: 'test', extra: 'field' })
// Error: Unknown key 'extra'

// ❌ object: ignore unknown fields
const looseSchema = lazySchema(() =>
  z.object({
    name: z.string(),
  })
)

looseSchema.parse({ name: 'test', extra: 'field' })
// { name: 'test } - extra field ignored
```

**3. Provide reasonable defaults**

```typescript
const schemaWithDefaults = lazySchema(() =>
  z.strictObject({
    // Required field
    filePath: z.string().min(1),

    // Optional fields with defaults
    encoding: z.enum(['utf8', 'ascii', 'latin1'])
      .default('utf8'),

    maxResults: z.number()
      .int()
      .positive()
      .max(1000)
      .default(100),

    recursive: z.boolean().default(false),

    // Complex default
    filter: z.object({
      extensions: z.array(z.string()).default([]),
      excludePatterns: z.array(z.string()).default([]),
    }).default({}),
  })
)
```

**4. Use `lazySchema` for lazy initialization**

```typescript
// Advantages of lazySchema:
// 1. Avoid circular dependencies
// 2. Reduce initialization overhead
// 3. Support mutually referencing schemas

import { lazySchema } from 'src/utils/lazySchema.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    // Can reference other schemas
    nested: nestedSchema(),
    // ...
  })
)
```

### Complex Schema Design

**Discriminated Union**

```typescript
// Define multiple operation types
const operationSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    // Type 1: Create
    z.strictObject({
      type: z.literal('create'),
      name: z.string().min(1),
      content: z.string(),
    }),

    // Type 2: Update
    z.strictObject({
      type: z.literal('update'),
      id: z.string().uuid(),
      content: z.string(),
    }),

    // Type 3: Delete
    z.strictObject({
      type: z.literal('delete'),
      id: z.string().uuid(),
    }),
  ])
)

// Usage
const CreateFileTool = buildTool({
  name: 'file_operation',

  get inputSchema() {
    return operationSchema()
  },

  async call(args) {
    switch (args.type) {
      case 'create':
        // TypeScript knows args.name and args.content exist
        return createFile(args.name, args.content)
      case 'update':
        // TypeScript knows args.id and args.content exist
        return updateFile(args.id, args.content)
      case 'delete':
        // TypeScript knows args.id exists
        return deleteFile(args.id)
    }
  },
})
```

**Conditional Validation**

```typescript
const conditionalSchema = lazySchema(() =>
  z.strictObject({
    operation: z.enum(['read', 'write', 'delete']),

    // write operation requires content
    content: z.string().optional(),

    // delete operation requires confirm
    confirm: z.boolean().optional(),
  }).refine(
    (data) => {
      if (data.operation === 'write' && !data.content) {
        return false
      }
      if (data.operation === 'delete' && !data.confirm) {
        return false
      }
      return true
    },
    {
      message: 'write operation requires content, delete operation requires confirm',
      path: ['operation'],
    }
  )
)
```

## Permission Integration

### checkPermissions Implementation

Permission checks determine whether a tool requires user approval.

```typescript
// Permission result type
type PermissionResult =
  | { behavior: 'allow'; updatedInput?: unknown }           // Allow execution
  | { behavior: 'deny'; message: string }                   // Deny execution
  | { behavior: 'ask'; message: string }                    // Ask user
  | { behavior: 'passthrough'; message: string }            // Pass to global permission system
```

### Implementation Examples

**1. Simple Allow**

```typescript
export const ReadOnlyTool = buildTool({
  name: 'read_only_tool',

  async checkPermissions(input, context) {
    // Read-only tools always allowed
    return {
      behavior: 'allow',
    }
  },

  isReadOnly: () => true,
})
```

**2. Conditional Allow**

```typescript
export const ConditionalTool = buildTool({
  name: 'conditional_tool',

  async checkPermissions(input, context) {
    // Check working directory
    const cwd = context.getCurrentWorkingDir()
    const targetPath = input.filePath

    // Only allow operations within current working directory
    if (targetPath.startsWith(cwd)) {
      return {
        behavior: 'allow',
      }
    }

    // Otherwise deny
    return {
      behavior: 'deny',
      message: `Only allowed to access files within current working directory: ${cwd}`,
    }
  },
})
```

**3. Ask User**

```typescript
export const DestructiveTool = buildTool({
  name: 'destructive_tool',

  async checkPermissions(input, context) {
    // Destructive operations always ask
    return {
      behavior: 'ask',
      message: `This operation will permanently delete ${input.target}, continue?`,
    }
  },

  isDestructive: () => true,
})
```

**4. Pass to Global Permission System**

```typescript
export const FileWriteTool = buildTool({
  name: 'file_write',

  async checkPermissions(input, context) {
    // Check path constraints
    const pathResult = checkPathConstraints(
      input.filePath,
      context.getAppState().toolPermissionContext
    )

    if (pathResult.behavior !== 'allow') {
      return pathResult
    }

    // Check explicit permissions
    const explicitPermission = checkExplicitPermission(
      'file_write',
      input.filePath,
      context.getAppState().toolPermissionContext
    )

    if (explicitPermission) {
      return explicitPermission
    }

    // Pass to global permission system
    return {
      behavior: 'passthrough',
      message: `Requesting file write permission: ${input.filePath}`,
    }
  },
})
```

### validateInput Implementation

Input validation executes before permission check to validate input validity.

```typescript
export const ValidatedTool = buildTool({
  name: 'validated_tool',

  async validateInput(input, context) {
    // Validate file path
    if (input.filePath) {
      const fs = await import('fs/promises')

      try {
        await fs.access(input.filePath)
      } catch {
        return {
          valid: false,
          error: `File does not exist: ${input.filePath}`,
        }
      }
    }

    // Validate number range
    if (input.maxResults !== undefined) {
      if (input.maxResults < 1 || input.maxResults > 1000) {
        return {
          valid: false,
          error: 'maxResults must be between 1-1000',
        }
      }
    }

    // Validation passed
    return { valid: true }
  },

  async call(args, context) {
    // Execute logic
    return { data: '...' }
  },
})
```

## Testing Strategy

### Unit Testing

Test core tool logic.

```typescript
import { describe, it, expect } from 'vitest'
import { GreetingTool } from './GreetingTool.js'

describe('GreetingTool', () => {
  it('should generate greeting message', async () => {
    // Create mock context
    const mockContext = createMockContext()

    // Call tool
    const result = await GreetingTool.call(
      { name: 'Alice', times: 3 },
      mockContext,
      () => true,
      {} as AssistantMessage
    )

    // Verify result
    expect(result.data).toBe('Hello, Alice!\nHello, Alice!\nHello, Alice!')
  })

  it('should use default times value', async () => {
    const mockContext = createMockContext()

    const result = await GreetingTool.call(
      { name: 'Bob' },  // times defaults to 1
      mockContext,
      () => true,
      {} as AssistantMessage
    )

    expect(result.data).toBe('Hello, Bob!')
  })

  it('should validate input schema', async () => {
    const input = { name: '', times: -1 }

    const result = await GreetingTool.validateInput?.(
      input,
      createMockContext()
    )

    expect(result?.valid).toBe(false)
    expect(result?.error).toBeDefined()
  })
})

// Mock utility function
function createMockContext(): ToolUseContext {
  return {
    options: {
      commands: [],
      debug: false,
      mainLoopModel: 'claude-sonnet-4',
      tools: [],
      verbose: false,
      thinkingConfig: { type: 'disabled' },
      mcpClients: [],
      mcpResources: {},
      isNonInteractiveSession: false,
      agentDefinitions: { activeAgents: [], allAgents: [] },
    },
    appendSystemMessage: () => {},
    getAppState: () => ({} as AppState),
    getCurrentWorkingDir: () => '/mock/dir',
    abortController: new AbortController(),
  }
}
```

### Permission Testing

Test permission check logic.

```typescript
describe('FileWriteTool permissions', () => {
  it('should allow files in working directory', async () => {
    const context = createMockContext({
      cwd: '/project',
    })

    const result = await FileWriteTool.checkPermissions(
      { filePath: '/project/file.txt' },
      context
    )

    expect(result.behavior).toBe('allow')
  })

  it('should deny files outside working directory', async () => {
    const context = createMockContext({
      cwd: '/project',
    })

    const result = await FileWriteTool.checkPermissions(
      { filePath: '/etc/passwd' },  // Dangerous path
      context
    )

    expect(result.behavior).toBe('deny')
    expect(result.message).toContain('not allowed')
  })

  it('should ask for destructive operations', async () => {
    const result = await FileDeleteTool.checkPermissions(
      { filePath: '/project/important.txt' },
      createMockContext()
    )

    expect(result.behavior).toBe('ask')
    expect(result.message).toContain('permanently delete')
  })
})
```

### Integration Testing

Test tool behavior in complete workflow.

```typescript
describe('Tool integration tests', () => {
  it('should execute tool in query context', async () => {
    const tool = FileStatsTool
    const input = { directory: '/test', recursive: false }

    // Create complete QueryEngine context
    const queryEngine = await createTestQueryEngine({
      tools: [tool],
    })

    // Execute query
    const result = await queryEngine.executeTool(tool.name, input)

    // Verify result
    expect(result.success).toBe(true)
    expect(result.data.totalFiles).toBeGreaterThan(0)
  })

  it('should handle tool errors gracefully', async () => {
    const tool = FileReadTool
    const input = { filePath: '/nonexistent/file.txt' }

    const queryEngine = await createTestQueryEngine({
      tools: [tool],
    })

    const result = await queryEngine.executeTool(tool.name, input)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
```

## Real-World Example

### Complete Tool: Code Search Tool

Create a code search tool supporting regex.

```typescript
import { z } from 'zod/v4'
import { buildTool, type ToolResult } from 'src/Tool.js'
import { lazySchema } from 'src/utils/lazySchema.js'
import { readdir, readFile } from 'fs/promises'
import { join, relative } from 'path'
import { Grep } from 'src/utils/grep.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    directory: z.string()
      .describe('Search root directory'),
    pattern: z.string()
      .min(1)
      .describe('Search pattern (supports regex)'),
    filePattern: z.string()
      .optional()
      .default('*')
      .describe('File matching pattern'),
    caseSensitive: z.boolean()
      .optional()
      .default(false)
      .describe('Whether case-sensitive'),
    maxResults: z.number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe('Maximum result count'),
    contextLines: z.number()
      .int()
      .nonnegative()
      .optional()
      .default(2)
      .describe('Context line count'),
  })
)

type InputSchema = ReturnType<typeof inputSchema>

type MatchResult = {
  file: string
  line: number
  lineContent: string
  contextBefore: string[]
  contextAfter: string[]
}

type Output = {
  matches: MatchResult[]
  totalMatches: number
  filesSearched: number
}

export const CodeSearchTool = buildTool({
  name: 'code_search',

  async description() {
    return 'Search for text matching a pattern in code'
  },

  async prompt() {
    return `Powerful code search tool, supporting:

**Features:**
- Regex search
- File pattern filtering
- Context line display
- Case-sensitive/insensitive

**Use Cases:**
- Find function calls
- Locate variable references
- Search specific code patterns
- Analysis before code refactoring

**Performance:**
- Parallel file search
- Result count limit
- Smart caching`
  },

  get inputSchema(): InputSchema {
    return inputSchema()
  },

  // Input validation
  async validateInput(input, context) {
    const fs = await import('fs/promises')

    try {
      const stats = await fs.stat(input.directory)
      if (!stats.isDirectory()) {
        return {
          valid: false,
          error: `Path is not a directory: ${input.directory}`,
        }
      }
    } catch {
      return {
        valid: false,
        error: `Directory does not exist: ${input.directory}`,
      }
    }

    // Validate regex
    try {
      new RegExp(input.pattern)
    } catch (error) {
      return {
        valid: false,
        error: `Invalid regex: ${(error as Error).message}`,
      }
    }

    return { valid: true }
  },

  // Permission check: always allow read
  async checkPermissions(input, context) {
    return {
      behavior: 'allow',
    }
  },

  // Read-only operation
  isReadOnly: () => true,

  // Tool logic
  async call(
    args: z.infer<InputSchema>,
    context: ToolUseContext,
  ): Promise<ToolResult<Output>> {
    const {
      directory,
      pattern,
      filePattern,
      caseSensitive,
      maxResults,
      contextLines,
    } = args

    // Create regex
    const flags = caseSensitive ? 'g' : 'gi'
    const regex = new RegExp(pattern, flags)

    // Search files
    const matches: MatchResult[] = []
    let filesSearched = 0

    const files = await findFiles(directory, filePattern)

    for (const file of files) {
      if (matches.length >= maxResults) break

      filesSearched++

      const relativePath = relative(directory, file)
      const content = await readFile(file, 'utf-8')
      const lines = content.split('\n')

      // Search each line
      lines.forEach((line, index) => {
        if (matches.length >= maxResults) return

        regex.lastIndex = 0  // Reset regex
        const found = regex.test(line)

        if (found) {
          matches.push({
            file: relativePath,
            line: index + 1,
            lineContent: line.trim(),
            contextBefore: lines.slice(
              Math.max(0, index - contextLines),
              index
            ),
            contextAfter: lines.slice(
              index + 1,
              Math.min(lines.length, index + 1 + contextLines)
            ),
          })
        }
      })
    }

    return {
      data: {
        matches,
        totalMatches: matches.length,
        filesSearched,
      },
    }
  },

  // Render result
  renderToolResultMessage(content, progressMessages, options) {
    const { matches, totalMatches, filesSearched } = content

    if (matches.length === 0) {
      return <Text>No matches found</Text>
    }

    return (
      <Box flexDirection="column">
        <Text bold>
          Search results: {totalMatches} matches (searched {filesSearched} files)
        </Text>
        {matches.map((match, index) => (
          <Box key={index} flexDirection="column" marginBottom={1}>
            <Text dimColor>
              {match.file}:{match.line}
            </Text>
            {match.contextBefore.map(line => (
              <Text key={line} dimColor>
                {line}
              </Text>
            ))}
            <Text color="yellow">{match.lineContent}</Text>
            {match.contextAfter.map(line => (
              <Text key={line} dimColor>
                {line}
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    )
  },

  userFacingName(input) {
    return input ? `Search code: ${input.pattern}` : 'Code search'
  },

  searchHint: 'search grep find regex pattern',
})

// Helper function: find files
async function findFiles(
  directory: string,
  pattern: string
): Promise<string[]> {
  const { glob } = await import('glob')
  const files = await glob(pattern, {
    cwd: directory,
    absolute: true,
    nodir: true,
  })
  return files
}
```

### Test Code

```typescript
import { describe, it, expect } from 'vitest'
import { CodeSearchTool } from './CodeSearchTool.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'

describe('CodeSearchTool', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), 'code-search-test')
    await mkdir(testDir, { recursive: true })

    // Create test files
    await writeFile(join(testDir, 'file1.ts'), `
function hello(name: string) {
  console.log(\`Hello, \${name}!\`)
  return name
}

function goodbye(name: string) {
  console.log(\`Goodbye, \${name}!\`)
  return name
}
    `)

    await writeFile(join(testDir, 'file2.ts'), `
const message = 'Hello, World!'
console.log(message)
    `)
  })

  it('should search for pattern across files', async () => {
    const context = createMockContext({ cwd: testDir })

    const result = await CodeSearchTool.call(
      {
        directory: testDir,
        pattern: 'Hello',
        caseSensitive: false,
        maxResults: 10,
      },
      context,
      () => true,
      {} as AssistantMessage
    )

    expect(result.data.matches.length).toBeGreaterThan(0)
    expect(result.data.matches[0].lineContent).toContain('Hello')
  })

  it('should respect case sensitivity', async () => {
    const context = createMockContext({ cwd: testDir })

    const result = await CodeSearchTool.call(
      {
        directory: testDir,
        pattern: 'hello',
        caseSensitive: true,
        maxResults: 10,
      },
      context,
      () => true,
      {} as AssistantMessage
    )

    // Lowercase hello should not match uppercase Hello
    expect(result.data.matches.length).toBe(0)
  })

  it('should limit results', async () => {
    const context = createMockContext({ cwd: testDir })

    const result = await CodeSearchTool.call(
      {
        directory: testDir,
        pattern: 'console',
        maxResults: 2,
      },
      context,
      () => true,
      {} as AssistantMessage
    )

    expect(result.data.matches.length).toBeLessThanOrEqual(2)
  })

  it('should validate regex pattern', async () => {
    const result = await CodeSearchTool.validateInput?.(
      {
        directory: testDir,
        pattern: '[invalid(regex',  // Invalid regex
      },
      createMockContext()
    )

    expect(result?.valid).toBe(false)
    expect(result?.error).toContain('Invalid regex')
  })
})
```

## Best Practices Summary

### Tool Design Principles

1. **Single Responsibility**: Each tool does one thing
2. **Idempotency**: Same input produces same output
3. **Error Handling**: Clear error messages and recovery strategies
4. **Type Safety**: Leverage TypeScript and Zod fully
5. **Complete Documentation**: Descriptions, prompts, examples

### Schema Design Recommendations

1. Use `strictObject` to avoid unknown fields
2. Add `.describe()` to each field
3. Provide reasonable defaults
4. Use `lazySchema` for lazy initialization
5. Use `.refine()` for complex validation

### Permission Design Recommendations

1. Default deny (fail-closed)
2. Clear operation semantics (read-only, destructive)
3. Fine-grained permission control
4. Clear denial messages

### Testing Recommendations

1. Unit tests cover core logic
2. Integration tests verify complete workflow
3. Permission tests ensure security
4. Boundary condition tests
5. Performance tests (large data volumes)

## Summary

Custom tools are a powerful way to extend Claude Code's functionality. By following the best practices in this chapter:

1. **Use buildTool**: Simplify tool definition, get sensible defaults
2. **Design Schemas Carefully**: Type-safe, complete validation, clear documentation
3. **Implement Permission Control**: Protect sensitive operations, provide clear permission prompts
4. **Write Complete Tests**: Unit tests, integration tests, permission tests
5. **Optimize User Experience**: Friendly error messages, useful result rendering

Mastering custom tool development enables infinite extension of Claude Code's capabilities, integrating any external service and functionality.
