# Chapter 10: MCP Integration

## Overview

MCP (Model Context Protocol) is an open protocol introduced by Anthropic for standardizing connections between AI applications and external tools and data sources. Through its complete MCP client implementation, Claude Code allows users to seamlessly integrate hundreds of third-party services (such as databases, APIs, file systems, etc.). This chapter will deeply analyze the MCP integration architecture design, protocol implementation, tool encapsulation, and best practices.

**Key Points:**

- **MCP Protocol Fundamentals**: JSON-RPC 2.0, Transport layer, Resource/Tool/Prompt models
- **Client Architecture**: Connection management, tool discovery, call flow
- **Transport Implementation**: Stdio, SSE, WebSocket, StreamableHTTP
- **Tool Encapsulation**: Mapping MCP tools to Claude Code tools
- **Authentication Mechanisms**: OAuth 2.0, API Key, custom authentication
- **Error Handling**: Session expiration, authentication failure, timeout retry
- **Performance Optimization**: Connection reuse, parallel calls, result caching

## MCP Protocol Fundamentals

### Protocol Architecture

```mermaid
graph TB
    subgraph "MCP Protocol Stack"
        A[Application Layer] --> B[Resources<br/>Prompts<br/>Tools]
        B --> C[JSON-RPC 2.0]
        C --> D[Transport Layer]
        
        D --> E[Stdio]
        D --> F[SSE]
        D --> G[WebSocket]
        D --> H[StreamableHTTP]
    end
    
    style A fill:#e1f5ff
    style C fill:#fff4e1
    style D fill:#ffe1f5
```

### Core Concepts

#### 1. Resources

```typescript
// Resources: Data entities in external systems
interface Resource {
  uri: string;           // Unique identifier
  name: string;          // Display name
  description?: string;  // Description
  mimeType?: string;     // MIME type
}

interface ResourceTemplate {
  uriTemplate: string;   // URI template (e.g., "file://{path}")
  name: string;
  description?: string;
  mimeType?: string;
}

// Resource content
interface ResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;         // Text content
  blob?: string;         // Base64 encoded binary
}
```

**Examples:**
- Database query results
- File system files
- API response data
- Log file contents

#### 2. Prompts

```typescript
// Prompts: Predefined prompt templates
interface Prompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

interface PromptMessage {
  role: 'user' | 'assistant';
  content: ContentBlock;
}
```

**Examples:**
- Code review prompt
- Documentation generation prompt
- Test case generation prompt

#### 3. Tools

```typescript
// Tools: Callable functions
interface Tool {
  name: string;
  description?: string;
  inputSchema: JSONSchema; // JSON Schema format input definition
}

interface ToolCallResult {
  content: ContentBlock[];
  isError?: boolean;      // Is error
  _meta?: {               // Metadata
    progressToken?: string;
    requestId?: string;
  };
}
```

**Examples:**
- Database query tool
- File operation tool
- API call tool

## Client Architecture

### Overall Architecture

```mermaid
graph TB
    subgraph "MCP Client Architecture"
        A[MCPServerManager] --> B[MCPServerConfig]
        B --> C[Transport Factory]
        
        C --> D[StdioTransport]
        C --> E[SSETransport]
        C --> F[WebSocketTransport]
        C --> G[StreamableHTTPTransport]
        
        D --> H[MCP Client]
        E --> H
        F --> H
        G --> H
        
        H --> I[Tool Discovery]
        H --> J[Resource Discovery]
        H --> K[Prompt Discovery]
        
        I --> L[Tool Wrapper]
        J --> M[Resource Wrapper]
        K --> N[Prompt Wrapper]
        
        L --> O[Claude Code Tools]
        M --> O
        N --> O
    end
    
    style A fill:#e1f5ff
    style H fill:#fff4e1
    style O fill:#e1ffe1
```

### Core Components

