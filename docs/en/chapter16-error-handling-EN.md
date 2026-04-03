# Chapter 16: Error Handling & Fault Tolerance

## Overview

As a complex system interacting with AI, Claude Code requires robust error handling and fault tolerance mechanisms. This chapter will deeply analyze the system's error classification, handling strategies, retry mechanisms, and degradation schemes to ensure stable operation under various异常 conditions.

**Chapter Highlights:**

- **Error Classification System**: Error types, error levels, error sources
- **Error Handling Strategies**: Fail-fast, graceful degradation, retry mechanisms
- **Fault Tolerance Design**: Circuit breakers, timeout control, resource isolation
- **Error Recovery**: Auto-recovery, manual intervention, state rollback
- **Monitoring & Alerting**: Error collection, error analysis, error reporting
- **Real-World Cases**: Common error scenarios, solutions

## Error Classification System

### Error Type Definition

```typescript
// src/types/error.ts
export type CodedError = Error & {
  code: string
  details?: Record<string, unknown>
}

export type ErrorType =
  | 'ValidationError'       // Input validation error
  | 'PermissionError'       // Permission error
  | 'NotFoundError'         // Resource not found
  | 'TimeoutError'          // Timeout error
  | 'NetworkError'          // Network error
  | 'ParseError'            // Parse error
  | 'ExecutionError'        // Execution error
  | 'StateError'            // State error
  | 'ConfigurationError'    // Configuration error
  | 'PluginError'           // Plugin error
  | 'MCPError'              // MCP error
  | 'LSPError'              // LSP error

export type ErrorSeverity =
  | 'critical'  // Critical error, requires immediate handling
  | 'high'      // High priority error, affects core functionality
  | 'medium'    // Medium error, affects partial functionality
  | 'low'       // Low priority error, doesn't affect core functionality
  | 'info'      // Informational error, for logging only

export type ErrorContext = {
  type: ErrorType
  severity: ErrorSeverity
  source: string              // Error source
  timestamp: number           // Timestamp
  recoverable: boolean        // Whether recoverable
  retryable: boolean          // Whether retryable
  details?: Record<string, unknown>
}
```

### Error Constructor

```typescript
// src/utils/errors.ts
export function createError<T extends ErrorType>(
  type: T,
  message: string,
  context?: Partial<ErrorContext>
): CodedError & { type: T } {
  const error = new Error(message) as CodedError & { type: T }
  error.name = type
  error.code = type

  const defaultContext: ErrorContext = {
    type,
    severity: 'medium',
    source: 'system',
    timestamp: Date.now(),
    recoverable: true,
    retryable: false,
  }

  error.context = { ...defaultContext, ...context }

  return error
}

// Predefined error constructors
export const errors = {
  validation: (message: string, details?: Record<string, unknown>) =>
    createError('ValidationError', message, { severity: 'low', recoverable: true, retryable: false, details }),

  permission: (message: string, details?: Record<string, unknown>) =>
    createError('PermissionError', message, { severity: 'high', recoverable: false, retryable: false, details }),

  notFound: (resource: string, id: string) =>
    createError('NotFoundError', `${resource} not found: ${id}`, { severity: 'medium', recoverable: false, retryable: false, details: { resource, id } }),

  timeout: (operation: string, timeout: number) =>
    createError('TimeoutError', `${operation} timed out after ${timeout}ms`, { severity: 'high', recoverable: true, retryable: true, details: { operation, timeout } }),

  network: (message: string, details?: Record<string, unknown>) =>
    createError('NetworkError', message, { severity: 'high', recoverable: true, retryable: true, details }),

  execution: (message: string, details?: Record<string, unknown>) =>
    createError('ExecutionError', message, { severity: 'medium', recoverable: true, retryable: true, details }),

  plugin: (plugin: string, message: string) =>
    createError('PluginError', `Plugin ${plugin}: ${message}`, { severity: 'medium', recoverable: true, retryable: false, details: { plugin } }),
}
```

## Error Handling Strategies

### Fail-Fast Strategy

适用于无法恢复的严重错误。

```typescript
// src/utils/errors.ts
export function failFast<T>(operation: () => T, onError?: (error: Error) => never): T {
  try {
    return operation()
  } catch (error) {
    if (onError) {
      return onError(error as Error)
    }

    // Log error
    logError(error)

    // Fail immediately
    throw error
  }
}

// Usage example
function validateConfiguration(config: unknown): Configuration {
  return failFast(() => {
    if (!config || typeof config !== 'object') {
      throw errors.validation('Invalid configuration format')
    }

    const parsed = ConfigurationSchema.parse(config)

    if (!parsed.apiKey) {
      throw errors.configuration('API key is required')
    }

    return parsed
  })
}
```

