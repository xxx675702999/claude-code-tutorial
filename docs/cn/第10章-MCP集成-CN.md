# 第10章 MCP Integration MCP 集成

## 概述

MCP（Model Context Protocol）是 Anthropic 推出的开放协议，用于标准化 AI 应用与外部工具、数据源之间的连接。Claude Code 通过完整的 MCP 客户端实现，允许用户无缝集成数百个第三方服务（如数据库、API、文件系统等）。本章将深入分析 MCP 集成的架构设计、协议实现、工具封装和最佳实践。

**本章要点：**

- **MCP 协议基础**：JSON-RPC 2.0、Transport 层、资源/工具/提示模型
- **客户端架构**：连接管理、工具发现、调用流程
- **Transport 实现**：Stdio、SSE、WebSocket、StreamableHTTP
- **工具封装**：MCP 工具到 Claude Code 工具的映射
- **认证机制**：OAuth 2.0、API Key、自定义认证
- **错误处理**：会话过期、认证失败、超时重试
- **性能优化**：连接复用、并行调用、结果缓存

## MCP 协议基础

### 协议架构

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

### 核心概念

#### 1. Resources（资源）

```typescript
// 资源：外部系统中的数据实体
interface Resource {
  uri: string;           // 唯一标识符
  name: string;          // 显示名称
  description?: string;  // 描述
  mimeType?: string;     // MIME 类型
}

interface ResourceTemplate {
  uriTemplate: string;   // URI 模板（如 "file://{path}"）
  name: string;
  description?: string;
  mimeType?: string;
}

// 资源内容
interface ResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;         // 文本内容
  blob?: string;         // Base64 编码的二进制
}
```

**示例：**
- 数据库查询结果
- 文件系统文件
- API 响应数据
- 日志文件内容

#### 2. Prompts（提示）

```typescript
// 提示：预定义的提示模板
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

**示例：**
- 代码审查提示
- 文档生成提示
- 测试用例生成提示

#### 3. Tools（工具）

```typescript
// 工具：可调用的功能
interface Tool {
  name: string;
  description?: string;
  inputSchema: JSONSchema; // JSON Schema 格式的输入定义
}

interface ToolCallResult {
  content: ContentBlock[];
  isError?: boolean;      // 是否错误
  _meta?: {               // 元数据
    progressToken?: string;
    requestId?: string;
  };
}
```

**示例：**
- 数据库查询工具
- 文件操作工具
- API 调用工具

## 客户端架构

### 整体架构

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

### 核心组件

```typescript
// src/services/mcp/client.ts
export class MCPServerManager {
  private servers: Map<string, MCPServerConnection> = new Map();
  private clients: Map<string, Client> = new Map();
  
  /**
   * 连接到 MCP 服务器
   */
  async connectServer(
    name: string,
    config: McpSdkServerConfig
  ): Promise<void> {
    // 1. 创建 Transport
    const transport = this.createTransport(config);
    
    // 2. 创建客户端
    const client = new Client({
      name: 'claude-code',
      version: '1.0.0',
    }, {
      capabilities: {}
    });
    
    // 3. 连接
    await client.connect(transport);
    
    // 4. 初始化
    await this.initializeServer(client, name, config);
    
    // 5. 保存连接
    this.servers.set(name, { client, config, status: 'connected' });
    this.clients.set(name, client);
  }
  
  /**
   * 创建 Transport
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
   * 初始化服务器
   */
  private async initializeServer(
    client: Client,
    name: string,
    config: McpSdkServerConfig
  ): Promise<void> {
    // 1. 发现工具
    const toolsResult = await client.listTools();
    const tools = toolsResult.tools || [];
    
    // 2. 发现资源
    const resourcesResult = await client.listResources();
    const resources = resourcesResult.resources || [];
    
    // 3. 发现提示
    const promptsResult = await client.listPrompts();
    const prompts = promptsResult.prompts || [];
    
    // 4. 包装工具
    const wrappedTools = this.wrapTools(tools, name);
    
    // 5. 注册到系统
    this.registerTools(wrappedTools);
    this.registerResources(resources, name);
    this.registerPrompts(prompts, name);
  }
}
```

## Transport 实现

### 1. Stdio Transport

```typescript
// 标准输入/输出传输（本地进程）
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'python',           // 可执行文件
  args: ['-m', 'mcp_server'],   // 命令行参数
  env: {                        // 环境变量
    PATH: process.env.PATH,
    CUSTOM_VAR: 'value',
  },
});
```

**特点：**
- ✅ 本地进程通信
- ✅ 安全（网络隔离）
- ✅ 适合开发环境
- ❌ 不支持远程连接

**使用场景：**
- 本地文件系统服务器
- 开发工具集成
- 数据库本地代理

### 2. SSE Transport

```typescript
// Server-Sent Events 传输（HTTP 长连接）
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport({
  url: 'http://localhost:3000/sse',
  headers: {
    'Authorization': 'Bearer token123',
    'Custom-Header': 'value',
  },
});
```

**特点：**
- ✅ 单向服务器推送
- ✅ 自动重连
- ✅ HTTP 兼容
- ❌ 不支持客户端主动发送

**使用场景：**
- 实时数据流
- 日志监听
- 事件通知

### 3. WebSocket Transport

```typescript
// WebSocket 传输（双向通信）
import { WebSocketTransport } from '../../utils/mcpWebSocketTransport.js';

