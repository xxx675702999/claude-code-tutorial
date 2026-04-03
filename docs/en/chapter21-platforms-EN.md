# Chapter 21: Platform Differentiation

## Overview

Claude Code needs to run on multiple platforms, including Windows, macOS, Linux, and WSL (Windows Subsystem for Linux). Each platform has unique characteristics and limitations that require platform-specific handling to ensure consistent user experience. This chapter will deeply analyze platform detection, path handling, system call encapsulation, and compatibility strategies.

**Chapter Highlights:**

- **Platform Detection**: Runtime identification, feature detection, environment judgment
- **Path Handling**: Path separators, absolute/relative paths, path normalization
- **System Calls**: Cross-platform encapsulation, fallback schemes, performance optimization
- **Compatibility Strategies**: Polyfill, Feature Detection, Graceful Degradation
- **WSL Special Handling**: File system performance, interop limitations
- **Real-World Cases**: Common platform issue resolution

## Platform Detection

### Runtime Identification

```typescript
// src/platform/detection.ts
export type Platform = 'windows' | 'macos' | 'linux' | 'wsl' | 'unknown'

export type PlatformInfo = {
  platform: Platform
  version: string
  arch: string
  isWSL: boolean
  isBashOnWindows: boolean
  features: PlatformFeatures
}

export type PlatformFeatures = {
  symlinks: boolean
  caseSensitive: boolean
  nativeNotify: boolean
  fsEvents: boolean
  permissions: boolean
  executableExtensions: string[]
  pathSeparator: string
  pathDelimiter: string
}

export function detectPlatform(): PlatformInfo {
  const platform = process.platform as NodeJS.Platform
  const arch = process.arch
  const version = process.version

  // Detect WSL
  const isWSL = checkIsWSL()

  // Detect Bash on Windows
  const isBashOnWindows = platform === 'win32' && process.env.SHELL?.includes('bash')

  // Detect platform features
  const features: PlatformFeatures = {
    symlinks: hasSymlinkSupport(),
    caseSensitive: isCaseSensitive(platform),
    nativeNotify: hasNativeNotify(platform),
    fsEvents: hasFSEventsSupport(platform),
    permissions: hasPermissionSupport(platform),
    executableExtensions: getExecutableExtensions(platform),
    pathSeparator: getPathSeparator(platform),
    pathDelimiter: getPathDelimiter(platform),
  }

  let normalizedPlatform: Platform = 'unknown'

  if (platform === 'win32') {
    normalizedPlatform = 'windows'
  } else if (platform === 'darwin') {
    normalizedPlatform = 'macos'
  } else if (platform === 'linux') {
    normalizedPlatform = isWSL ? 'wsl' : 'linux'
  }

  return {
    platform: normalizedPlatform,
    version,
    arch,
    isWSL,
    isBashOnWindows,
    features,
  }
}

function checkIsWSL(): boolean {
  // Method 1: Check /proc/version
  try {
    const version = fs.readFileSync('/proc/version', 'utf-8')
    if (version.includes('Microsoft') || version.includes('WSL')) {
      return true
    }
  } catch {}

  // Method 2: Check environment variables
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) {
    return true
  }

  // Method 3: uname -a
  try {
    const uname = require('child_process').execSync('uname -a').toString()
    if (uname.includes('microsoft')) {
      return true
    }
  } catch {}

  return false
}

function hasSymlinkSupport(): boolean {
  try {
    fs.readlinkSync(process.cwd())
    return true
  } catch {}
  return true // Most modern systems support it
}

function isCaseSensitive(platform: NodeJS.Platform): boolean {
  return platform !== 'win32' && platform !== 'darwin'
}

function hasNativeNotify(platform: NodeJS.Platform): boolean {
  return platform === 'darwin' || platform === 'linux'
}

function hasFSEventsSupport(platform: NodeJS.Platform): boolean {
  return platform === 'darwin' || platform === 'linux'
}

function hasPermissionSupport(platform: NodeJS.Platform): boolean {
  return platform !== 'win32'
}

function getExecutableExtensions(platform: NodeJS.Platform): string[] {
  if (platform === 'win32') {
    return ['.exe', '.cmd', '.bat', '.ps1']
  }
  return ['']
}

function getPathSeparator(platform: NodeJS.Platform): string {
  return platform === 'win32' ? '\\' : '/'
}

function getPathDelimiter(platform: NodeJS.Platform): string {
  return platform === 'win32' ? ';' : ':'
}
```