### Graceful Degradation Strategy

适用于非关键功能的错误。

```typescript
// src/utils/errors.ts
export function gracefulFallback<T>(
  primary: () => T,
  fallback: () => T,
  options?: {
    onFallback?: (error: Error) => void
    logFallback?: boolean
  }
): T {
  try {
    return primary()
  } catch (error) {
    if (options?.logFallback !== false) {
      logForDebugging(`Primary operation failed, using fallback: ${errorMessage(error)}`)
    }

    options?.onFallback?.(error as Error)

    try {
      return fallback()
    } catch (fallbackError) {
      // Fallback also failed, throw original error
      throw error
    }
  }
}

// Usage example
function loadPlugins(): LoadedPlugin[] {
  return gracefulFallback(
    // Primary: Load from cache
    () => loadPluginsFromCache(),
    // Fallback: Return empty list
    () => {
      logForDebugging('No cached plugins available, starting with empty list')
      return []
    },
    {
      onFallback: (error) => {
        addNotification({
          type: 'warning',
          title: 'Plugin Cache Miss',
          message: 'Using empty plugin list',
        })
      },
    }
  )
}
```

### Retry Mechanism

#### Exponential Backoff Retry

```typescript
// src/utils/retry.ts
export interface RetryOptions {
  maxAttempts?: number           // Max retry attempts (default 3)
  initialDelay?: number          // Initial delay (default 1000ms)
  maxDelay?: number             // Max delay (default 10000ms)
  backoffMultiplier?: number    // Backoff multiplier (default 2)
  jitter?: boolean              // Whether to add random jitter (default true)
  retryable?: (error: Error) => boolean  // Determine if retryable
  onRetry?: (attempt: number, error: Error) => void  // Retry callback
}

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    jitter = true,
    retryable = () => true,
    onRetry,
  } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Last attempt failed, no more retries
      if (attempt === maxAttempts) {
        break
      }

      // Check if retryable
      if (!retryable(lastError)) {
        break
      }

      // Calculate delay
      const baseDelay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay)
      const delay = jitter ? baseDelay * (0.5 + Math.random()) : baseDelay

      logForDebugging(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms: ${errorMessage(lastError)}`)

      onRetry?.(attempt, lastError)

      // Wait before retry
      await sleep(delay)
    }
  }

  throw lastError
}

// Usage example
async function callMCPServer(server: MCPServer, request: Request): Promise<Response> {
  return retry(
    async () => {
      const response = await fetch(server.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(server.timeout || 30000),
      })

      if (!response.ok) {
        throw errors.network(`MCP server error: ${response.status}`)
      }

      return response.json()
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      retryable: (error) => {
        // Only retry network errors and timeouts
        return error.code === 'NetworkError' || error.code === 'TimeoutError'
      },
      onRetry: (attempt, error) => {
        logForDebugging(`MCP server call failed, retrying: ${errorMessage(error)}`)
      },
    }
  )
}
```

#### Circuit Breaker Pattern

```typescript
// src/utils/circuitBreaker.ts
export interface CircuitBreakerOptions {
  failureThreshold?: number     // Failure threshold (default 5)
  resetTimeout?: number         // Reset timeout (default 60000ms)
  monitoringPeriod?: number     // Monitoring period (default 10000ms)
  halfOpenAttempts?: number     // Half-open attempts (default 1)
}

export type CircuitState =
  | 'closed'     // Normal state
  | 'open'       // Open state
  | 'half-open'  // Half-open state

export class CircuitBreaker<T extends (...args: any[]) => any> {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0
  private nextAttemptTime = 0

  constructor(
    private operation: T,
    private options: CircuitBreakerOptions = {}
  ) {
    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      monitoringPeriod = 10000,
      halfOpenAttempts = 1,
    } = options

