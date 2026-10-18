// Pure helpers that keep generated shell/SSH commands free of injection.
// No runtime imports: this file is unit-tested in isolation.

export type ShellPlatform = 'windows' | 'macos' | 'linux';

export class ShellSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShellSafetyError';
  }
}

const HOST_RE = /^[A-Za-z0-9][A-Za-z0-9.:_-]{0,252}$/;
const USER_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/;
const PLAIN_ARG_RE = /^[A-Za-z0-9_@+=:,./~\\-]+$/;
const PACKAGE_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/;
// SCP can fall back to a remote shell, and rsync uses one. Restrict remote
// operands to simple paths that are safe at both local and remote parsing layers.
const REMOTE_PATH_RE = /^(?!-)[A-Za-z0-9_./~+-]{1,1024}$/;
const WINDOWS_FORBIDDEN_RE = /["`$^&|<>\r\n\0]/;
const REFUSED_PREFIX = '# Refused: ';

export function assertHost(value: string, field = 'host'): string {
  if (typeof value !== 'string' || !HOST_RE.test(value)) {
    throw new ShellSafetyError(`Invalid ${field}`);
  }
  return value;
}

export function assertUser(value: string, field = 'username'): string {
  if (typeof value !== 'string' || !USER_RE.test(value)) {
    throw new ShellSafetyError(`Invalid ${field}`);
  }
  return value;
}

export function assertPort(value: number, field = 'port'): number {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new ShellSafetyError(`Invalid ${field}`);
  }
  return value;
}

export function assertPackage(value: string): string {
  if (typeof value !== 'string' || !PACKAGE_RE.test(value)) {
    throw new ShellSafetyError('Invalid package name');
  }
  return value;
}

export function assertRemotePath(value: string): string {
  if (typeof value !== 'string' || !REMOTE_PATH_RE.test(value)) {
    throw new ShellSafetyError('Unsafe remote path (simple paths only)');
  }
  return value;
}

export function assertSeconds(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 86400) {
    throw new ShellSafetyError(`Invalid ${field}`);
  }
  return value;
}

/** Display label that is safe inside quotes, echo, window titles and AppleScript. */
export function safeLabel(value: string): string {
  const cleaned = String(value ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '_').trim().slice(0, 64);
  return cleaned || 'connection';
}

export function isPlainArg(value: string, platform: ShellPlatform = 'linux'): boolean {
  if (!PLAIN_ARG_RE.test(value) || value.startsWith('-')) return false;
  // A backslash is an escape character in POSIX shells; it is only a path separator on Windows.
  return platform === 'windows' || !value.includes('\\');
}

/**
 * Quote one argument for the target platform's shell.
 * Plain values are returned unchanged. With nested=true (the command will be
 * embedded inside another quoted string) anything that is not plain is refused.
 */
export function quoteArg(platform: ShellPlatform, value: string, nested = false): string {
  if (typeof value !== 'string' || /[\r\n\0]/.test(value)) {
    throw new ShellSafetyError('Unsafe argument');
  }
  if (isPlainArg(value, platform)) return value;
  if (nested) throw new ShellSafetyError('Argument needs quoting and cannot be embedded in a launcher');
  if (platform === 'windows') {
    if (WINDOWS_FORBIDDEN_RE.test(value)) throw new ShellSafetyError('Unsafe character in argument');
    // The application has a %USERNAME% default Windows key path. No other
    // environment expansions are accepted in copied commands.
    if (value.replace(/%USERNAME%/g, '').includes('%')) {
      throw new ShellSafetyError('Unsafe % in argument');
    }
    return `"${value}"`;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Path-like argument: must not look like an option. */
export function quotePath(platform: ShellPlatform, value: string, nested = false): string {
  const v = value.startsWith('-') ? `./${value}` : value;
  return quoteArg(platform, v, nested);
}

/** Run a generator; on refusal return a harmless comment instead of throwing during render. */
export function safely(fn: () => string): string {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ShellSafetyError) return REFUSED_PREFIX + error.message;
    throw error;
  }
}

export function isRefused(command: string): boolean {
  return command.startsWith(REFUSED_PREFIX);
}