### Feature Detection

```typescript
// src/platform/featureDetection.ts
export class FeatureDetector {
  private cache = new Map<string, boolean>()

  async hasFeature(feature: string): Promise<boolean> {
    if (this.cache.has(feature)) {
      return this.cache.get(feature)!
    }

    const result = await this.detectFeature(feature)
    this.cache.set(feature, result)

    return result
  }

  private async detectFeature(feature: string): Promise<boolean> {
    switch (feature) {
      case 'symlink':
        return this.testSymlink()

      case 'case-sensitive':
        return this.testCaseSensitive()

      case 'native-notify':
        return this.testNativeNotify()

      case 'fs-events':
        return this.testFSEvents()

      case 'inotify':
        return this.testInotify()

      case 'kqueue':
        return this.testKqueue()

      default:
        return false
    }
  }

  private async testSymlink(): Promise<boolean> {
    const tempDir = os.tmpdir()
    const source = join(tempDir, `test-source-${Date.now()}`)
    const target = join(tempDir, `test-target-${Date.now()}`)

    try {
      fs.writeFileSync(source, 'test')
      fs.symlinkSync(source, target)
      return true
    } catch {
      return false
    } finally {
      try {
        fs.unlinkSync(target)
        fs.unlinkSync(source)
      } catch {}
    }
  }

  private async testCaseSensitive(): Promise<boolean> {
    const tempDir = os.tmpdir()
    const file1 = join(tempDir, `test-${Date.now()}.txt`)
    const file2 = join(tempDir, `TEST-${Date.now()}.txt`)

    try {
      fs.writeFileSync(file1, 'test1')

      // Try creating with different case
      try {
        fs.writeFileSync(file2, 'test2')
        // If successful, filesystem is case-sensitive
        return true
      } catch {
        // If failed, filesystem is case-insensitive
        return false
      }
    } finally {
      try {
        fs.unlinkSync(file1)
        fs.unlinkSync(file2)
      } catch {}
    }
  }

  private async testNativeNotify(): Promise<boolean> {
    const platformInfo = detectPlatform()

    if (platformInfo.platform === 'macos') {
      return this.testTerminalNotifier()
    } else if (platformInfo.platform === 'linux') {
      return this.testLibnotify()
    } else if (platformInfo.platform === 'windows') {
      return this.testWindowsNotify()
    }

    return false
  }

  private async testTerminalNotifier(): Promise<boolean> {
    try {
      require('child_process').execSync('which terminal-notifier')
      return true
    } catch {}
    return false
  }

  private async testLibnotify(): Promise<boolean> {
    try {
      require('child_process').execSync('which notify-send')
      return true
    } catch {}
    return false
  }

  private async testWindowsNotify(): Promise<boolean> {
    return process.platform === 'win32'
  }

  private async testFSEvents(): Promise<boolean> {
    return new Promise(resolve => {
      if (process.platform === 'darwin') {
        resolve(true)
        return
      }

      if (process.platform === 'linux') {
        try {
          require('child_process').execSync('which inotifywait')
          resolve(true)
          return
        } catch {}
      }

      resolve(false)
    })
  }

  private async testInotify(): Promise<boolean> {
    try {
      require('child_process').execSync('cat /proc/filesystems | grep inotify')
      return true
    } catch {}
    return false
  }

  private async testKqueue(): Promise<boolean> {
    return process.platform === 'darwin' || process.platform === 'freebsd'
  }
}
```

## Path Handling

### Path Normalization