    // Periodically reset failure count
    setInterval(() => {
      if (this.state === 'closed') {
        this.failureCount = 0
      }
    }, monitoringPeriod)
  }

  async execute(...args: Parameters<T>): Promise<ReturnType<T>> {
    // Check if recovery attempt is needed
    if (this.state === 'open' && Date.now() >= this.nextAttemptTime) {
      this.state = 'half-open'
      this.successCount = 0
      logForDebugging('Circuit breaker entering half-open state')
    }

    // Open state, reject directly
    if (this.state === 'open') {
      throw new Error('Circuit breaker is OPEN, rejecting request')
    }

    try {
      const result = await this.operation(...args)
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++

      if (this.successCount >= (this.options.halfOpenAttempts || 1)) {
        this.state = 'closed'
        this.failureCount = 0
        logForDebugging('Circuit breaker closed after successful recovery')
      }
    } else {
      this.failureCount = 0
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    const threshold = this.options.failureThreshold || 5

    if (this.failureCount >= threshold) {
      this.state = 'open'
      this.nextAttemptTime = Date.now() + (this.options.resetTimeout || 60000)
      logForDebugging(`Circuit breaker opened after ${this.failureCount} failures`)
    }
  }

  getState(): CircuitState {
    return this.state
  }

  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.successCount = 0
  }
}

// Usage example
const mcpCircuitBreaker = new CircuitBreaker(
  async (server: MCPServer, request: Request) => {
    return callMCPServer(server, request)
  },
  {
    failureThreshold: 5,
    resetTimeout: 60000,
    monitoringPeriod: 10000,
  }
)

async function safeCallMCP(server: MCPServer, request: Request): Promise<Response> {
  return mcpCircuitBreaker.execute(server, request)
}
```

## Fault Tolerance Design

### Timeout Control

```typescript
// src/utils/timeout.ts
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  options?: {
    onTimeout?: () => void
    timeoutError?: string
  }
): Promise<T> {
  const { onTimeout, timeoutError } = options || {}

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.()
      reject(errors.timeout('Operation', timeoutMs))
    }, timeoutMs)

    // Clear timer
    timeoutPromise.catch(() => clearTimeout(timer))
  })

  return Promise.race([operation, timeoutPromise])
}

// Usage example
async function loadPluginWithTimeout(pluginPath: string): Promise<LoadedPlugin> {
  return withTimeout(
    loadPluginFromPath(pluginPath),
    5000,
    {
      onTimeout: () => {
        logForDebugging(`Plugin loading timed out: ${pluginPath}`)
        addNotification({
          type: 'warning',
          title: 'Plugin Load Timeout',
          message: `Plugin took too long to load: ${pluginPath}`,
        })
      },
    }
  )
}
```

### Resource Isolation

```typescript
// src/utils/resourcePool.ts
export class ResourcePool<T> {
  private available: T[] = []
  private allocated = new Set<T>()
  private waiting: Array<(resource: T) => void> = []

  constructor(
    private factory: () => T,
    private maxSize: number,
    private createTimeout?: number
  ) {}

  async acquire(): Promise<T> {
    // If available resources, return immediately
    if (this.available.length > 0) {
      const resource = this.available.pop()!
      this.allocated.add(resource)
      return resource
    }

    // If max size not reached, create new resource
    if (this.allocated.size < this.maxSize) {
      const resource = await this.createResource()
      this.allocated.add(resource)
      return resource
    }

    // Wait for resource release
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waiting.indexOf(resolve)
        if (index > -1) {
          this.waiting.splice(index, 1)
        }
        reject(new Error('Resource acquisition timeout'))
      }, this.createTimeout || 30000)

      this.waiting.push((resource) => {
        clearTimeout(timer)
        resolve(resource)
      })
    })
  }

  release(resource: T): void {
    if (!this.allocated.has(resource)) {
      throw new Error('Resource not allocated')
    }

    this.allocated.delete(resource)

    // If waiting requests, allocate directly
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!
      next(resource)
      this.allocated.add(resource)
    } else {
      this.available.push(resource)
    }
  }

  private async createResource(): Promise<T> {
    return withTimeout(
      Promise.resolve(this.factory()),
      this.createTimeout || 5000
    )
  }
}

// Usage example: MCP connection pool
const mcpConnectionPool = new ResourcePool(
  () => createMCPConnection(),
  10,  // Max 10 connections
  5000 // Create timeout 5 seconds
)

async function executeMCPOperation(server: MCPServer, request: Request): Promise<Response> {
  const connection = await mcpConnectionPool.acquire()

  try {
    return await connection.execute(request)
  } finally {
    mcpConnectionPool.release(connection)
  }
}
```

## Error Recovery

### Auto Recovery

```typescript
// src/utils/recovery.ts
export interface RecoveryStrategy<T> {
  detect: (error: Error) => boolean
  recover: (error: Error) => Promise<T>
  maxAttempts?: number
}