```typescript
// src/services/mcp/client.ts
export class MCPServerManager {
  private servers: Map<string, MCPServerConnection> = new Map();
  private clients: Map<string, Client> = new Map();
  
  /**
   * Connect to MCP server
   */
  async connectServer(
    name: string,
    config: McpSdkServerConfig
  ): Promise<void> {
    // 1. Create Transport
    const transport = this.createTransport(config);
    
    // 2. Create client
    const client = new Client({
      name: 'claude-code',
      version: '1.0.0',
    }, {
      capabilities: {}
    });
    
    // 3. Connect
    await client.connect(transport);
    
    // 4. Initialize
    await this.initializeServer(client, name, config);
    
    // 5. Save connection
    this.servers.set(name, { client, config, status: 'connected' });
    this.clients.set(name, client);
  }
  
  /**
   * Create Transport
   */
  private createTransport(config: McpSdkServerConfig): Transport {
    switch (config.transport) {
      case 'stdio':
        return new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: config.env,
        });
      
      case 'sse':
        return new SSEClientTransport({
          url: config.url,
          headers: config.headers,
        });
      
      case 'websocket':
        return new WebSocketTransport(ws);
      
      case 'streamableHttp':
        return new StreamableHTTPClientTransport({
          url: config.url,
          headers: config.headers,
        });
      
      default:
        throw new Error(`Unknown transport: ${config.transport}`);
    }
  }
  
  /**
   * Initialize server
   */
  private async initializeServer(
    client: Client,
    name: string,
    config: McpSdkServerConfig
  ): Promise<void> {
    // 1. Discover tools
    const toolsResult = await client.listTools();
    const tools = toolsResult.tools || [];
    
    // 2. Discover resources
    const resourcesResult = await client.listResources();
    const resources = resourcesResult.resources || [];
    
    // 3. Discover prompts
    const promptsResult = await client.listPrompts();
    const prompts = promptsResult.prompts || [];
    
    // 4. Wrap tools
    const wrappedTools = this.wrapTools(tools, name);
    
    // 5. Register with system
    this.registerTools(wrappedTools);
    this.registerResources(resources, name);
    this.registerPrompts(prompts, name);
  }
}
```

## Transport Implementation

### 1. Stdio Transport

```typescript
// Standard input/output transport (local process)
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'python',           // Executable
  args: ['-m', 'mcp_server'],   // Command line arguments
  env: {                        // Environment variables
    PATH: process.env.PATH,
    CUSTOM_VAR: 'value',
  },
});
```

**Characteristics:**
- ✅ Local process communication
- ✅ Secure (network isolation)
- ✅ Suitable for development environments
- ❌ No remote connection support

**Use Cases:**
- Local file system servers
- Development tool integration
- Database local proxies

### 2. SSE Transport

```typescript
// Server-Sent Events transport (HTTP long connection)
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport({
  url: 'http://localhost:3000/sse',
  headers: {
    'Authorization': 'Bearer token123',
    'Custom-Header': 'value',
  },
});
```

**Characteristics:**
- ✅ Unidirectional server push
- ✅ Auto-reconnect
- ✅ HTTP compatible
- ❌ No client-initiated sending

**Use Cases:**
- Real-time data streams
- Log monitoring
- Event notifications

### 3. WebSocket Transport

```typescript
// WebSocket transport (bidirectional communication)
import { WebSocketTransport } from '../../utils/mcpWebSocketTransport.js';

const ws = new WebSocket('ws://localhost:3000/ws');
const transport = new WebSocketTransport(ws);
```

**Implementation Details:**

```typescript
// src/utils/mcpWebSocketTransport.ts
export class WebSocketTransport implements Transport {
  private started = false;
  private opened: Promise<void>;
  
  constructor(private ws: WebSocketLike) {
    this.opened = new Promise((resolve, reject) => {
      if (this.ws.readyState === WS_OPEN) {
        resolve();
      } else {
        // Set up open and error listeners
        this.ws.addEventListener('open', () => resolve());
        this.ws.addEventListener('error', (error) => reject(error));
      }
    });
    
    // Set up message listener
    this.ws.addEventListener('message', this.onMessage);
  }
  
  onmessage?: (message: JSONRPCMessage) => void;
  
  private onMessage = (event: MessageEvent) => {
    try {
      const data = typeof event.data === 'string' 
        ? event.data 
        : String(event.data);
      const messageObj = JSON.parse(data);
      const message = JSONRPCMessageSchema.parse(messageObj);
      this.onmessage?.(message);
    } catch (error) {
      this.handleError(error);
    }
  };
  
  async start(): Promise<void> {
    await this.opened;
    if (this.ws.readyState !== WS_OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.started = true;
  }
  
  async send(message: JSONRPCMessage): Promise<void> {
    if (this.ws.readyState !== WS_OPEN) {
      throw new Error('WebSocket is not open');
    }
    const json = JSON.stringify(message);
    this.ws.send(json);
  }
  
  async close(): Promise<void> {
    this.ws.close();
  }
}
```

