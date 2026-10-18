import { SSHConnection, Platform } from './types';
import { createDefaultConnection } from './utils';
import { assertHost, assertPort, assertUser, ShellSafetyError } from './shell';

const SECRET_KEYS = ['password', 'githubToken', 'vncPassword'] as const;

export interface ImportResult {
  connection: SSHConnection | null;
  reason?: string;
}

/**
 * Turn an untrusted JSON object into a connection.
 * Only known keys are copied (no prototype/unknown-field smuggling), secrets are
 * dropped, and host/user/port fields that feed generated commands must validate.
 */
export function sanitizeImportedConnection(raw: unknown, platform: Platform): ImportResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { connection: null, reason: 'not an object' };
  const input = raw as Record<string, unknown>;
  const base = createDefaultConnection({}, platform);
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    if (key === 'id' || !Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = input[key];
    if (typeof value === typeof (base as unknown as Record<string, unknown>)[key]) out[key] = value;
  }
  for (const key of SECRET_KEYS) out[key] = '';
  const conn = out as unknown as SSHConnection;
  // Imported objects may have the same JS typeof as an array or record,
  // yet be malformed. Normalize each collection before it reaches React.
  const strings = (value: unknown): string[] => Array.isArray(value)
    ? value.filter((x): x is string => typeof x === 'string').slice(0, 32).map(x => x.slice(0, 128))
    : [];
  conn.tags = strings(conn.tags);
  conn.githubRepos = strings(conn.githubRepos);
  conn.githubWebhooks = [];
  conn.githubDeployKeys = [];
  // Never import command-bearing fields or environment variables from JSON.
  conn.startupCommands = [];
  conn.envVars = {};
  conn.customTerminalCmd = '';
  conn.name = conn.name.slice(0, 128);
  conn.notes = conn.notes.slice(0, 4096);
  try {
    if (!['ssh', 'sftp', 'scp', 'rdp', 'telnet', 'serial', 'vnc'].includes(conn.protocol)) {
      throw new ShellSafetyError('Invalid protocol');
    }
    if (!['password', 'key', 'agent', 'certificate'].includes(conn.authType)) {
      throw new ShellSafetyError('Invalid authentication type');
    }
    const normalizedForwards: SSHConnection['portForwards'] = [];
    for (const item of Array.isArray(conn.portForwards) ? conn.portForwards.slice(0, 64) : []) {
      if (!item || typeof item !== 'object') continue;
      const type = item.type;
      if (type !== 'local' && type !== 'remote' && type !== 'dynamic') {
        throw new ShellSafetyError('Invalid forward type');
      }
      const localPort = assertPort(item.localPort, 'forward port');
      const remoteHost = type === 'dynamic' ? '' : assertHost(item.remoteHost, 'forward host');
      const remotePort = type === 'dynamic' ? 0 : assertPort(item.remotePort, 'forward remote port');
      normalizedForwards.push({
        id: typeof item.id === 'string' ? item.id.slice(0, 64) : String(normalizedForwards.length),
        type, localPort, remoteHost, remotePort, enabled: item.enabled === true,
      });
    }
    conn.portForwards = normalizedForwards;
    if (conn.protocol === 'serial') return { connection: conn };
    assertHost(conn.host);
    assertPort(conn.port);
    if (conn.username) assertUser(conn.username);
    if (conn.jumpHost) {
      assertHost(conn.jumpHost, 'jump host');
      if (conn.jumpUser) assertUser(conn.jumpUser, 'jump user');
      assertPort(conn.jumpPort, 'jump port');
    }
    return { connection: conn };
  } catch (error) {
    if (error instanceof ShellSafetyError) return { connection: null, reason: error.message };
    throw error;
  }
}