```typescript
// src/platform/paths.ts
export class PathNormalizer {
  private platformInfo: PlatformInfo

  constructor() {
    this.platformInfo = detectPlatform()
  }

  normalize(path: string): string {
    // 1. Unify path separators
    let normalized = this.unifySeparators(path)

    // 2. Resolve relative paths
    normalized = this.resolveRelative(normalized)

    // 3. Remove redundant separators
    normalized = this.removeRedundantSeparators(normalized)

    // 4. Handle special paths
    normalized = this.handleSpecialPaths(normalized)

    return normalized
  }

  private unifySeparators(path: string): string {
    const separator = this.platformInfo.features.pathSeparator

    // Unify to forward slash (internal representation)
    let unified = path.replace(/\\/g, '/')

    // Remove consecutive slashes
    unified = unified.replace(/\/+/g, '/')

    // If Windows, convert to backslash
    if (this.platformInfo.platform === 'windows') {
      unified = unified.replace(/\//g, '\\')
    }

    return unified
  }

  private resolveRelative(path: string): string {
    // Resolve .. and .
    const parts = path.split(/[/\\]/)
    const resolved: string[] = []

    for (const part of parts) {
      if (part === '..') {
        resolved.pop()
      } else if (part !== '.') {
        resolved.push(part)
      }
    }

    return resolved.join(this.platformInfo.features.pathSeparator)
  }

  private removeRedundantSeparators(path: string): string {
    // Remove trailing separator (except root)
    if (path.length > 1 && path.endsWith(this.platformInfo.features.pathSeparator)) {
      return path.slice(0, -1)
    }

    return path
  }

  private handleSpecialPaths(path: string): string {
    // Handle ~
    if (path.startsWith('~')) {
      const homeDir = os.homedir()
      return join(homeDir, path.slice(1))
    }

    // Handle environment variables
    if (path.startsWith('$')) {
      const match = path.match(/^\$([A-Z_]+)(\/.*)?$/)
      if (match) {
        const envVar = process.env[match[1]]
        if (envVar) {
          return join(envVar, match[2] || '')
        }
      }
    }

    return path
  }

  join(...paths: string[]): string {
    // Use path.join but handle cross-platform cases
    return this.normalize(path.join(...paths))
  }

  relative(from: string, to: string): string {
    const normalizedFrom = this.normalize(from)
    const normalizedTo = this.normalize(to)

    return path.relative(normalizedFrom, normalizedTo)
  }

  isAbsolute(path: string): boolean {
    const normalized = this.normalize(path)

    if (this.platformInfo.platform === 'windows') {
      // Windows: C:\ or \\server\share
      return /^[A-Za-z]:\\/.test(normalized) || /^\\\\[^\\]+\\/.test(normalized)
    }

    // Unix/Linux/macOS: /
    return normalized.startsWith('/')
  }

  basename(path: string, ext?: string): string {
    const normalized = this.normalize(path)
    const base = path.basename(normalized, ext)

    // Handle Windows drive
    if (this.platformInfo.platform === 'windows') {
      return base.replace(/:$/, '')
    }

    return base
  }

  dirname(path: string): string {
    const normalized = this.normalize(path)
    return path.dirname(normalized)
  }

  extname(path: string): string {
    return path.extname(path)
  }

  parse(path: string): path.ParsedPath {
    const normalized = this.normalize(path)
    return path.parse(normalized)
  }
}
```

### Path Conversion