export async function withRecovery<T>(
  operation: () => Promise<T>,
  strategies: RecoveryStrategy<T>[]
): Promise<T> {
  let lastError: Error | null = null

  for (const strategy of strategies) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Check if recovery strategy applies
      if (!strategy.detect(lastError)) {
        continue
      }

      logForDebugging(`Applying recovery strategy: ${lastError.message}`)

      try {
        const result = await strategy.recover(lastError)
        logForDebugging('Recovery successful')
        return result
      } catch (recoveryError) {
        logForDebugging(`Recovery failed: ${errorMessage(recoveryError)}`)
        // Try next strategy
      }
    }
  }

  throw lastError
}

// Usage example
async function loadPluginWithRecovery(pluginPath: string): Promise<LoadedPlugin> {
  return withRecovery(
    () => loadPluginFromPath(pluginPath),
    [
      {
        detect: (error) => error.code === 'ParseError',
        recover: async (error) => {
          // Re-download plugin
          logForDebugging('Parse error detected, re-downloading plugin')
          await downloadPlugin(pluginPath)
          return loadPluginFromPath(pluginPath)
        },
      },
      {
        detect: (error) => error.code === 'NotFoundError',
        recover: async (error) => {
          // Restore from backup
          logForDebugging('Plugin not found, trying backup')
          const backup = await loadPluginBackup(pluginPath)
          if (backup) {
            return backup
          }
          throw error
        },
      },
    ]
  )
}
```

### State Rollback

```typescript
// src/utils/rollback.ts
export class RollbackManager {
  private checkpoints: Array<() => Promise<void>> = []

  async checkpoint<T>(
    operation: () => Promise<T>,
    rollback: () => Promise<void>
  ): Promise<T> {
    this.checkpoints.push(rollback)

    try {
      return await operation()
    } catch (error) {
      // Operation failed, execute rollback
      await this.rollback()
      throw error
    }
  }

  async rollback(): Promise<void> {
    // Execute all rollback operations in reverse order
    for (const rollback of [...this.checkpoints].reverse()) {
      try {
        await rollback()
      } catch (error) {
        logError(error)
        logForDebugging(`Rollback failed: ${errorMessage(error)}`)
      }
    }

    this.checkpoints = []
  }

  commit(): void {
    this.checkpoints = []
  }
}

// Usage example
async function installPlugins(plugins: string[]): Promise<void> {
  const rollback = new RollbackManager()

  for (const plugin of plugins) {
    await rollback.checkpoint(
      async () => {
        await installPlugin(plugin)
      },
      async () => {
        await uninstallPlugin(plugin)
      }
    )
  }

  // All plugins installed successfully, commit
  rollback.commit()
}
```

## Monitoring & Alerting

### Error Collection

```typescript
// src/utils/errorCollector.ts
export interface ErrorReport {
  error: Error
  context: ErrorContext
  stack?: string
  userAction?: string
  systemState?: Record<string, unknown>
}

export class ErrorCollector {
  private errors: ErrorReport[] = []
  private maxSize = 1000

  report(error: Error, context?: Partial<ErrorContext>): void {
    const report: ErrorReport = {
      error,
      context: {
        type: 'ExecutionError',
        severity: 'medium',
        source: 'unknown',
        timestamp: Date.now(),
        recoverable: true,
        retryable: false,
        ...context,
      },
      stack: error.stack,
      userAction: getCurrentUserAction(),
      systemState: getSystemStateSnapshot(),
    }

    this.errors.push(report)

    // Maintain queue size
    if (this.errors.length > this.maxSize) {
      this.errors.shift()
    }

    // Send alert based on severity
    if (report.context.severity === 'critical') {
      this.sendAlert(report)
    }
  }

  getErrors(filter?: (report: ErrorReport) => boolean): ErrorReport[] {
    return filter ? this.errors.filter(filter) : [...this.errors]
  }

  clear(): void {
    this.errors = []
  }

  private sendAlert(report: ErrorReport): void {
    // Send alert notification
    addNotification({
      type: 'error',
      title: `Critical Error: ${report.context.type}`,
      message: report.error.message,
    })

    // Can integrate external alerting systems
    // sendToExternalAlerting(report)
  }
}

// Global error collector
export const globalErrorCollector = new ErrorCollector()