**Characteristics:**
- ✅ Bidirectional real-time communication
- ✅ Low latency
- ✅ Binary data support
- ⚠️ Requires connection state management

**Use Cases:**
- Real-time interactive services
- Collaboration tools
- Gaming and simulation

### 4. StreamableHTTP Transport

```typescript
// Streamable HTTP transport (HTTP/2 Server-Sent Events)
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport({
  url: 'http://localhost:3000/mcp',
  headers: {
    'Authorization': 'Bearer token123',
  },
});
```

**Characteristics:**
- ✅ HTTP/2 multiplexing
- ✅ Server push
- ✅ Firewall friendly
- ❌ Requires HTTP/2 support

**Use Cases:**
- Cloud service integration
- API gateway backend
- Enterprise intranet services

## Tool Encapsulation

### Mapping MCP Tools to Claude Code Tools

```mermaid
graph LR
    A[MCP Tool] --> B[Tool Wrapper]
    B --> C[Claude Code Tool]
    
    A --> D{name, description,<br/>inputSchema}
    B --> E{buildTool}
    E --> F{checkPermissions}
    E --> G{execute}
    E --> H{handleResult}
    
    C --> I[QueryEngine<br/>Callable]
```

### Tool Wrapper Implementation

```typescript
// src/tools/MCPTool/MCPTool.ts
export function createMCPTool(
  serverName: string,
  mcpTool: Tool
): Tool {
  const toolName = buildMcpToolName(serverName, mcpTool.name);
  
  return buildTool({
    name: toolName,
    
    description: truncateDescription(
      mcpTool.description || ''
    ),
    
    inputSchema: mcpTool.inputSchema,
    
    async checkPermissions(input, context) {
      // MCP tools inherit server's permission configuration
      const serverConfig = getMcpServerConfig(serverName);
      if (!serverConfig) {
        return {
          behavior: 'deny',
          message: `MCP server "${serverName}" not found`,
        };
      }
      
      // Check tool-level permissions
      const toolPermissions = serverConfig.toolPermissions;
      if (toolPermissions && toolPermissions[mcpTool.name] === 'deny') {
        return {
          behavior: 'deny',
          message: `Tool "${mcpTool.name}" is denied by server configuration`,
        };
      }
      
      return { behavior: 'allow' };
    },
    
    async execute(input, context) {
      try {
        // 1. Get client
        const client = await ensureConnectedClient(serverName);
        if (!client) {
          throw new Error(`MCP server "${serverName}" not connected`);
        }
        
        // 2. Call MCP tool
        const result = await client.callTool({
          name: mcpTool.name,
          arguments: input,
        });
        
        // 3. Process result
        return await processMCPResult(result, context);
        
      } catch (error) {
        // Handle session expiration
        if (isMcpSessionExpiredError(error)) {
          clearClientCache(serverName);
          throw new Error(
            `MCP session expired. Please try again.`
          );
        }
        
        // Handle authentication error
        if (error instanceof McpAuthError) {
          updateServerStatus(serverName, 'needs-auth');
          throw error;
        }
        
        throw error;
      }
    },
  });
}

/**
 * Build MCP tool name
 * Format: mcp__<server_name>__<tool_name>
 */
export function buildMcpToolName(
  serverName: string,
  toolName: string
): string {
  const normalizedServer = normalizeNameForMCP(serverName);
  const normalizedTool = normalizeNameForMCP(toolName);
  return `mcp__${normalizedServer}__${normalizedTool}`;
}

/**
 * Truncate overly long tool descriptions
 */
function truncateDescription(description: string): string {
  if (description.length <= MAX_MCP_DESCRIPTION_LENGTH) {
    return description;
  }
  return description.slice(0, MAX_MCP_DESCRIPTION_LENGTH) + '...';
}
```

### Result Processing