```typescript
// src/platform/pathConverter.ts
export class PathConverter {
  private platformInfo: PlatformInfo

  constructor() {
    this.platformInfo = detectPlatform()
  }

  toPOSIX(path: string): string {
    // Convert to POSIX-style path (/ separator)
    let posix = path.replace(/\\/g, '/')

    // Handle Windows drive
    posix = posix.replace(/^([A-Za-z]):\//, '/$1/')

    return posix
  }

  toWindows(path: string): string {
    // Convert to Windows-style path (\ separator)
    let windows = path.replace(/\//g, '\\')

    // Handle drive
    windows = windows.replace(/^\/([A-Za-z])\//, '$1:\\\\')

    return windows
  }

  toNative(path: string): string {
    if (this.platformInfo.platform === 'windows') {
      return this.toWindows(path)
    }

    return this.toPOSIX(path)
  }

  fromPOSIX(path: string): string {
    // Convert from POSIX path to current platform path
    return this.toNative(path)
  }

  toURL(path: string): string {
    // Convert to file:// URL
    const absolute = this.resolve(path)

    if (this.platformInfo.platform === 'windows') {
      // Windows: file:///C:/path
      const drive = absolute.charAt(0)
      const rest = absolute.slice(2).replace(/\\/g, '/')
      return `file:///${drive}:${rest}`
    }

    // Unix/Linux/macOS: file:///path
    const rest = absolute.replace(/\\/g, '/')
    return `file://${rest}`
  }

  fromURL(url: string): string {
    // Convert from file:// URL to local path
    if (!url.startsWith('file://')) {
      throw new Error('Not a file:// URL')
    }

    let path = url.slice(7) // Remove file://

    if (this.platformInfo.platform === 'windows') {
      // Windows: file:///C:/path -> C:\path
      const drive = path.charAt(0)
      const rest = path.slice(2).replace(/\//g, '\\')
      return `${drive}:${rest}`
    }

    // Unix/Linux/macOS: file:///path -> /path
    return path.replace(/\//g, this.platformInfo.features.pathSeparator)
  }

  resolve(...paths: string[]): string {
    // Resolve to absolute path
    const resolved = path.resolve(...paths)
    return this.normalize(resolved)
  }
}
```

## System Call Encapsulation

### File System Operations

```typescript
// src/platform/fs.ts
export class CrossPlatformFS {
  private platformInfo: PlatformInfo
  private pathNormalizer: PathNormalizer

  constructor() {
    this.platformInfo = detectPlatform()
    this.pathNormalizer = new PathNormalizer()
  }

  async readFile(path: string, options?: { encoding?: BufferEncoding }): Promise<string> {
    const normalizedPath = this.pathNormalizer.normalize(path)

    // WSL special handling: use /mnt/c path
    const wslPath = this.convertToWSLPath(normalizedPath)

    return fs.promises.readFile(wslPath, {
      encoding: options?.encoding || 'utf-8',
    })
  }

  async writeFile(path: string, content: string): Promise<void> {
    const normalizedPath = this.pathNormalizer.normalize(path)
    const wslPath = this.convertToWSLPath(normalizedPath)

    // Ensure directory exists
    const dir = path.dirname(wslPath)
    await fs.promises.mkdir(dir, { recursive: true })

    await fs.promises.writeFile(wslPath, content, 'utf-8')
  }

  async readdir(path: string): Promise<string[]> {
    const normalizedPath = this.pathNormalizer.normalize(path)
    const wslPath = this.convertToWSLPath(normalizedPath)

    return fs.promises.readdir(wslPath)
  }

  async stat(path: string): Promise<fs.Stats> {
    const normalizedPath = this.pathNormalizer.normalize(path)
    const wslPath = this.convertToWSLPath(normalizedPath)

    return fs.promises.stat(wslPath)
  }

  async symlink(target: string, source: string): Promise<void> {
    // Check symlink support
    if (!this.platformInfo.features.symlinks) {
      throw new Error('Symlinks not supported on this platform')
    }

    const normalizedTarget = this.pathNormalizer.normalize(target)
    const normalizedSource = this.pathNormalizer.normalize(source)

    const wslTarget = this.convertToWSLPath(normalizedTarget)
    const wslSource = this.convertToWSLPath(normalizedSource)

    await fs.promises.symlink(wslTarget, wslSource)
  }

  async realpath(path: string): Promise<string> {
    const normalizedPath = this.pathNormalizer.normalize(path)
    const wslPath = this.convertToWSLPath(normalizedPath)

    try {
      const resolved = await fs.promises.realpath(wslPath)
      return this.convertFromWSLPath(resolved)
    } catch {
      return normalizedPath
    }
  }

  private convertToWSLPath(path: string): string {
    if (!this.platformInfo.isWSL) {
      return path
    }

    // Windows path to WSL path conversion
    // C:\path -> /mnt/c/path
    const match = path.match(/^([A-Za-z]):\\(.*)$/)
    if (match) {
      const drive = match[1].toLowerCase()
      const rest = match[2].replace(/\\/g, '/')
      return `/mnt/${drive}/${rest}`
    }

    // UNC path
    const uncMatch = path.match(/^\\\\([^\\]+)\\(.*)$/)
    if (uncMatch) {
      const server = uncMatch[1]
      const share = uncMatch[2].replace(/\\/g, '/')
      return `//mnt/share/${server}/${share}`
    }

    return path
  }

  private convertFromWSLPath(path: string): string {
    if (!this.platformInfo.isWSL) {
      return path
    }

    // WSL path to Windows path conversion
    // /mnt/c/path -> C:\path
    const match = path.match(/^\/mnt\/([a-z])\/(.*)$/)
    if (match) {
      const drive = match[1].toUpperCase()
      const rest = match[2].replace(/\//g, '\\')
      return `${drive}:\\${rest}`
    }

    return path
  }
}
```

### Process Management

```typescript
// src/platform/process.ts
export class CrossPlatformProcess {
  private platformInfo: PlatformInfo

  constructor() {
    this.platformInfo = detectPlatform()
  }

  async spawn(
    command: string,
    args?: string[],
    options?: { cwd?: string; env?: Record<string, string>; shell?: boolean }
  ): Promise<ChildProcess> {
    const platform = this.platformInfo.platform

    // Default to shell on Windows
    const shell = options?.shell !== undefined ? options.shell : platform === 'windows'

    // Process command
    let actualCommand = command
    let actualArgs = args || []

    if (platform === 'windows' && !shell) {
      // Use cmd.exe when running directly on Windows
      actualCommand = 'cmd.exe'
      actualArgs = ['/c', command, ...actualArgs]
    }

    // Handle working directory
    let cwd = options?.cwd
    if (cwd) {
      const normalizer = new PathNormalizer()
      cwd = normalizer.normalize(cwd)
    }

    // Handle environment variables
    let env = options?.env
    if (env && platform === 'windows') {
      // Windows environment variables are case-insensitive
      env = this.normalizeEnvKeys(env)
    }

    return spawn(actualCommand, actualArgs, {
      ...options,
      cwd,
      env: env ? { ...process.env, ...env } : undefined,
      shell,
    })
  }

  async exec(
    command: string,
    options?: { cwd?: string; env?: Record<string, string>; timeout?: number }
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    const platform = this.platformInfo.platform

    // Use cmd.exe on Windows
    if (platform === 'windows') {
      command = `cmd.exe /c "${command}"`
    }

    return new Promise((resolve, reject) => {
      const child = exec(command, {
        ...options,
        encoding: 'utf-8',
        timeout: options?.timeout,
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        stdout += data
      })

      child.stderr?.on('data', (data) => {
        stderr += data
      })

      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code })
      })

      child.on('error', (error) => {
        reject(error)
      })
    })
  }

  async kill(pid: number, signal?: string): Promise<void> {
    const platform = this.platformInfo.platform

    if (platform === 'windows') {
      // Use taskkill on Windows
      await exec(`taskkill /F /PID ${pid}`)
    } else {
      // Use kill on Unix/Linux/macOS
      process.kill(pid, signal as NodeJS.Signals || 'SIGTERM')
    }
  }

  private normalizeEnvKeys(env: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {}

    for (const [key, value] of Object.entries(env)) {
      normalized[key.toUpperCase()] = value
    }

    return normalized
  }
}
```

## Compatibility Strategies

### Polyfill Implementation

```typescript
// src/platform/polyfills.ts
export class PlatformPolyfills {
  private platformInfo: PlatformInfo