// Global error handler
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error) => {
    globalErrorCollector.report(error, {
      type: 'ExecutionError',
      severity: 'critical',
      source: 'uncaughtException',
      recoverable: false,
    })
  })

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason))
    globalErrorCollector.report(error, {
      type: 'ExecutionError',
      severity: 'high',
      source: 'unhandledRejection',
      recoverable: false,
    })
  })
}
```

## Real-World Cases

### Case 1: MCP Server Connection Failure

**Problem**: MCP server frequently times out or fails to connect.

**Solution**:

```typescript
async function callMCPServerWithRetry(server: MCPServer, request: Request): Promise<Response> {
  return retry(
    () => callMCPServer(server, request),
    {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      retryable: (error) => {
        return error.code === 'NetworkError' || error.code === 'TimeoutError'
      },
      onRetry: (attempt, error) => {
        logForDebugging(`MCP server call failed (attempt ${attempt}): ${errorMessage(error)}`)
        addNotification({
          type: 'warning',
          title: 'MCP Server Retry',
          message: `Retrying... (attempt ${attempt}/3)`,
        })
      },
    }
  )
}
```

### Case 2: Plugin Loading Failure

**Problem**: Plugin parse errors or missing dependencies.

**Solution**:

```typescript
async function loadPluginWithErrorHandling(pluginPath: string): Promise<LoadedPlugin | null> {
  try {
    return await loadPluginWithTimeout(pluginPath, 5000)
  } catch (error) {
    logError(error)

    if (error.code === 'ParseError') {
      // Try re-downloading
      try {
        await downloadPlugin(pluginPath)
        return await loadPluginFromPath(pluginPath)
      } catch (retryError) {
        logForDebugging(`Plugin recovery failed: ${errorMessage(retryError)}`)
      }
    }

    // Mark plugin as failed
    markPluginAsFailed(pluginPath, error)

    addNotification({
      type: 'error',
      title: 'Plugin Load Failed',
      message: `${basename(pluginPath)}: ${errorMessage(error)}`,
    })

    return null
  }
}
```

### Case 3: State Inconsistency

**Problem**: AppState inconsistent with actual state.

**Solution**:

```typescript
function syncStateWithRecovery(): void {
  try {
    const currentState = loadStateFromDisk()
    const runningProcesses = getRunningProcesses()

    // Detect inconsistencies
    const inconsistencies = detectInconsistencies(currentState, runningProcesses)

    if (inconsistencies.length > 0) {
      logForDebugging(`Detected ${inconsistencies.length} state inconsistencies`)

      // Auto-fix
      const fixed = autoFixInconsistencies(inconsistencies)

      if (fixed.length < inconsistencies.length) {
        // Some cannot be auto-fixed, need manual intervention
        addNotification({
          type: 'warning',
          title: 'State Inconsistency Detected',
          message: 'Some inconsistencies require manual intervention',
        })
      }
    }
  } catch (error) {
    logError(error)
    // Use fallback state
    restoreFallbackState()
  }
}
```

## Best Practices

### Error Handling Principles

1. **Fail Fast**: For unrecoverable errors, fail immediately and report
2. **Graceful Degradation**: For non-critical function failures, provide fallback
3. **Retry Strategy**: Set reasonable retry count and backoff strategy
4. **Resource Isolation**: Limit resource usage to prevent cascading failures
5. **Monitoring & Alerting**: Monitor errors in real-time and alert promptly

### Error Handling Patterns

1. **Try-Catch-Finally**: Ensure resource release
2. **Result Type**: Use Result<T, E> to represent operations that may fail
3. **Error Chain**: Preserve complete error call chain
4. **Error Context**: Provide rich error context information

### Fault Tolerance Design Principles

1. **Timeout Control**: Set timeout for all external calls
2. **Circuit Breaker**: Prevent avalanche effect
3. **Resource Pool**: Limit concurrent resource usage
4. **Health Check**: Periodically check system health
5. **Fault Isolation**: Isolate failed components to prevent spread

## Summary

Claude Code's error handling and fault tolerance mechanisms:

1. **Comprehensive Error Classification**: Clear classification of error types, levels, and sources
2. **Multiple Handling Strategies**: Fail-fast, graceful degradation, retry mechanisms
3. **Powerful Fault Tolerance**: Circuit breakers, timeout control, resource isolation
4. **Auto Recovery Capability**: Detection, recovery, rollback mechanisms
5. **Comprehensive Monitoring**: Error collection, analysis, reporting

Mastering these mechanisms allows building more stable and reliable systems, improving user experience.