const ws = new WebSocket('ws://localhost:3000/ws');
const transport = new WebSocketTransport(ws);
```

**实现细节：**

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
        // 设置打开和错误监听器
        this.ws.addEventListener('open', () => resolve());
        this.ws.addEventListener('error', (error) => reject(error));
      }
    });
    
    // 设置消息监听器
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

**特点：**
- ✅ 双向实时通信
- ✅ 低延迟
- ✅ 支持二进制数据
- ⚠️ 需要处理连接状态

**使用场景：**
- 实时交互服务
- 协作工具
- 游戏和仿真

### 4. StreamableHTTP Transport

```typescript
// 可流式 HTTP 传输（HTTP/2 Server-Sent Events）
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport({
  url: 'http://localhost:3000/mcp',
  headers: {
    'Authorization': 'Bearer token123',
  },
});
```

**特点：**
- ✅ HTTP/2 多路复用
- ✅ 服务器推送
- ✅ 防火墙友好
- ❌ 需要 HTTP/2 支持

**使用场景：**
- 云服务集成
- API 网关后端
- 企业内网服务

## 工具封装

### MCP 工具到 Claude Code 工具的映射

```mermaid
graph LR
    A[MCP Tool] --> B[Tool Wrapper]
    B --> C[Claude Code Tool]
    
    A --> D{name, description,<br/>inputSchema}
    B --> E{buildTool}
    E --> F{checkPermissions}
    E --> G{execute}
    E --> H{handleResult}
    
    C --> I[QueryEngine<br/>可调用]
```

### 工具包装实现

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
      // MCP 工具继承服务器的权限配置
      const serverConfig = getMcpServerConfig(serverName);
      if (!serverConfig) {
        return {
          behavior: 'deny',
          message: `MCP server "${serverName}" not found`,
        };
      }
      
      // 检查工具级别权限
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
        // 1. 获取客户端
        const client = await ensureConnectedClient(serverName);
        if (!client) {
          throw new Error(`MCP server "${serverName}" not connected`);
        }
        
        // 2. 调用 MCP 工具
        const result = await client.callTool({
          name: mcpTool.name,
          arguments: input,
        });
        
        // 3. 处理结果
        return await processMCPResult(result, context);
        
      } catch (error) {
        // 处理会话过期
        if (isMcpSessionExpiredError(error)) {
          clearClientCache(serverName);
          throw new Error(
            `MCP session expired. Please try again.`
          );
        }
        
        // 处理认证错误
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
 * 构建 MCP 工具名称
 * 格式：mcp__<server_name>__<tool_name>
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
 * 截断过长的工具描述
 */
function truncateDescription(description: string): string {
  if (description.length <= MAX_MCP_DESCRIPTION_LENGTH) {
    return description;
  }
  return description.slice(0, MAX_MCP_DESCRIPTION_LENGTH) + '...';
}
```

### 结果处理

