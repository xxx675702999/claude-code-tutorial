# 第18章 Ink 框架深度解析

## 概述

Ink 是 Claude Code 使用的 React 渲染框架，专为 CLI（命令行界面）设计。它基于 React 构建了声明式的 UI 系统，将 React 的组件模型适配到终端环境。本章将深入分析 Ink 的渲染机制、组件系统、以及如何在 Claude Code 中实现复杂的 CLI 界面。

**本章要点：**

- **Ink 架构**：渲染流程、DOM 树管理、输出处理
- **组件系统**：Hooks、Context、事件处理
- **渲染机制**： reconciliation、调度、diff 算法
- **输出处理**：终端控制、ANSI 转义序列、布局计算
- **性能优化**：渲染优化、内存管理、更新策略
- **源码分析**：8000 LOC 核心代码深度解析

## Ink 架构概览

### 渲染流程

```mermaid
graph TB
    subgraph "Ink Rendering Architecture"
        A[React Components]
        B[React Reconciler]
        C[Ink Renderer]
        D[Output Manager]
        E[Terminal]

        A --> B
        B --> C
        C --> D
        D --> E

        B --> B1[Virtual DOM Tree]
        B --> B2[Diff Algorithm]
        B --> B3[Update Queue]

        C --> C1[DOM Node Creation]
        C --> C2[Layout Calculation]
        C --> C3[Output Generation]

        D --> D1[ANSI Escapes]
        D --> D2[Cursor Control]
        D --> D3[Screen Management]

        E --> E1[stdout]
        E --> E2[stderr]
        E --> E3[stdin]
    end

    style B fill:#e1f5ff
    style C fill:#fff4e1
    style D fill:#e8f5e9
```

### 核心概念

```typescript
// Ink 核心 API
import { render, Box, Text } from 'ink'

// 1. 渲染根组件
const App = () => (
  <Box flexDirection="column">
    <Text color="green">Hello, Ink!</Text>
  </Box>
)

// 2. 挂载到终端
const { rerender, unmount } = render(<App />)

// 3. 更新组件
rerender(<App />)

// 4. 卸载
unmount()
```

## 组件系统

### 内置组件

#### Box 组件

```typescript
// src/components/Box.tsx
export type BoxProps = {
  // 布局属性
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse'
  flexGrow?: number
  flexShrink?: number
  flexBasis?: number | string
  flex?: number

  // 对齐属性
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around'
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch'
  alignSelf?: 'flex-start' | 'flex-end' | 'center' | 'stretch'

  // 间距属性
  padding?: number | string
  margin?: number | string
  gap?: number

  // 尺寸属性
  width?: number | string
  height?: number | string
  minWidth?: number | string
  minHeight?: number | string
  maxWidth?: number | string
  maxHeight?: number | string

  // 样式属性
  borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'normal'
  borderColor?: 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'magenta' | 'white' | 'black'
  backgroundColor?: 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'magenta' | 'white' | 'black'
  dimBorder?: boolean
  hidden?: boolean

  // 文本属性
  textWrap?: 'wrap' | 'end' | 'middle' | 'truncate'
  overflow?: 'wrap' | 'end' | 'middle' | 'truncate'

  // 其他
  children?: React.ReactNode
}

// Box 组件实现
export const Box: React.FC<BoxProps> = ({
  children,
  flexGrow = 0,
  flexShrink = 1,
  flexBasis = 'auto',
  flexDirection = 'row',
  justifyContent = 'flex-start',
  alignItems = 'flex-start',
  padding = 0,
  margin = 0,
  gap = 0,
  width,
  height,
  minWidth,
  minHeight,
  maxWidth,
  maxHeight,
  borderStyle,
  borderColor,
  backgroundColor,
  dimBorder = false,
  hidden = false,
  textWrap = 'wrap',
  overflow = 'wrap',
  ...props
}) => {
  // 计算实际 flex 值
  const flex = flexGrow !== undefined ? `${flexGrow} ${flexShrink} ${flexBasis}` : undefined

  // 应用样式
  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection,
    justifyContent,
    alignItems,
    flex,
    padding: typeof padding === 'number' ? padding : undefined,
    margin: typeof margin === 'number' ? margin : undefined,
    gap,
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    borderStyle,
    borderColor,
    backgroundColor,
    opacity: dimBorder ? 0.5 : undefined,
    display: hidden ? 'none' : 'flex',
    textWrap,
    overflow,
    ...props,
  }

  return <div style={style}>{children}</div>
}
```