```typescript
/**
 * Process MCP tool result
 */
async function processMCPResult(
  result: CallToolResult,
  context: ToolUseContext
): Promise<ToolResult> {
  const { content, isError, _meta } = result;
  
  // 1. Check error flag
  if (isError) {
    throw new McpToolCallError(
      'MCP tool returned an error',
      'mcp_tool_error',
      { _meta }
    );
  }
  
  // 2. Process content blocks
  const processedContent = await Promise.all(
    content.map(async (block) => {
      switch (block.type) {
        case 'text':
          return {
            type: 'text',
            text: block.text,
          };
        
        case 'image':
          // Process image data
          return await processImageBlock(block, context);
        
        case 'resource':
          // Process resource reference
          return await processResourceBlock(block, context);
        
        default:
          return block;
      }
    })
  );
  
  // 3. Check if truncation needed
  const sizeEstimate = getContentSizeEstimate(processedContent);
  if (mcpContentNeedsTruncation(sizeEstimate)) {
    return {
      content: truncateMcpContentIfNeeded(processedContent),
      _meta,
    };
  }
  
  return {
    content: processedContent,
    _meta,
  };
}

/**
 * Process image content block
 */
async function processImageBlock(
  block: ImageContentBlock,
  context: ToolUseContext
): Promise<ContentBlock> {
  const { data, mimeType } = block;
  
  // Resize image if needed
  const resized = await maybeResizeAndDownsampleImageBuffer(
    Buffer.from(data, 'base64'),
    mimeType
  );
  
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mimeType,
      data: resized.toString('base64'),
    },
  };
}
```

## Authentication Mechanisms

### OAuth 2.0 Authentication

```typescript
// src/services/mcp/auth.ts
export class ClaudeAuthProvider {
  /**
   * OAuth 2.0 Authorization Code Flow
   */
  async authenticate(serverName: string): Promise<string> {
    // 1. Get OAuth configuration
    const oauthConfig = getOauthConfig(serverName);
    if (!oauthConfig) {
      throw new Error(`OAuth config not found for "${serverName}"`);
    }
    
    // 2. Generate authorization URL
    const authUrl = new URL(oauthConfig.authorization_endpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', oauthConfig.client_id);
    authUrl.searchParams.set('redirect_uri', oauthConfig.redirect_uri);
    authUrl.searchParams.set('scope', oauthConfig.scope);
    authUrl.searchParams.set('state', generateState());
    
    // 3. Open browser for authorization
    openBrowser(authUrl.toString());
    
    // 4. Wait for callback
    const authCode = await waitForAuthCallback();
    
    // 5. Exchange code for access token
    const tokens = await exchangeCodeForTokens(authCode, oauthConfig);
    
    // 6. Save tokens
    await saveTokens(serverName, tokens);
    
    return tokens.access_token;
  }
  
  /**
   * Refresh access token
   */
  async refreshAccessToken(serverName: string): Promise<string> {
    const tokens = await getStoredTokens(serverName);
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }
    
    const oauthConfig = getOauthConfig(serverName);
    const newTokens = await refreshTokens(tokens.refresh_token, oauthConfig);
    
    await saveTokens(serverName, newTokens);
    return newTokens.access_token;
  }
}

/**
 * Refresh token if needed
 */
export async function checkAndRefreshOAuthTokenIfNeeded(
  serverName: string
): Promise<void> {
  const tokens = await getClaudeAIOAuthTokens(serverName);
  if (!tokens) {
    return;
  }
  
  // Check if expiring soon
  const expiresAt = tokens.expires_at;
  if (expiresAt && Date.now() >= expiresAt - 300_000) { // Refresh 5 min before
    try {
      await refreshAccessToken(serverName);
    } catch (error) {
      handleOAuth401Error(error, serverName);
    }
  }
}
```

### API Key Authentication

```typescript
/**
 * API Key Authentication
 */
export async function createAuthenticatedTransport(
  config: McpSdkServerConfig
): Promise<Transport> {
  // 1. Check if authentication needed
  if (config.auth?.type === 'api_key') {
    const apiKey = await getApiKey(config.auth.key);
    
    // 2. Add auth header
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${apiKey}`,
    };
  }
  
  // 3. Create Transport
  return createTransport(config);
}

async function getApiKey(keyName: string): Promise<string> {
  // Read from environment variable
  if (process.env[keyName]) {
    return process.env[keyName]!;
  }
  
  // Read from key storage
  const stored = await readKeyFromStorage(keyName);
  if (stored) {
    return stored;
  }
  
  throw new Error(`API key "${keyName}" not found`);
}
```

### Custom Authentication

```typescript
/**
 * Custom authentication hook
 */
export interface AuthConfig {
  type: 'custom';
  
  /**
   * Authentication function
   * @returns Auth headers or null (no authentication)
   */
  authenticate: () => Promise<Record<string, string> | null>;
}