  constructor() {
    this.platformInfo = detectPlatform()
  }

  install(): void {
    this.installFSPolyfills()
    this.installProcessPolyfills()
    this.installPathPolyfills()
  }

  private installFSPolyfills(): void {
    // Some file system operations not supported on Windows
    if (this.platformInfo.platform === 'windows') {
      // chmod fallback implementation
      const originalChmod = fs.chmod
      fs.chmod = function(path, mode, callback) {
        // Ignore permission settings on Windows
        if (typeof mode === 'number') {
          callback?.(null)
          return
        }
        originalChmod(path, mode, callback)
      } as typeof fs.chmod

      // chown fallback implementation
      const originalChown = fs.chown
      fs.chown = function(path, uid, gid, callback) {
        // Ignore owner settings on Windows
        callback?.(null)
        return
      } as typeof fs.chown
    }

    // Platforms without symlink support
    if (!this.platformInfo.features.symlinks) {
      const originalSymlink = fs.symlink
      fs.symlink = function(target, source, type, callback) {
        const cb = typeof type === 'function' ? type : callback
        cb?.(new Error('Symlinks not supported'))
      } as typeof fs.symlink
    }
  }

  private installProcessPolyfills(): void {
    // No process.getuid() on Windows
    if (!process.getuid) {
      process.getuid = function() {
        return 0 // Return 0 on Windows
      }
    }

    // No process.getgid() on Windows
    if (!process.getgid) {
      process.getgid = function() {
        return 0
      }
    }

    // No process.groups on Windows
    if (!process.groups) {
      process.groups = []
    }

    // No process.setuid() on Windows
    if (!process.setuid) {
      process.setuid = function() {
        throw new Error('setuid not supported')
      }
    }

    // No process.setgid() on Windows
    if (!process.setgid) {
      process.setgid = function() {
        throw new Error('setgid not supported')
      }
    }
  }

  private installPathPolyfills(): void {
    // Ensure correct path separator handling
    const originalJoin = path.join
    path.join = function(...segments: string[]) {
      return originalJoin(...segments.map(s => s.replace(/\\/g, '/')))
    }

    // Ensure correct relative path resolution
    const originalResolve = path.resolve
    path.resolve = function(...segments: string[]) {
      // Handle Windows drive letters
      if (segments.length > 0 && /^[A-Za-z]:$/.test(segments[0])) {
        return segments[0]
      }
      return originalResolve(...segments)
    }
  }
}
```

## Real-World Cases

### Case 1: Cross-Platform File Watching

```typescript
// examples/crossPlatformWatcher.ts
class CrossPlatformWatcher {
  private platformInfo: PlatformInfo
  private featureDetector: FeatureDetection

