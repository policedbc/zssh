import { AppSettings, Platform, SSHConnection } from './types';
import { isRefused } from './shell';
import {
  generateBatchScript, generateRDPCommand, generateRsyncCommand,
  generateSCPCommand, generateTerminalLaunch, generateVNCCommand,
} from './utils';

// A browser command preview is not an authenticated network operation.
export type CommandPreparation =
  | { ok: true; command: string }
  | { ok: false; reason: string };

function prepared(command: string): CommandPreparation {
  if (isRefused(command)) return { ok: false, reason: command.slice('# Refused: '.length) };
  return { ok: true, command };
}

export function prepareConnectionCommand(conn: SSHConnection, settings: AppSettings): CommandPreparation {
  try {
    if (conn.protocol === 'rdp') return prepared(generateRDPCommand(conn, settings.platform));
    if (conn.protocol === 'vnc') return prepared(generateVNCCommand(conn, settings.platform));
    if (conn.protocol !== 'ssh') return { ok: false, reason: 'Only SSH, RDP and VNC command previews are supported here' };
    return prepared(generateTerminalLaunch(conn, settings));
  } catch {
    return { ok: false, reason: 'Malformed connection data' };
  }
}

export function prepareBatchCommand(connections: SSHConnection[], platform: Platform): CommandPreparation {
  if (!connections.length) return { ok: false, reason: 'No connections selected' };
  if (connections.some(conn => conn.protocol !== 'ssh')) {
    return { ok: false, reason: 'Batch commands support SSH profiles only' };
  }
  try {
    const script = generateBatchScript(connections, platform);
    // Batch generators may use REM comments, or # comments on POSIX.
    if (script.includes('Refused:')) return { ok: false, reason: 'At least one command was refused; review host and path values' };
    return { ok: true, command: script };
  } catch {
    return { ok: false, reason: 'Malformed batch connection data' };
  }
}

export type TransferProtocol = 'zmodem' | 'scp' | 'sftp' | 'rsync';

export function prepareTransferCommand(
  conn: SSHConnection,
  protocol: TransferProtocol,
  localPath: string,
  remotePath: string,
  direction: 'upload' | 'download',
  platform: Platform,
): CommandPreparation {
  if (!localPath.trim() || !remotePath.trim()) {
    return { ok: false, reason: 'Local and remote paths are required' };
  }
  if (protocol !== 'scp' && protocol !== 'rsync') {
    return { ok: false, reason: protocol.toUpperCase() + ' requires a native client; not available in this browser UI' };
  }
  if (conn.protocol !== 'ssh' && conn.protocol !== 'sftp' && conn.protocol !== 'scp') {
    return { ok: false, reason: 'Select an SSH-compatible profile for file transfer' };
  }
  try {
    const command = protocol === 'scp'
      ? generateSCPCommand(conn, localPath, remotePath, direction, platform)
      : generateRsyncCommand(conn, localPath, remotePath, direction, platform);
    return prepared(command);
  } catch {
    return { ok: false, reason: 'Malformed transfer configuration' };
  }
}