export async function applyCustomAuth(
  config: McpSdkServerConfig,
  authConfig: AuthConfig
): Promise<void> {
  if (authConfig.type !== 'custom') {
    return;
  }
  
  const headers = await authConfig.authenticate();
  if (headers) {
    config.headers = {
      ...config.headers,
      ...headers,
    };
  }
}
```

## Error Handling

### Session Expiration

```typescript
/**
 * Detect MCP session expiration error
 * HTTP 404 + JSON-RPC code -32001
 */
export function isMcpSessionExpiredError(error: Error): boolean {
  const httpStatus =
    'code' in error ? (error as Error & { code?: number }).code : undefined;
  
  if (httpStatus !== 404) {
    return false;
  }
  
  // Check JSON-RPC error code
  return (
    error.message.includes('"code":-32001') ||
    error.message.includes('"code": -32001')
  );
}

/**
 * Handle session expiration
 */
async function handleSessionExpired(
  serverName: string,
  error: Error
): Promise<never> {
  if (isMcpSessionExpiredError(error)) {
    // Clear client cache
    clearClientCache(serverName);
    
    // Throw session expiration error
    throw new McpSessionExpiredError(serverName);
  }
  
  throw error;
}
```

### Authentication Failure

```typescript
/**
 * Handle OAuth 401 error
 */
export async function handleOAuth401Error(
  error: unknown,
  serverName: string
): Promise<void> {
  if (!(error instanceof UnauthorizedError)) {
    return;
  }
  
  // 1. Clear expired token
  clearTokens(serverName);
  
  // 2. Update server status
  updateServerStatus(serverName, 'needs-auth');
  
  // 3. Log cache
  setMcpAuthCacheEntry(serverName);
  
  // 4. Notify user
  notifyUserNeedsAuth(serverName);
}
```

### Timeout Retry

```typescript
/**
 * MCP tool call with retry
 */
async function callToolWithRetry(
  client: Client,
  toolName: string,
  args: unknown,
  maxRetries = 3
): Promise<CallToolResult> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 1. Call tool
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      }, {
        // Set timeout
        timeout: getMcpToolTimeoutMs(),
      });
      
      return result;
      
    } catch (error) {
      lastError = error as Error;
      
      // 2. Check if retryable
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // 3. Exponential backoff
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await sleep(delay);
      }
    }
  }
  
  throw lastError!;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('ECONNREFUSED')) {
    return true;
  }
  
  // Timeout errors
  if (error instanceof Error && error.message.includes('timeout')) {
    return true;
  }
  
  // HTTP 5xx errors
  if (error instanceof Error && error.message.includes('HTTP 5')) {
    return true;
  }
  
  return false;
}
```

## Performance Optimization

### Connection Reuse

```typescript
/**
 * Client connection pool
 */
class MCPClientPool {
  private connections: Map<string, Client> = new Map();
  private lastUsed: Map<string, number> = new Map();
  
  /**
   * Get or create client connection
   */
  async getClient(serverName: string): Promise<Client> {
    // 1. Check cache
    let client = this.connections.get(serverName);
    if (client) {
      this.lastUsed.set(serverName, Date.now());
      return client;
    }
    
    // 2. Create new connection
    const config = getMcpServerConfig(serverName);
    if (!config) {
      throw new Error(`MCP server "${serverName}" not found`);
    }
    
    client = await this.connect(serverName, config);
    
    // 3. Cache connection
    this.connections.set(serverName, client);
    this.lastUsed.set(serverName, Date.now());
    
    // 4. Set up auto cleanup
    this.scheduleCleanup(serverName);
    
    return client;
  }
  
  /**
   * Clean up idle connections
   */
  private scheduleCleanup(serverName: string): void {
    setTimeout(() => {
      const lastUsed = this.lastUsed.get(serverName);
      const idleTime = Date.now() - (lastUsed || 0);
      
      // Close if unused for 30 minutes
      if (idleTime > 30 * 60 * 1000) {
        this.closeConnection(serverName);
      } else {
        // Recheck
        this.scheduleCleanup(serverName);
      }
    }, 60 * 1000); // Check every minute
  }
  
  /**
   * Close connection
   */
  private async closeConnection(serverName: string): Promise<void> {
    const client = this.connections.get(serverName);
    if (client) {
      await client.close();
      this.connections.delete(serverName);
      this.lastUsed.delete(serverName);
    }
  }
}
```

### Parallel Calls

```typescript
/**
 * Call multiple MCP tools in parallel
 */