  constructor() {
    this.platformInfo = detectPlatform()
    this.featureDetector = new FeatureDetection()
  }

  async watch(
    path: string,
    callback: (event: string, filename: string) => void
  ): Promise<FSWatcher> {
    // Detect feature support
    const hasWatch = await this.featureDetector.detect('fs.watch')

    if (hasWatch) {
      // Use fs.watch
      return fs.watch(path, (event, filename) => {
        callback(event, filename || '')
      })
    }

    // Fallback to polling
    return this.pollWatch(path, callback)
  }

  private pollWatch(
    path: string,
    callback: (event: string, filename: string) => void
  ): FSWatcher {
    let previousMtime = new Map<string, number>()

    const interval = setInterval(async () => {
      try {
        const files = await fs.promises.readdir(path)

        for (const file of files) {
          const filePath = join(path, file)
          const stats = await fs.promises.stat(filePath)
          const currentMtime = stats.mtimeMs
          const previousMtimeValue = previousMtime.get(file)

          if (previousMtimeValue !== undefined && currentMtime > previousMtimeValue) {
            callback('change', file)
          }

          previousMtime.set(file, currentMtime)
        }
      } catch (error) {
        console.error('Poll watch error:', error)
      }
    }, 1000)

    return {
      close() {
        clearInterval(interval)
      },
    } as FSWatcher
  }
}

// Usage example
const watcher = new CrossPlatformWatcher()

watcher.watch('.', (event, filename) => {
  console.log(`File ${filename} ${event}`)
})
```

### Case 2: Cross-Platform Process Execution

```typescript
// examples/crossPlatformExec.ts
class CrossPlatformExecutor {
  private platformInfo: PlatformInfo
  private process: CrossPlatformProcess

  constructor() {
    this.platformInfo = detectPlatform()
    this.process = new CrossPlatformProcess()
  }

  async executeScript(script: string): Promise<string> {
    const platform = this.platformInfo.platform

    let command: string
    let args: string[]

    if (platform === 'windows') {
      // Windows
      if (script.endsWith('.js')) {
        command = 'node'
        args = [script]
      } else if (script.endsWith('.ps1')) {
        command = 'powershell'
        args = ['-ExecutionPolicy', 'Bypass', '-File', script]
      } else if (script.endsWith('.bat') || script.endsWith('.cmd')) {
        command = script
        args = []
      } else {
        command = 'cmd.exe'
        args = ['/c', script]
      }
    } else {
      // Unix/Linux/macOS
      if (script.endsWith('.js')) {
        command = 'node'
        args = [script]
      } else if (script.endsWith('.sh')) {
        command = 'bash'
        args = [script]
      } else {
        command = 'bash'
        args = ['-c', script]
      }
    }

    const result = await this.process.exec(command, {
      cwd: process.cwd(),
    })

    if (result.exitCode !== 0) {
      throw new Error(`Script execution failed: ${result.stderr}`)
    }

    return result.stdout
  }
}
```

## Best Practices

### 1. Platform Detection

- **Runtime Detection**: Use feature detection rather than userAgent
- **Progressive Enhancement**: Provide features based on available capabilities
- **Graceful Degradation**: Provide alternatives for unsupported platforms

### 2. Path Handling

- **Unified Format**: Use unified path format internally
- **Deferred Conversion**: Convert to platform-specific format only when needed
- **Test Coverage**: Ensure correct path handling on all platforms

### 3. Performance Optimization

- **WSL Optimization**: Special optimizations for WSL
- **Cache Strategy**: Cache platform detection results
- **Batch Operations**: Reduce system call frequency

### 4. Error Handling

- **Platform Errors**: Provide platform-specific error messages
- **Fallback Hints**: Inform users about fallback schemes used
- **Logging**: Record platform-related errors

## Summary

Key points of platform differentiation:

1. **Accurate Detection**: Runtime platform and feature identification
2. **Unified Interface**: Cross-platform unified API
3. **Fallback Schemes**: Alternatives for unsupported platforms
4. **Performance Optimization**: Platform-specific optimizations
5. **WSL Support**: Special handling for WSL cases
6. **Comprehensive Testing**: Thorough testing on each platform

Mastering platform differentiation ensures consistent user experience across all platforms for Claude Code.