#### Text 组件

```typescript
// src/components/Text.tsx
export type TextProps = {
  color?: 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'magenta' | 'white' | 'black' | 'gray'
  backgroundColor?: 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'magenta' | 'white' | 'black' | 'gray'
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  dim?: boolean
  children?: React.ReactNode
}

// Text 组件实现
export const Text: React.FC<TextProps> = ({
  children,
  color,
  backgroundColor,
  bold = false,
  italic = false,
  underline = false,
  strikethrough = false,
  dim = false,
}) => {
  // 构建 ANSI 样式
  const styles: string[] = []

  // 前景色
  if (color) {
    const colorCode = getColorCode(color)
    styles.push(`\x1b[${colorCode}m`)
  }

  // 背景色
  if (backgroundColor) {
    const bgColorCode = getBackgroundColorCode(backgroundColor)
    styles.push(`\x1b[${bgColorCode}m`)
  }

  // 文本样式
  if (bold) styles.push('\x1b[1m')
  if (italic) styles.push('\x1b[3m')
  if (underline) styles.push('\x1b[4m')
  if (strikethrough) styles.push('\x1b[9m')
  if (dim) styles.push('\x1b[2m')

  // 重置样式
  const reset = '\x1b[0m'

  return (
    <span style={{ color, backgroundColor, fontWeight: bold ? 'bold' : undefined, fontStyle: italic ? 'italic' : undefined, textDecoration: underline ? 'underline' : undefined }}>
      {children}
    </span>
  )
}

// 颜色代码映射
function getColorCode(color: string): string {
  const codes: Record<string, string> = {
    black: '30',
    red: '31',
    green: '32',
    yellow: '33',
    blue: '34',
    magenta: '35',
    cyan: '36',
    white: '37',
    gray: '90',
  }

  return codes[color] || '37'
}

function getBackgroundColorCode(color: string): string {
  const codes: Record<string, string> = {
    black: '40',
    red: '41',
    green: '42',
    yellow: '43',
    blue: '44',
    magenta: '45',
    cyan: '46',
    white: '47',
    gray: '100',
  }

  return codes[color] || '47'
}
```

### Hooks 系统

#### useState Hook

```typescript
// src/hooks/useState.ts
export function useState<T>(
  initialValue: T | (() => T)
): [T, (value: T | ((prev: T) => T)) => void] {
  // 计算初始值
  const [state, setState] = React.useState(() =>
    typeof initialValue === 'function'
      ? (initialValue as () => T)()
      : initialValue
  )

  return [
    state,
    (value) => {
      setState(prev => (typeof value === 'function' ? (value as (prev: T) => T)(prev) : value))
    },
  ]
}
```

#### useEffect Hook

```typescript
// src/hooks/useEffect.ts
export function useEffect(
  effect: () => void | (() => void),
  deps?: React.DependencyList
): void {
  React.useEffect(effect, deps)
}
```

#### useApp Hook

```typescript
// src/hooks/useApp.ts
export interface AppContext {
  exit: (error?: Error) => void
  readonly stdin: NodeJS.ReadStream
  readonly stdout: NodeJS.WriteStream
  readonly stderr: NodeJS.WriteStream
}

export function useApp(): AppContext {
  const context = React.useContext(AppContext)

  if (!context) {
    throw new Error('useApp must be used within <App> component')
  }

  return context
}
```

#### useInput Hook

```typescript
// src/hooks/useInput.ts
export type InputHandler = (input: string, key: Key) => void

export interface Key {
  name?: string
  sequence: string
  ctrl: boolean
  meta: boolean
  shift: boolean
  option: boolean
}

export function useInput(
  inputHandler: InputHandler,
  options?: {
    active?: boolean
  }
): void {
  const { stdin, setRawMode } = useApp()

  useEffect(() => {
    if (options?.active === false) {
      return
    }

    setRawMode(true)

    const handleData = (data: Buffer) => {
      const input = data.toString('utf8')
      const key = parseKey(input)

      inputHandler(input, key)
    }

    stdin.on('data', handleData)

    return () => {
      stdin.removeListener('data', handleData)
      setRawMode(false)
    }
  }, [inputHandler, options?.active, stdin, setRawMode])
}

function parseKey(input: string): Key {
  const key: Key = {
    sequence: input,
    ctrl: false,
    meta: false,
    shift: false,
    option: false,
  }

  // 解析控制键
  if (input.includes('\x1b')) {
    key.meta = true
  }

  if (input.charCodeAt(0) < 32) {
    key.ctrl = true
  }

  // 解析特殊键
  const keyMap: Record<string, string> = {
    '\r': 'return',
    '\n': 'return',
    '\t': 'tab',
    '\x1b': 'escape',
    ' ': 'space',
  }

  key.name = keyMap[input] || undefined

  return key
}
```

#### useStdoutDimensions Hook

```typescript
// src/hooks/useStdoutDimensions.ts
export function useStdoutDimensions(): [number, number] {
  const { stdout } = useApp()
  const [dimensions, setDimensions] = React.useState(() => ({
    columns: stdout.columns,
    rows: stdout.rows,
  }))

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        columns: stdout.columns,
        rows: stdout.rows,
      })
    }

    stdout.on('resize', handleResize)

    return () => {
      stdout.removeListener('resize', handleResize)
    }
  }, [stdout])

  return [dimensions.columns, dimensions.rows]
}
```

## 渲染机制

### Reconciliation 过程

```typescript
// src/renderer/reconciler.ts
export function reconcile(
  element: React.ReactElement,
  container: DOMNode,
  callback?: () => void
): void {
  // 1. 创建 Fiber 树
  const fiber = createFiberFromElement(element)

  // 2. 调度更新
  scheduleUpdate(fiber)

  // 3. 执行工作循环
  workLoop()

  // 4. 提交更新
  commitRoot()

  // 5. 调用回调
  callback?.()
}

function createFiberFromElement(element: React.ReactElement): FiberNode {
  return {
    type: element.type,
    key: element.key,
    props: element.props,
    stateNode: null,
    child: null,
    sibling: null,
    return: null,
    alternate: null,
    effectTag: 'PLACEMENT',
  }
}

function workLoop(): void {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress)
  }
}

function performUnitOfWork(unitOfWork: FiberNode): void {
  // 1. 开始阶段
  const next = beginWork(unitOfWork)

  if (next === null) {
    // 2. 完成阶段
    completeWork(unitOfWork)
  } else {
    workInProgress = next
  }
}
```

### Diff 算法

```typescript
// src/renderer/diff.ts
export function reconcileChildren(
  current: FiberNode | null,
  workInProgress: FiberNode,
  nextChildren: React.ReactNode
): void {
  // 1. 如果是初次渲染
  if (current === null) {
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren)
    return
  }

  // 2. 如果有之前的子节点
  workInProgress.child = reconcileChildFibers(
    workInProgress,
    current.child,
    nextChildren
  )
}

function reconcileChildFibers(
  returnFiber: FiberNode,
  currentFirstChild: FiberNode | null,
  newChild: React.ReactNode
): FiberNode | null {
  // 1. 处理单一子节点
  if (typeof newChild === 'object' && newChild !== null && !Array.isArray(newChild)) {
    const element = newChild as React.ReactElement

    // 比较 key
    if (element.key === currentFirstChild?.key) {
      // key 相同，更新
      const existing = useFiber(currentFirstChild, element.props)
      return existing
    } else {
      // key 不同，替换
      const created = createFiberFromElement(element)
      created.return = returnFiber
      return created
    }
  }

  // 2. 处理多个子节点
  return reconcileChildrenArray(returnFiber, currentFirstChild, newChild as React.ReactNode[])
}

function reconcileChildrenArray(
  returnFiber: FiberNode,
  currentFirstChild: FiberNode | null,
  newChildren: React.ReactNode[]
): FiberNode | null {
  // 1. 构建 key 索引
  const existingChildren = mapRemainingChildren(returnFiber, currentFirstChild)

  // 2. 遍历新子节点
  let resultingFirstChild: FiberNode | null = null
  let previousNewFiber: FiberNode | null = null
  let oldFiber: FiberNode | null = currentFirstChild
  let lastPlacedIndex = 0
  let newIdx = 0
  let nextOldFiber: FiberNode | null = null

  for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
    const newChild = newChildren[newIdx] as React.ReactElement

    if (newChild.key !== oldFiber?.key) {
      nextOldFiber = oldFiber
      break
    }

    const newFiber = updateSlot(returnFiber, oldFiber, newChild)

    if (newFiber === null) {
      // 删除
      deleteChild(returnFiber, oldFiber)
      oldFiber = oldFiber.sibling
      continue
    }

    if (shouldTrackSideEffects) {
      newFiber.flags |= Placement
    }

    lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)

    if (previousNewFiber === null) {
      resultingFirstChild = newFiber
    } else {
      previousNewFiber.sibling = newFiber
    }

    previousNewFiber = newFiber
    oldFiber = oldFiber.sibling
  }

  // 3. 处理剩余的新子节点
  if (newIdx < newChildren.length) {
    const newChildren2 = newChildren.slice(newIdx)
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = createFiberFromElement(newChildren2[newIdx] as React.ReactElement)
      newFiber.return = returnFiber

      if (previousNewFiber === null) {
        resultingFirstChild = newFiber
      } else {
        previousNewFiber.sibling = newFiber
      }

      previousNewFiber = newFiber
    }
  }

  // 4. 删除剩余的旧子节点
  if (oldFiber !== null) {
    deleteRemainingChildren(returnFiber, oldFiber)
  }

  return resultingFirstChild
}
```

## 输出处理

### ANSI 转义序列

```typescript
// src/output/ansi.ts
export type ANSIStyle = {
  foreground?: string
  background?: string
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
}

export function applyANSIStyles(text: string, styles: ANSIStyle): string {
  let output = text
  const codes: string[] = []

  // 应用样式
  if (styles.foreground) {
    codes.push(getForegroundCode(styles.foreground))
  }

  if (styles.background) {
    codes.push(getBackgroundCode(styles.background))
  }

  if (styles.bold) codes.push('1')
  if (styles.dim) codes.push('2')
  if (styles.italic) codes.push('3')
  if (styles.underline) codes.push('4')
  if (styles.strikethrough) codes.push('9')

  // 应用转义序列
  if (codes.length > 0) {
    output = `\x1b[${codes.join(';')}m${output}\x1b[0m`
  }

  return output
}

function getForegroundCode(color: string): string {
  const codes: Record<string, string> = {
    black: '30',
    red: '31',
    green: '32',
    yellow: '33',
    blue: '34',
    magenta: '35',
    cyan: '36',
    white: '37',
  }

  return codes[color] || '37'
}

function getBackgroundCode(color: string): string {
  const codes: Record<string, string> = {
    black: '40',
    red: '41',
    green: '42',
    yellow: '43',
    blue: '44',
    magenta: '45',
    cyan: '46',
    white: '47',
  }

  return codes[color] || '47'
}
```

### 光标控制

```typescript
// src/output/cursor.ts
export type CursorPosition = {
  x: number
  y: number
}

export function moveCursorTo(position: CursorPosition): string {
  return `\x1b[${position.y + 1};${position.x + 1}H`
}

export function moveCursorUp(rows: number): string {
  return `\x1b[${rows}A`
}

export function moveCursorDown(rows: number): string {
  return `\x1b[${rows}B`
}

export function moveCursorLeft(columns: number): string {
  return `\x1b[${columns}D`
}

export function moveCursorRight(columns: number): string {
  return `\x1b[${columns}C`
}

export function hideCursor(): string {
  return '\x1b[?25l'
}

export function showCursor(): string {
  return '\x1b[?25h'
}

export function saveCursor(): string {
  return '\x1b[s'
}

export function restoreCursor(): string {
  return '\x1b[u'
}
```

### 屏幕管理

```typescript
// src/output/screen.ts
export function clearScreen(): string {
  return '\x1b[2J'
}

export function clearLine(): string {
  return '\x1b[2K'
}

export function clearLineDown(): string {
  return '\x1b[0J'
}

export function clearLineUp(): string {
  return '\x1b[1J'
}

export function eraseLines(count: number): string {
  let output = clearLine()

  for (let i = 1; i < count; i++) {
    output += moveCursorUp(1) + clearLine()
  }

  return output
}
```

### 布局计算

```typescript
// src/layout/layout.ts
export type LayoutNode = {
  type: string
  props: Record<string, unknown>
  children: LayoutNode[]
  dimensions: {
    x: number
    y: number
    width: number
    height: number
  }
}

export function calculateLayout(
  node: LayoutNode,
  parentDimensions: { width: number; height: number }
): void {
  const { flexDirection, justifyContent, alignItems, padding, gap } = node.props

  // 1. 计算自身尺寸
  const ownWidth = calculateWidth(node, parentDimensions.width)
  const ownHeight = calculateHeight(node, parentDimensions.height)

  // 2. 计算子节点布局
  const children = node.children
  const availableWidth = ownWidth - (padding || 0) * 2
  const availableHeight = ownHeight - (padding || 0) * 2

  let currentX = padding || 0
  let currentY = padding || 0

  for (const child of children) {
    calculateLayout(child, { width: availableWidth, height: availableHeight })

    // 定位子节点
    if (flexDirection === 'row') {
      child.dimensions.x = currentX
      child.dimensions.y = currentY
      currentX += child.dimensions.width + (gap || 0)
    } else if (flexDirection === 'column') {
      child.dimensions.x = currentX
      child.dimensions.y = currentY
      currentY += child.dimensions.height + (gap || 0)
    }

    // 应用对齐
    applyAlignment(child, justifyContent, alignItems, availableWidth, availableHeight)
  }

  // 3. 更新节点尺寸
  node.dimensions = {
    x: 0,
    y: 0,
    width: ownWidth,
    height: ownHeight,
  }
}

function calculateWidth(node: LayoutNode, availableWidth: number): number {
  const { width, minWidth, maxWidth, flexGrow, flexShrink, flexBasis } = node.props

  if (typeof width === 'number') {
    return Math.min(Math.max(width, minWidth || 0), maxWidth || availableWidth)
  }

  if (typeof width === 'string') {
    if (width.endsWith('%')) {
      const percentage = parseFloat(width) / 100
      return availableWidth * percentage
    }
  }

  // flex 布局
  const basis = typeof flexBasis === 'number' ? flexBasis : availableWidth
  return Math.min(Math.max(basis, minWidth || 0), maxWidth || availableWidth)
}

function calculateHeight(node: LayoutNode, availableHeight: number): number {
  const { height, minHeight, maxHeight, flexGrow, flexShrink, flexBasis } = node.props

  if (typeof height === 'number') {
    return Math.min(Math.max(height, minHeight || 0), maxHeight || availableHeight)
  }

  if (typeof height === 'string') {
    if (height.endsWith('%')) {
      const percentage = parseFloat(height) / 100
      return availableHeight * percentage
    }
  }

  // flex 布局
  const basis = typeof flexBasis === 'number' ? flexBasis : availableHeight
  return Math.min(Math.max(basis, minHeight || 0), maxHeight || availableHeight)
}

function applyAlignment(
  node: LayoutNode,
  justifyContent: string,
  alignItems: string,
  availableWidth: number,
  availableHeight: number
): void {
  const { dimensions } = node

  // 主轴对齐
  switch (justifyContent) {
    case 'center':
      dimensions.x = (availableWidth - dimensions.width) / 2
      break
    case 'flex-end':
      dimensions.x = availableWidth - dimensions.width
      break
    case 'space-between':
      // 需要多个子节点
      break
    case 'space-around':
      // 需要多个子节点
      break
  }

  // 交叉轴对齐
  switch (alignItems) {
    case 'center':
      dimensions.y = (availableHeight - dimensions.height) / 2
      break
    case 'flex-end':
      dimensions.y = availableHeight - dimensions.height
      break
    case 'stretch':
      dimensions.height = availableHeight
      break
  }
}
```

## 性能优化

### 渲染优化

```typescript
// src/optimization/renderBatch.ts
export class RenderBatch {
  private pendingUpdates: Set<React.ReactNode> = new Set()
  private rafId: number | null = null

  schedule(update: React.ReactNode): void {
    this.pendingUpdates.add(update)

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.flush()
      })
    }
  }

  private flush(): void {
    const updates = Array.from(this.pendingUpdates)
    this.pendingUpdates.clear()
    this.rafId = null

    // 批量渲染
    for (const update of updates) {
      render(update)
    }
  }
}
```

### 虚拟滚动

```typescript
// src/optimization/virtualList.ts
export function VirtualList<T>({
  items,
  itemHeight,
  height,
  renderItem,
}: {
  items: T[]
  itemHeight: number
  height: number
  renderItem: (item: T, index: number) => React.ReactNode
}): React.ReactElement {
  const [scrollTop, setScrollTop] = React.useState(0)

  // 计算可见范围
  const visibleCount = Math.ceil(height / itemHeight)
  const startIndex = Math.floor(scrollTop / itemHeight)
  const endIndex = Math.min(startIndex + visibleCount, items.length - 1)

  // 渲染可见项
  const visibleItems = items.slice(startIndex, endIndex + 1)

  return (
    <Box height={height} overflowY="scroll" onScroll={(e) => setScrollTop(e.scrollTop)}>
      <Box height={items.length * itemHeight} position="relative">
        {visibleItems.map((item, index) => (
          <Box
            key={startIndex + index}
            position="absolute"
            top={(startIndex + index) * itemHeight}
            left={0}
            right={0}
            height={itemHeight}
          >
            {renderItem(item, startIndex + index)}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
```

### 内存管理

```typescript
// src/optimization/memory.ts
export function cleanupUnusedNodes(): void {
  // 清理未使用的节点
  const nodes = getAllNodes()

  for (const node of nodes) {
    if (!isNodeUsed(node)) {
      destroyNode(node)
    }
  }
}

export function limitNodeCache(maxSize: number): void {
  const cache = getNodeCache()

  if (cache.size > maxSize) {
    const entries = Array.from(cache.entries())
    const toRemove = entries.slice(0, cache.size - maxSize)

    for (const [key] of toRemove) {
      cache.delete(key)
    }
  }
}
```

## 源码分析

### 核心文件结构

```
ink/
├── src/
│   ├── components/      # 内置组件
│   │   ├── Box.tsx
│   │   ├── Text.tsx
│   │   └── App.tsx
│   ├── hooks/          # 自定义 Hooks
│   │   ├── useState.ts
│   │   ├── useEffect.ts
│   │   ├── useApp.ts
│   │   ├── useInput.ts
│   │   └── useStdoutDimensions.ts
│   ├── renderer/       # 渲染器
│   │   ├── reconciler.ts
│   │   ├── diff.ts
│   │   └── scheduler.ts
│   ├── output/         # 输出处理
│   │   ├── ansi.ts
│   │   ├── cursor.ts
│   │   └── screen.ts
│   ├── layout/         # 布局计算
│   │   └── layout.ts
│   └── optimization/   # 性能优化
│       ├── renderBatch.ts
│       ├── virtualList.ts
│       └── memory.ts
└── index.ts
```

### 关键代码片段

#### render 函数实现

```typescript
// src/render.ts
export function render(
  element: React.ReactElement,
  options?: {
    stdout?: NodeJS.WriteStream
    stdin?: NodeJS.ReadStream
    stderr?: NodeJS.WriteStream
    debug?: boolean
  }
): {
  rerender: (element: React.ReactElement) => void
  unmount: () => void
  waitUntilExit: () => Promise<void>
} {
  const { stdout = process.stdout, stdin = process.stdin, stderr = process.stderr, debug = false } = options || {}

  // 1. 创建渲染器
  const renderer = createRenderer({
    stdout,
    stdin,
    stderr,
    debug,
  })

  // 2. 初始渲染
  let fiberRoot = renderer.createContainer(element)

  // 3. 返回控制接口
  return {
    rerender: (newElement) => {
      fiberRoot = renderer.updateContainer(newElement)
    },
    unmount: () => {
      renderer.cleanup()
    },
    waitUntilExit: () => {
      return new Promise((resolve) => {
        renderer.on('exit', resolve)
      })
    },
  }
}
```

#### DOM 节点创建

```typescript
// src/renderer/dom.ts
export function createDOMElement(
  type: string,
  props: Record<string, unknown>
): DOMNode {
  const node: DOMNode = {
    type,
    props,
    children: [],
    parent: null,
    textContent: '',
  }

  // 处理子节点
  if (props.children) {
    const children = Array.isArray(props.children) ? props.children : [props.children]

    for (const child of children) {
      if (typeof child === 'string') {
        node.textContent += child
      } else if (child != null) {
        const childNode = createDOMElement((child as React.ReactElement).type, (child as React.ReactElement).props)
        childNode.parent = node
        node.children.push(childNode)
      }
    }
  }

  return node
}
```

## 实战案例

### 案例1：构建交互式菜单

```typescript
// examples/interactive-menu.tsx
import { render, Box, Text, useInput, useApp } from 'ink'

interface MenuItem {
  label: string
  action: () => void
}

const Menu = ({ items }: { items: MenuItem[] }) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1))
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(items.length - 1, selectedIndex + 1))
    } else if (key.return) {
      items[selectedIndex].action()
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Select an option:
      </Text>
      {items.map((item, index) => (
        <Box key={index}>
          <Text color={index === selectedIndex ? 'green' : 'white'}>
            {index === selectedIndex ? '> ' : '  '}
            {item.label}
          </Text>
        </Box>
      ))}
      <Text dimColor color="gray">
        Use arrow keys to navigate, Enter to select
      </Text>
    </Box>
  )
}

const App = () => {
  const { exit } = useApp()

  const menuItems: MenuItem[] = [
    { label: 'Option 1', action: () => console.log('Selected Option 1') },
    { label: 'Option 2', action: () => console.log('Selected Option 2') },
    { label: 'Option 3', action: () => console.log('Selected Option 3') },
    { label: 'Exit', action: () => exit() },
  ]

  return <Menu items={menuItems} />
}

render(<App />)
```

### 案例2：进度条组件

```typescript
// examples/progress-bar.tsx
import { render, Box, Text, useEffect, useState } from 'ink'

interface ProgressBarProps {
  percent: number
  width?: number
  character?: string
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  width = 40,
  character = '█',
}) => {
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled

  return (
    <Box>
      <Text color="cyan">
        {'['}
        <Text color="green">{character.repeat(filled)}</Text>
        {' '.repeat(empty)}
        {']'} {percent}%
      </Text>
    </Box>
  )
}

const App = () => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => Math.min(100, prev + 1))
    }, 100)

    return () => clearInterval(interval)
  }, [])

  return (
    <Box flexDirection="column" padding={1}>
      <Text>Downloading file...</Text>
      <ProgressBar percent={progress} />
    </Box>
  )
}

render(<App />)
```

## 最佳实践

### 1. 组件设计

- **单一职责**：每个组件只负责一个功能
- **Props 接口**：明确定义 Props 类型
- **可复用性**：设计通用、可配置的组件

### 2. 性能优化

- **避免不必要的渲染**：使用 React.memo、useMemo
- **批量更新**：使用 RenderBatch 批量处理更新
- **虚拟化长列表**：使用 VirtualList 组件

### 3. 错误处理

- **边界错误**：使用 ErrorBoundary 捕获组件错误
- **优雅降级**：提供降级 UI
- **错误日志**：记录错误信息

## 总结

Ink 框架的核心特性：

1. **声明式 UI**：基于 React 的组件模型
2. **强大的布局**：Flexbox 布局系统
3. **丰富的组件**：Box、Text 等内置组件
4. **自定义 Hooks**：useInput、useApp 等实用 Hooks
5. **高效渲染**：优化的 reconciliation 和 diff 算法
6. **终端控制**：ANSI 转义序列、光标控制、屏幕管理

掌握 Ink 框架，可以构建复杂、美观、高性能的 CLI 应用界面。