export async function callMCPToolsInParallel(
  calls: Array<{
    serverName: string;
    toolName: string;
    args: unknown;
  }>,
  concurrency = 5
): Promise<Array<CallToolResult>> {
  return pMap(
    calls,
    async ({ serverName, toolName, args }) => {
      const client = await ensureConnectedClient(serverName);
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });
      return result;
    },
    { concurrency }
  );
}
```

### Result Caching

```typescript
/**
 * MCP result cache
 */
class MCPResultCache {
  private cache: Map<string, CachedResult> = new Map();
  private ttl = 5 * 60 * 1000; // 5 minute TTL
  
  /**
   * Generate cache key
   */
  private getKey(
    serverName: string,
    toolName: string,
    args: unknown
  ): string {
    return `${serverName}:${toolName}:${JSON.stringify(args)}`;
  }
  
  /**
   * Get cached result
   */
  get(
    serverName: string,
    toolName: string,
    args: unknown
  ): CallToolResult | null {
    const key = this.getKey(serverName, toolName, args);
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.result;
  }
  
  /**
   * Set cache
   */
  set(
    serverName: string,
    toolName: string,
    args: unknown,
    result: CallToolResult
  ): void {
    const key = this.getKey(serverName, toolName, args);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Clear cache
   */
  clear(serverName?: string): void {
    if (serverName) {
      // Clear specific server cache
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${serverName}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }
}
```

## Resources and Prompts

### Resource Reading

```typescript
/**
 * MCP resource reading tool
 */
export const ReadMcpResourceTool = buildTool({
  name: 'read_mcp_resource',
  
  description: 'Read a resource from an MCP server',
  
  inputSchema: z.object({
    serverName: z.string(),
    uri: z.string(),
  }).schema,
  
  async checkPermissions(input, context) {
    const serverConfig = getMcpServerConfig(input.serverName);
    if (!serverConfig) {
      return {
        behavior: 'deny',
        message: `MCP server "${input.serverName}" not found`,
      };
    }
    
    return { behavior: 'allow' };
  },
  
  async execute(input, context) {
    const client = await ensureConnectedClient(input.serverName);
    
    const result = await client.readResource({
      uri: input.uri,
    });
    
    return {
      type: 'text',
      text: result.contents[0]?.text || '',
    };
  },
});
```

### Prompt Usage

```typescript
/**
 * Get MCP prompt
 */
export async function getMcpPrompt(
  serverName: string,
  promptName: string,
  args?: Record<string, unknown>
): Promise<PromptMessage[]> {
  const client = await ensureConnectedClient(serverName);
  
  const result = await client.getPrompt({
    name: promptName,
    arguments: args,
  });
  
  return result.messages;
}

/**
 * List available prompts
 */
export async function listMcpPrompts(
  serverName: string
): Promise<Prompt[]> {
  const client = await ensureConnectedClient(serverName);
  
  const result = await client.listPrompts();
  return result.prompts || [];
}
```

## Configuration Management

### MCP Server Configuration

```typescript
/**
 * MCP server configuration
 */
export interface McpSdkServerConfig {
  // Transport type
  transport: 'stdio' | 'sse' | 'websocket' | 'streamableHttp';
  
  // Environment variables (stdio)
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  
  // URL (sse/websocket/streamableHttp)
  url?: string;
  headers?: Record<string, string>;
  
  // Authentication
  auth?: {
    type: 'oauth' | 'api_key' | 'custom';
    // ... auth parameters
  };
  
  // Tool permissions
  toolPermissions?: Record<string, 'allow' | 'deny'>;
  
  // Timeout configuration
  timeout?: number;
}

/**
 * Load MCP server configuration
 */
export function loadMcpServerConfigs(): Record<
  string,
  McpSdkServerConfig
> {
  // 1. Read from config file
  const configPath = getClaudeConfigPath('mcp.json');
  const fileConfig = readConfigFile(configPath);
  
  // 2. Read from environment variables
  const envConfig = loadEnvConfig();
  
  // 3. Merge configs (env takes precedence)
  return mergeDeep(fileConfig, envConfig);
}
```

### Configuration Example

```json
{
  "mcpServers": {
    "filesystem": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]
    },
    
    "postgres": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:pass@localhost:5432/db"
      }
    },
    
    "github": {
      "transport": "sse",
      "url": "http://localhost:3000/sse",
      "auth": {
        "type": "oauth",
        "client_id": "your_client_id",
        "authorization_endpoint": "https://github.com/login/oauth/authorize",
        "token_endpoint": "https://github.com/login/oauth/access_token",
        "scope": "read:user read:org"
      }
    },
    
    "custom-api": {
      "transport": "streamableHttp",
      "url": "https://api.example.com/mcp",
      "headers": {
        "API-Key": "${CUSTOM_API_KEY}",
        "Custom-Header": "value"
      }
    }
  }
}
```

## Monitoring and Debugging

### Logging

```typescript
/**
 * MCP debug logging
 */