```typescript
/**
 * 处理 MCP 工具结果
 */
async function processMCPResult(
  result: CallToolResult,
  context: ToolUseContext
): Promise<ToolResult> {
  const { content, isError, _meta } = result;
  
  // 1. 检查错误标记
  if (isError) {
    throw new McpToolCallError(
      'MCP tool returned an error',
      'mcp_tool_error',
      { _meta }
    );
  }
  
  // 2. 处理内容块
  const processedContent = await Promise.all(
    content.map(async (block) => {
      switch (block.type) {
        case 'text':
          return {
            type: 'text',
            text: block.text,
          };
        
        case 'image':
          // 处理图片数据
          return await processImageBlock(block, context);
        
        case 'resource':
          // 处理资源引用
          return await processResourceBlock(block, context);
        
        default:
          return block;
      }
    })
  );
  
  // 3. 检查是否需要截断
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
 * 处理图片内容块
 */
async function processImageBlock(
  block: ImageContentBlock,
  context: ToolUseContext
): Promise<ContentBlock> {
  const { data, mimeType } = block;
  
  // 调整图片大小（如果需要）
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

## 认证机制

### OAuth 2.0 认证

```typescript
// src/services/mcp/auth.ts
export class ClaudeAuthProvider {
  /**
   * OAuth 2.0 授权码流程
   */
  async authenticate(serverName: string): Promise<string> {
    // 1. 获取 OAuth 配置
    const oauthConfig = getOauthConfig(serverName);
    if (!oauthConfig) {
      throw new Error(`OAuth config not found for "${serverName}"`);
    }
    
    // 2. 生成授权 URL
    const authUrl = new URL(oauthConfig.authorization_endpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', oauthConfig.client_id);
    authUrl.searchParams.set('redirect_uri', oauthConfig.redirect_uri);
    authUrl.searchParams.set('scope', oauthConfig.scope);
    authUrl.searchParams.set('state', generateState());
    
    // 3. 打开浏览器进行授权
    openBrowser(authUrl.toString());
    
    // 4. 等待回调
    const authCode = await waitForAuthCallback();
    
    // 5. 交换访问令牌
    const tokens = await exchangeCodeForTokens(authCode, oauthConfig);
    
    // 6. 保存令牌
    await saveTokens(serverName, tokens);
    
    return tokens.access_token;
  }
  
  /**
   * 刷新访问令牌
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
 * 刷新令牌（如果需要）
 */
export async function checkAndRefreshOAuthTokenIfNeeded(
  serverName: string
): Promise<void> {
  const tokens = await getClaudeAIOAuthTokens(serverName);
  if (!tokens) {
    return;
  }
  
  // 检查是否即将过期
  const expiresAt = tokens.expires_at;
  if (expiresAt && Date.now() >= expiresAt - 300_000) { // 5 分钟前刷新
    try {
      await refreshAccessToken(serverName);
    } catch (error) {
      handleOAuth401Error(error, serverName);
    }
  }
}
```

### API Key 认证

```typescript
/**
 * API Key 认证
 */
export async function createAuthenticatedTransport(
  config: McpSdkServerConfig
): Promise<Transport> {
  // 1. 检查是否需要认证
  if (config.auth?.type === 'api_key') {
    const apiKey = await getApiKey(config.auth.key);
    
    // 2. 添加认证头
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${apiKey}`,
    };
  }
  
  // 3. 创建 Transport
  return createTransport(config);
}

async function getApiKey(keyName: string): Promise<string> {
  // 从环境变量读取
  if (process.env[keyName]) {
    return process.env[keyName]!;
  }
  
  // 从密钥存储读取
  const stored = await readKeyFromStorage(keyName);
  if (stored) {
    return stored;
  }
  
  throw new Error(`API key "${keyName}" not found`);
}
```

### 自定义认证

```typescript
/**
 * 自定义认证钩子
 */
export interface AuthConfig {
  type: 'custom';
  
  /**
   * 认证函数
   * @returns 认证头或 null（无需认证）
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

## 错误处理

### 会话过期

```typescript
/**
 * 检测 MCP 会话过期错误
 * HTTP 404 + JSON-RPC code -32001
 */
export function isMcpSessionExpiredError(error: Error): boolean {
  const httpStatus =
    'code' in error ? (error as Error & { code?: number }).code : undefined;
  
  if (httpStatus !== 404) {
    return false;
  }
  
  // 检查 JSON-RPC 错误码
  return (
    error.message.includes('"code":-32001') ||
    error.message.includes('"code": -32001')
  );
}

/**
 * 处理会话过期
 */
async function handleSessionExpired(
  serverName: string,
  error: Error
): Promise<never> {
  if (isMcpSessionExpiredError(error)) {
    // 清除客户端缓存
    clearClientCache(serverName);
    
    // 抛出会话过期错误
    throw new McpSessionExpiredError(serverName);
  }
  
  throw error;
}
```

### 认证失败

```typescript
/**
 * 处理 OAuth 401 错误
 */
export async function handleOAuth401Error(
  error: unknown,
  serverName: string
): Promise<void> {
  if (!(error instanceof UnauthorizedError)) {
    return;
  }
  
  // 1. 清除过期令牌
  clearTokens(serverName);
  
  // 2. 更新服务器状态
  updateServerStatus(serverName, 'needs-auth');
  
  // 3. 记录缓存
  setMcpAuthCacheEntry(serverName);
  
  // 4. 通知用户
  notifyUserNeedsAuth(serverName);
}
```

### 超时重试

```typescript
/**
 * 带重试的 MCP 工具调用
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
      // 1. 调用工具
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      }, {
        // 设置超时
        timeout: getMcpToolTimeoutMs(),
      });
      
      return result;
      
    } catch (error) {
      lastError = error as Error;
      
      // 2. 检查是否可重试
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // 3. 指数退避
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await sleep(delay);
      }
    }
  }
  
  throw lastError!;
}

/**
 * 检查错误是否可重试
 */
function isRetryableError(error: unknown): boolean {
  // 网络错误
  if (error instanceof TypeError && error.message.includes('ECONNREFUSED')) {
    return true;
  }
  
  // 超时错误
  if (error instanceof Error && error.message.includes('timeout')) {
    return true;
  }
  
  // HTTP 5xx 错误
  if (error instanceof Error && error.message.includes('HTTP 5')) {
    return true;
  }
  
  return false;
}
```

## 性能优化

### 连接复用

```typescript
/**
 * 客户端连接池
 */
class MCPClientPool {
  private connections: Map<string, Client> = new Map();
  private lastUsed: Map<string, number> = new Map();
  
  /**
   * 获取或创建客户端连接
   */
  async getClient(serverName: string): Promise<Client> {
    // 1. 检查缓存
    let client = this.connections.get(serverName);
    if (client) {
      this.lastUsed.set(serverName, Date.now());
      return client;
    }
    
    // 2. 创建新连接
    const config = getMcpServerConfig(serverName);
    if (!config) {
      throw new Error(`MCP server "${serverName}" not found`);
    }
    
    client = await this.connect(serverName, config);
    
    // 3. 缓存连接
    this.connections.set(serverName, client);
    this.lastUsed.set(serverName, Date.now());
    
    // 4. 设置自动清理
    this.scheduleCleanup(serverName);
    
    return client;
  }
  
  /**
   * 清理空闲连接
   */
  private scheduleCleanup(serverName: string): void {
    setTimeout(() => {
      const lastUsed = this.lastUsed.get(serverName);
      const idleTime = Date.now() - (lastUsed || 0);
      
      // 30 分钟未使用则关闭
      if (idleTime > 30 * 60 * 1000) {
        this.closeConnection(serverName);
      } else {
        // 重新检查
        this.scheduleCleanup(serverName);
      }
    }, 60 * 1000); // 每分钟检查一次
  }
  
  /**
   * 关闭连接
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

### 并行调用

```typescript
/**
 * 并行调用多个 MCP 工具
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

### 结果缓存

```typescript
/**
 * MCP 结果缓存
 */
class MCPResultCache {
  private cache: Map<string, CachedResult> = new Map();
  private ttl = 5 * 60 * 1000; // 5 分钟 TTL
  
  /**
   * 生成缓存键
   */
  private getKey(
    serverName: string,
    toolName: string,
    args: unknown
  ): string {
    return `${serverName}:${toolName}:${JSON.stringify(args)}`;
  }
  
  /**
   * 获取缓存结果
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
    
    // 检查是否过期
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.result;
  }
  
  /**
   * 设置缓存
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
   * 清除缓存
   */
  clear(serverName?: string): void {
    if (serverName) {
      // 清除特定服务器的缓存
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${serverName}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // 清除所有缓存
      this.cache.clear();
    }
  }
}
```

## 资源和提示

### 资源读取

```typescript
/**
 * MCP 资源读取工具
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

### 提示使用

```typescript
/**
 * 获取 MCP 提示
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
 * 列出可用提示
 */
export async function listMcpPrompts(
  serverName: string
): Promise<Prompt[]> {
  const client = await ensureConnectedClient(serverName);
  
  const result = await client.listPrompts();
  return result.prompts || [];
}
```

## 配置管理

### MCP 服务器配置

```typescript
/**
 * MCP 服务器配置
 */
export interface McpSdkServerConfig {
  // 传输类型
  transport: 'stdio' | 'sse' | 'websocket' | 'streamableHttp';
  
  // 环境变量（stdio）
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  
  // URL（sse/websocket/streamableHttp）
  url?: string;
  headers?: Record<string, string>;
  
  // 认证
  auth?: {
    type: 'oauth' | 'api_key' | 'custom';
    // ... 认证参数
  };
  
  // 工具权限
  toolPermissions?: Record<string, 'allow' | 'deny'>;
  
  // 超时配置
  timeout?: number;
}

/**
 * 加载 MCP 服务器配置
 */
export function loadMcpServerConfigs(): Record<
  string,
  McpSdkServerConfig
> {
  // 1. 从配置文件读取
  const configPath = getClaudeConfigPath('mcp.json');
  const fileConfig = readConfigFile(configPath);
  
  // 2. 从环境变量读取
  const envConfig = loadEnvConfig();
  
  // 3. 合并配置（环境变量优先）
  return mergeDeep(fileConfig, envConfig);
}
```

### 配置示例

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

## 监控和调试

### 日志记录

```typescript
/**
 * MCP 调试日志
 */
export function logMCPDebug(
  serverName: string,
  message: string,
  data?: unknown
): void {
  logForDebugging(`[MCP:${serverName}] ${message}`, data);
}

/**
 * MCP 错误日志
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

### 性能监控

```typescript
/**
 * 记录 MCP 调用性能
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

## 最佳实践

### 1. 连接管理

```typescript
// ✅ 好的做法：连接复用
const pool = new MCPClientPool();
const client = await pool.getClient(serverName);

// ❌ 不好的做法：每次都创建新连接
const transport = new StdioClientTransport(config);
const client = new Client(options);
await client.connect(transport); // 开销大
```

### 2. 错误处理

```typescript
// ✅ 好的做法：细粒度错误处理
try {
  const result = await client.callTool({ name, args });
} catch (error) {
  if (isMcpSessionExpiredError(error)) {
    // 重新连接
    clearClientCache(serverName);
    return await retryAfterReconnect();
  } else if (error instanceof McpAuthError) {
    // 重新认证
    return await reauthenticate();
  } else {
    // 其他错误
    throw error;
  }
}

// ❌ 不好的做法：通用错误处理
try {
  const result = await client.callTool({ name, args });
} catch (error) {
  // 所有错误都重试
  return await retry();
}
```

### 3. 超时配置

```typescript
// ✅ 好的做法：合理设置超时
const timeout = config.timeout || getMcpToolTimeoutMs();
const result = await client.callTool(
  { name, args },
  { timeout }
);

// ❌ 不好的做法：无限等待
const result = await client.callTool({ name, args }); // 可能永久阻塞
```

## 总结

MCP Integration 是 Claude Code 扩展性的核心，通过以下机制实现与外部服务的无缝集成：

1. **标准化协议**：基于 JSON-RPC 2.0 的统一接口
2. **多 Transport 支持**：Stdio、SSE、WebSocket、HTTP
3. **智能工具映射**：MCP 工具自动包装为 Claude Code 工具
4. **完善认证机制**：OAuth 2.0、API Key、自定义认证
5. **健壮的错误处理**：会话过期、认证失败、超时重试
6. **性能优化**：连接复用、并行调用、结果缓存

**关键设计原则：**

- **协议优先**：遵循 MCP 规范确保互操作性
- **安全第一**：认证、授权、沙箱隔离
- **用户友好**：自动重连、错误提示、配置简化
- **性能优化**：连接池、并行调用、智能缓存
- **可扩展性**：易于添加新的 Transport 和认证方式

MCP Integration 的实现展示了如何通过标准化协议实现 AI 应用的可扩展性，这对于构建开放、灵活的 AI 助手系统具有重要的参考价值。

## 扩展阅读

- **MCP 规范**：https://modelcontextprotocol.io/
- **SDK 文档**：`@modelcontextprotocol/sdk`
- **Transport 实现**：`src/services/mcp/client.ts`
- **WebSocket 传输**：`src/utils/mcpWebSocketTransport.ts`

## 下一章

第 11 章将深入探讨 **Agent System（代理系统）**，介绍代理架构、策略模式、任务分解机制和源码分析。