export function logMCPDebug(
  serverName: string,
  message: string,
  data?: unknown
): void {
  logForDebugging(`[MCP:${serverName}] ${message}`, data);
}

/**
 * MCP error logging
 */
export function logMCPError(
  serverName: string,
  error: Error,
  context?: Record<string, unknown>
): void {
  logError(error, {
    serverName,
    ...context,
  });
}
```

### Performance Monitoring

```typescript
/**
 * Track MCP call performance
 */
export async function trackMCPCallPerformance<T>(
  serverName: string,
  toolName: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    
    const duration = Date.now() - startTime;
    
    logEvent('mcp_tool_call_success', {
      serverName,
      toolName,
      duration,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logEvent('mcp_tool_call_error', {
      serverName,
      toolName,
      duration,
      error: String(error),
    });
    
    throw error;
  }
}
```

## Best Practices

### 1. Connection Management

```typescript
// ✅ Good: Connection reuse
const pool = new MCPClientPool();
const client = await pool.getClient(serverName);

// ❌ Bad: Create new connection every time
const transport = new StdioClientTransport(config);
const client = new Client(options);
await client.connect(transport); // High overhead
```

### 2. Error Handling

```typescript
// ✅ Good: Fine-grained error handling
try {
  const result = await client.callTool({ name, args });
} catch (error) {
  if (isMcpSessionExpiredError(error)) {
    // Reconnect
    clearClientCache(serverName);
    return await retryAfterReconnect();
  } else if (error instanceof McpAuthError) {
    // Reauthenticate
    return await reauthenticate();
  } else {
    // Other errors
    throw error;
  }
}

// ❌ Bad: Generic error handling
try {
  const result = await client.callTool({ name, args });
} catch (error) {
  // Retry all errors
  return await retry();
}
```

### 3. Timeout Configuration

```typescript
// ✅ Good: Set reasonable timeout
const timeout = config.timeout || getMcpToolTimeoutMs();
const result = await client.callTool(
  { name, args },
  { timeout }
);

// ❌ Bad: Infinite wait
const result = await client.callTool({ name, args }); // May block forever
```

## Summary

MCP Integration is the core of Claude Code's extensibility, achieving seamless integration with external services through the following mechanisms:

1. **Standardized Protocol**: Unified interface based on JSON-RPC 2.0
2. **Multi-Transport Support**: Stdio, SSE, WebSocket, HTTP
3. **Smart Tool Mapping**: Automatic wrapping of MCP tools as Claude Code tools
4. **Comprehensive Authentication**: OAuth 2.0, API Key, custom authentication
5. **Robust Error Handling**: Session expiration, authentication failure, timeout retry
6. **Performance Optimization**: Connection reuse, parallel calls, result caching

**Key Design Principles:**

- **Protocol First**: Follow MCP spec to ensure interoperability
- **Security First**: Authentication, authorization, sandbox isolation
- **User Friendly**: Auto-reconnect, error messages, simplified configuration
- **Performance Optimized**: Connection pool, parallel calls, smart caching
- **Extensible**: Easy to add new Transports and authentication methods

The MCP Integration implementation demonstrates how to achieve AI application extensibility through standardized protocols, which has important reference value for building open, flexible AI assistant systems.

## Further Reading

- **MCP Specification**: https://modelcontextprotocol.io/
- **SDK Documentation**: `@modelcontextprotocol/sdk`
- **Transport Implementation**: `src/services/mcp/client.ts`
- **WebSocket Transport**: `src/utils/mcpWebSocketTransport.ts`

## Next Chapter

Chapter 11 will explore **Agent System** in depth, covering agent architecture, strategy pattern, task decomposition mechanism, and source code analysis.
