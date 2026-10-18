import { SSHConnection, ConnectionHistory, Platform, PLATFORMS, AppSettings } from './types';
import { v4 as uuidv4 } from 'uuid';
import { ShellSafetyError, assertHost, assertUser, assertPort, assertRemotePath, assertPackage, assertSeconds, quoteArg, quotePath, safeLabel, safely, ShellPlatform } from './shell';

// Platform detection
export function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  return 'windows';
}

export function getPlatformInfo(platform: Platform) {
  return PLATFORMS[platform];
}

export function pathJoin(platform: Platform, ...parts: string[]): string {
  const sep = PLATFORMS[platform].pathSep;
  return parts.join(sep);
}

export function createDefaultConnection(overrides: Partial<SSHConnection> = {}, platform: Platform = 'windows'): SSHConnection {
  const pInfo = PLATFORMS[platform];
  return {
    id: uuidv4(),
    name: '',
    host: '',
    port: 22,
    username: 'ubuntu',
    authType: 'key',
    keyPath: pInfo.defaultKeyPath,
    password: '',
    certPath: '',
    color: '#10b981',
    tags: [],
    notes: '',
    groupId: '',
    createdAt: Date.now(),
    protocol: 'ssh',
    favorite: false,
    status: 'unknown',
    portForwards: [],
    timeout: 30,
    keepAliveInterval: 60,
    encoding: 'utf-8',
    startupCommands: [],
    envVars: {},
    jumpHost: '',
    jumpPort: 22,
    jumpUser: '',
    fontSize: 14,
    theme: 'default',
    rdpResolution: '1920x1080',
    rdpFullScreen: false,
    serialBaudRate: 9600,
    serialDataBits: 8,
    totalConnections: 0,
    avgSessionTime: 0,
    zmodemEnabled: true,
    zmodemAutoReceive: false,
    zmodemBufferSize: 4096,
    githubEnabled: false,
    githubToken: '',
    githubRepos: [],
    githubDeployKeys: [],
    githubWebhooks: [],
    vncPort: 5900,
    vncPassword: '',
    customTerminalCmd: '',
    ...overrides,
  };
}

export function createHistoryEntry(conn: SSHConnection, platform: Platform, status: ConnectionHistory['status'] = 'success', duration = 0): ConnectionHistory {
  return {
    id: uuidv4(),
    connectionId: conn.id,
    connectionName: conn.name,
    host: conn.host,
    timestamp: Date.now(),
    duration,
    status,
    platform,
  };
}

// ============ CROSS-PLATFORM SSH COMMANDS ============

function buildSSHCommand(conn: SSHConnection, platform: Platform, nested: boolean): string {
  const sh: ShellPlatform = platform;
  const parts = ['ssh'];
  if (conn.port !== 22) parts.push('-p', String(assertPort(conn.port)));
  if (conn.authType === 'key' && conn.keyPath) parts.push('-i', quotePath(sh, conn.keyPath, nested));
  if (conn.authType === 'certificate' && conn.certPath) {
    const cert = quoteArg(sh, 'CertificateFile=' + conn.certPath, nested);
    parts.push('-o', cert);
  }
  if (conn.jumpHost) {
    const jumpHost = assertHost(conn.jumpHost, 'jump host');
    const jumpUser = conn.jumpUser ? assertUser(conn.jumpUser, 'jump user') + '@' : '';
    const jumpPort = conn.jumpPort && conn.jumpPort !== 22 ? ':' + assertPort(conn.jumpPort, 'jump port') : '';
    parts.push('-J', jumpUser + jumpHost + jumpPort);
  }
  conn.portForwards.filter(pf => pf.enabled).forEach(pf => {
    const local = assertPort(pf.localPort, 'forward port');
    if (pf.type === 'dynamic') {
      parts.push('-D', String(local));
      return;
    }
    const spec = `${local}:${assertHost(pf.remoteHost, 'forward host')}:${assertPort(pf.remotePort, 'forward remote port')}`;
    parts.push(pf.type === 'local' ? '-L' : '-R', spec);
  });
  if (conn.timeout !== 30) parts.push('-o', `ConnectTimeout=${assertSeconds(conn.timeout, 'timeout')}`);
  if (conn.keepAliveInterval !== 60) parts.push('-o', `ServerAliveInterval=${assertSeconds(conn.keepAliveInterval, 'keep-alive')}`);
  parts.push(`${assertUser(conn.username)}@${assertHost(conn.host)}`);
  return parts.join(' ');
}

export function generateSSHCommand(conn: SSHConnection, platform: Platform = 'windows'): string {
  return safely(() => buildSSHCommand(conn, platform, false));
}

// ============ CROSS-PLATFORM TERMINAL LAUNCHERS ============

export function generateTerminalLaunch(conn: SSHConnection, settings: AppSettings): string {
  return safely(() => {
    const platform = settings.platform;
    const terminal = settings.preferredTerminal;
    const title = safeLabel(conn.name);
    const target = `${assertUser(conn.username)}@${assertHost(conn.host)}`;
    const port = assertPort(conn.port);
    // Launchers that embed the command inside another quoted string only accept plain arguments.
    const nestedCmd = () => buildSSHCommand(conn, platform, true);
    const plainCmd = () => buildSSHCommand(conn, platform, false);

    switch (platform) {
      case 'windows':
        switch (terminal) {
          case 'windows-terminal': return `wt new-tab --title "${title}" ${plainCmd()}`;
          case 'powershell': return `powershell -NoExit -Command "${nestedCmd()}"`;
          case 'cmd': return `cmd /k "${nestedCmd()}"`;
          case 'putty': return buildPuTTYCommand(conn);
          case 'mobaXterm': return `mobaxterm -ssh ${target} -p ${port}`;
          case 'tabby': return `tabby open ssh://${target}:${port}`;
          default: return plainCmd();
        }
      case 'macos':
        switch (terminal) {
          case 'iterm2': return `osascript -e 'tell application "iTerm2" to create window with default command "${nestedCmd()}"'`;
          case 'terminal-app': return `osascript -e 'tell application "Terminal" to do script "${nestedCmd()}"'`;
          case 'warp': return `warp --command "${nestedCmd()}"`;
          case 'alacritty': return `alacritty -e ${plainCmd()}`;
          case 'tabby': return `tabby open ssh://${target}:${port}`;
          default: return plainCmd();
        }
      case 'linux':
        switch (terminal) {
          case 'gnome-terminal': return `gnome-terminal --title="${title}" -- ${plainCmd()}`;
          case 'konsole': return `konsole --title "${title}" -e ${plainCmd()}`;
          case 'xfce4-terminal': return `xfce4-terminal --title="${title}" -x ${plainCmd()}`;
          case 'tilix': return `tilix --title="${title}" -e ${plainCmd()}`;
          case 'alacritty-linux': return `alacritty --title "${title}" -e ${plainCmd()}`;
          case 'tabby-linux': return `tabby open ssh://${target}:${port}`;
          default: return plainCmd();
        }
    }
  });
}

// ============ CROSS-PLATFORM FILE TRANSFER ============

function remoteSpec(conn: SSHConnection, remotePath: string): string {
  return `${assertUser(conn.username)}@${assertHost(conn.host)}:${assertRemotePath(remotePath)}`;
}

export function generateSCPCommand(conn: SSHConnection, localPath: string, remotePath: string, direction: 'upload' | 'download', platform: Platform = 'windows'): string {
  return safely(() => {
    const args = ['scp'];
    if (conn.port !== 22) args.push('-P', String(assertPort(conn.port)));
    if (conn.authType === 'key' && conn.keyPath) args.push('-i', quotePath(platform, conn.keyPath));
    args.push('--');
    const local = quotePath(platform, localPath);
    const remote = quoteArg(platform, remoteSpec(conn, remotePath));
    return [...args, ...(direction === 'upload' ? [local, remote] : [remote, local])].join(' ');
  });
}

export function generateRsyncCommand(conn: SSHConnection, localPath: string, remotePath: string, direction: 'upload' | 'download', platform: Platform = 'windows'): string {
  return safely(() => {
    const inner = ['ssh', '-p', String(assertPort(conn.port))];
    if (conn.authType === 'key' && conn.keyPath) inner.push('-i', quotePath(platform, conn.keyPath, true));
    const rshArg = quoteArg(platform, inner.join(' '));
    const local = quotePath(platform, localPath);
    const remote = quoteArg(platform, remoteSpec(conn, remotePath));
    const operands = direction === 'upload' ? [local, remote] : [remote, local];
    return ['rsync', '-avz', '-e', rshArg, '--', ...operands].join(' ');
  });
}

export function generateZmodemCommand(conn: SSHConnection): string {
  return safely(() => `ssh -o Protocol=2 ${assertUser(conn.username)}@${assertHost(conn.host)} -t "rz -be"`);
}

// ============ CROSS-PLATFORM RDP/VNC ============

export function generateRDPCommand(conn: SSHConnection, platform: Platform = 'windows'): string {
  return safely(() => {
    const host = assertHost(conn.host);
    const port = assertPort(conn.port);
    const user = conn.username ? assertUser(conn.username) : '';
    switch (platform) {
      case 'windows':
        return `mstsc /v:${host}:${port}` + (user ? ` /u:${user}` : '');
      case 'macos':
        return `open "rdp://full address=s:${host}:${port}` + (user ? `&username=s:${user}` : '') + '"';
      case 'linux':
        return `xfreerdp /v:${host}:${port}` + (user ? ` /u:${user}` : '') + ' /dynamic-resolution';
    }
  });
}

export function generateVNCCommand(conn: SSHConnection, platform: Platform = 'windows'): string {
  return safely(() => {
    const host = assertHost(conn.host);
    const user = conn.username ? assertUser(conn.username) + '@' : '';
    const vncUrl = `vnc://${user}${host}:${assertPort(conn.vncPort || 5900, 'VNC port')}`;
    switch (platform) {
      case 'windows':
        return `start "" "${vncUrl}"  # Requires VNC client`;
      case 'macos':
        return `open "${vncUrl}"  # Uses built-in Screen Sharing`;
      case 'linux':
        return `vinagre ${vncUrl}  # Or: remmina --protocol=vnc --server=${host}`;
    }
  });
}

// ============ CROSS-PLATFORM PUTTY ============

function buildPuTTYCommand(conn: SSHConnection): string {
  const parts = ['putty'];
  if (conn.port !== 22) parts.push('-P', String(assertPort(conn.port)));
  if (conn.authType === 'key' && conn.keyPath) {
    // Convert OpenSSH key to PuTTY format path
    const ppkPath = conn.keyPath.replace(/\.(pem|key)$/, '.ppk');
    parts.push('-i', quotePath('windows', ppkPath));
  }
  parts.push(`${assertUser(conn.username)}@${assertHost(conn.host)}`);
  return parts.join(' ');
}

export function generatePuTTYCommand(conn: SSHConnection): string {
  return safely(() => buildPuTTYCommand(conn));
}

// ============ CROSS-PLATFORM BATCH SCRIPTS ============

function scriptLine(conn: SSHConnection, platform: Platform, wrap: (title: string, cmd: string) => string): string {
  // Evaluate the nested launcher command under the refusal guard too.
  const cmd = safely(() => buildSSHCommand(conn, platform, true));
  const title = safeLabel(conn.name);
  return cmd.startsWith('# Refused:') ? cmd : wrap(title, cmd);
}

export function generateBatchScript(connections: SSHConnection[], platform: Platform = 'windows'): string {
  if (platform === 'windows') {
    let script = '@echo off\r\n';
    script += 'REM Generated by SSH Manager Pro (Windows)\r\n';
    script += `REM Date: ${new Date().toLocaleDateString()}\r\n\r\n`;
    connections.forEach(conn => {
      script += `echo Connecting to ${safeLabel(conn.name)}...\r\n`;
      const line = scriptLine(conn, 'windows', (title, cmd) => `start "${title}" cmd /k "${cmd}"`);
      script += line.replace(/\r?\n/g, ' ').replace(/^#/, 'REM') + '\r\n\r\n';
    });
    script += 'echo All connections launched!\r\npause\r\n';
    return script;
  } else if (platform === 'macos') {
    let script = '#!/bin/bash\n';
    script += '# Generated by SSH Manager Pro (macOS)\n';
    script += `# Date: ${new Date().toLocaleDateString()}\n\n`;
    connections.forEach(conn => {
      script += `echo "Connecting to ${safeLabel(conn.name)}..."\n`;
      script += safely(() => `osascript -e 'tell application "Terminal" to do script "${buildSSHCommand(conn, 'macos', true)}"'`) + '\n\n';
    });
    return script;
  } else {
    let script = '#!/bin/bash\n';
    script += '# Generated by SSH Manager Pro (Linux)\n';
    script += `# Date: ${new Date().toLocaleDateString()}\n\n`;
    connections.forEach(conn => {
      script += `echo "Connecting to ${safeLabel(conn.name)}..."\n`;
      script += safely(() => `gnome-terminal --title="${safeLabel(conn.name)}" -- ${buildSSHCommand(conn, 'linux', false)} &`) + '\n\n';
    });
    script += 'echo "All connections launched!"\n';
    return script;
  }
}

export function generatePowerShellScript(connections: SSHConnection[], platform: Platform = 'windows'): string {
  const header = (label: string, nl: string) => `# Generated by SSH Manager Pro (${label})${nl}# Date: ${new Date().toLocaleDateString()}${nl}${nl}`;
  if (platform === 'windows') {
    let script = header('Windows PowerShell', '\r\n');
    connections.forEach(conn => {
      const title = safeLabel(conn.name);
      script += `Write-Host "Connecting to ${title}..." -ForegroundColor Cyan\r\n`;
      script += safely(() => `Start-Process wt -ArgumentList 'new-tab --title "${title}" ${buildSSHCommand(conn, 'windows', true)}'`) + '\r\n\r\n';
    });
    return script;
  } else if (platform === 'macos') {
    let script = header('macOS PowerShell', '\n');
    connections.forEach(conn => {
      script += `Write-Host "Connecting to ${safeLabel(conn.name)}..." -ForegroundColor Cyan\n`;
      script += safely(() => `osascript -e 'tell application "iTerm2" to create window with default command "${buildSSHCommand(conn, 'macos', true)}"'`) + '\n\n';
    });
    return script;
  } else {
    let script = header('Linux PowerShell', '\n');
    connections.forEach(conn => {
      script += `Write-Host "Connecting to ${safeLabel(conn.name)}..." -ForegroundColor Cyan\n`;
      script += safely(() => `gnome-terminal --title="${safeLabel(conn.name)}" -- ${buildSSHCommand(conn, 'linux', false)} &`) + '\n\n';
    });
    return script;
  }
}

// ============ CROSS-PLATFORM SSH CONFIG PARSER ============

export function parseSSHConfig(config: string, platform: Platform = 'windows'): Partial<SSHConnection>[] {
  const results: Partial<SSHConnection>[] = [];
  const lines = config.split(/\r?\n/);
  let current: Partial<SSHConnection> | null = null;
  const pInfo = PLATFORMS[platform];
  const unquote = (v: string) => v.replace(/^"(.*)"$/, '$1');
  const flush = () => { if (current && current.name) results.push(current); };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(\S+?)(?:\s*=\s*|\s+)(.+)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = unquote(rawValue.trim());
    switch (key.toLowerCase()) {
      case 'host': {
        flush();
        // Only single, literal aliases become profiles; wildcard/negated/multi-pattern blocks are skipped.
        current = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/.test(value)
          ? { name: value, host: value, protocol: 'ssh' }
          : null;
        break;
      }
      case 'hostname': if (current && /^[A-Za-z0-9][A-Za-z0-9.:_-]{0,252}$/.test(value)) current.host = value; break;
      case 'port': {
        const port = Number(value);
        if (current && Number.isInteger(port) && port >= 1 && port <= 65535) current.port = port;
        break;
      }
      case 'user': if (current && /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/.test(value)) current.username = value; break;
      case 'identityfile':
        if (current && !/[\r\n\0]/.test(value)) {
          current.keyPath = value.replace(/^~/, pInfo.homeDir);
          current.authType = 'key';
        }
        break;
    }
  }
  flush();
  return results;
}

// ============ CROSS-PLATFORM PACKAGE INSTALL COMMANDS ============

export function generateInstallCommand(pkgInput: string, settings: AppSettings): string {
  const pkg = safely(() => assertPackage(pkgInput));
  if (pkg.startsWith('#')) return pkg;
  const pm = settings.packageManager;
  const commands: Record<string, string> = {
    winget: `winget install ${pkg}`,
    scoop: `scoop install ${pkg}`,
    choco: `choco install ${pkg} -y`,
    brew: `brew install ${pkg}`,
    apt: `sudo apt update && sudo apt install -y ${pkg}`,
    dnf: `sudo dnf install -y ${pkg}`,
    pacman: `sudo pacman -S --noconfirm ${pkg}`,
    zypper: `sudo zypper install -y ${pkg}`,
  };
  return commands[pm] || `# Install ${pkg} using your package manager`;
}

// ============ CROSS-PLATFORM KEY GENERATION ============

export function generateKeyGenCommand(keyType: 'ed25519' | 'rsa' | 'ecdsa', bits: number, comment: string, platform: Platform): string {
  return safely(() => {
    const pInfo = PLATFORMS[platform];
    if (!['ed25519', 'rsa', 'ecdsa'].includes(keyType)) throw new ShellSafetyError('Invalid key type');
    let cmd = `ssh-keygen -t ${keyType}`;
    if (keyType === 'rsa') {
      if (![2048, 3072, 4096].includes(bits)) throw new ShellSafetyError('Invalid RSA key size');
      cmd += ` -b ${bits}`;
    }
    if (keyType === 'ecdsa') cmd += ` -b 521`;
    cmd += ` -C ${quoteArg(platform, comment || 'your@email.com')}`;
    cmd += ` -f ${quotePath(platform, pInfo.defaultKeyPath.replace('id_ed25519', `id_${keyType}`))}`;
    return cmd;
  });
}

export function generateSSHAgentSetup(platform: Platform): string {
  switch (platform) {
    case 'windows':
      return `# Windows: SSH Agent is built-in (OpenSSH)\n# Start the service:\nGet-Service ssh-agent | Set-Service -StartupType Automatic\nStart-Service ssh-agent\n\n# Add key:\nssh-add $env:USERPROFILE\\.ssh\\id_ed25519`;
    case 'macos':
      return `# macOS: Add to ~/.zshrc or ~/.bash_profile\neval "$(ssh-agent -s)"\nssh-add --apple-use-keychain ~/.ssh/id_ed25519\n\n# For automatic key loading, add to ~/.ssh/config:\nHost *\n  AddKeysToAgent yes\n  UseKeychain yes\n  IdentityFile ~/.ssh/id_ed25519`;
    case 'linux':
      return `# Linux: Add to ~/.bashrc or ~/.zshrc\neval "$(ssh-agent -s)"\nssh-add ~/.ssh/id_ed25519\n\n# For GNOME Keyring integration:\nsudo apt install keychain\nkeychain ~/.ssh/id_ed25519`;
  }
}

// ============ CROSS-PLATFORM ZMODEM SETUP ============

export function generateZmodemSetup(platform: Platform, packageManager: AppSettings['packageManager']): string {
  switch (platform) {
    case 'windows':
      return `# Windows Zmodem/ZSSH Setup\n\n# Option 1: Install zssh via Scoop\nscoop install zssh\n\n# Option 2: Install via Chocolatey\nchoco install zssh\n\n# Option 3: Use Tera Term (has built-in Zmodem)\nwinget install TeraTerm.TeraTerm\n\n# Option 4: Use MobaXterm (has built-in Zmodem)\nwinget install MobaXterm`;
    case 'macos':
      return `# macOS Zmodem/ZSSH Setup\n\n# Install lrzsz (provides rz/sz commands)\nbrew install lrzsz\n\n# Install zssh\nbrew install zssh\n\n# Connect with zmodem support:\nzssh user@host`;
    case 'linux':
      const installCmd = generateInstallCommand('lrzsz', { packageManager } as AppSettings);
      return `# Linux Zmodem/ZSSH Setup\n\n# Install lrzsz (provides rz/sz commands)\n${installCmd}\n\n# Install zssh (optional)\n${generateInstallCommand('zssh', { packageManager } as AppSettings)}\n\n# Connect with zmodem support:\nzssh user@host`;
  }
}

// ============ CROSS-PLATFORM GITHUB SETUP ============

export function generateGitHubSetup(platform: Platform): string {
  const pInfo = PLATFORMS[platform];
  switch (platform) {
    case 'windows':
      return `# GitHub SSH Setup on Windows\n\n# 1. Generate SSH key\nssh-keygen -t ed25519 -C "your_email@example.com"\n\n# 2. Start SSH agent\nGet-Service ssh-agent | Set-Service -StartupType Automatic\nStart-Service ssh-agent\nssh-add $env:USERPROFILE\\.ssh\\id_ed25519\n\n# 3. Copy public key\nGet-Content $env:USERPROFILE\\.ssh\\id_ed25519.pub | Set-Clipboard\n\n# 4. Test connection\nssh -T git@github.com\n\n# 5. Install GitHub CLI\nwinget install GitHub.cli\ngh auth login`;
    case 'macos':
      return `# GitHub SSH Setup on macOS\n\n# 1. Generate SSH key\nssh-keygen -t ed25519 -C "your_email@example.com"\n\n# 2. Add to SSH agent with Keychain\neval "$(ssh-agent -s)"\nssh-add --apple-use-keychain ~/.ssh/id_ed25519\n\n# 3. Copy public key\npbcopy < ~/.ssh/id_ed25519.pub\n\n# 4. Configure SSH\nmkdir -p ~/.ssh && chmod 700 ~/.ssh\ncat >> ~/.ssh/config << EOF\nHost github.com\n  AddKeysToAgent yes\n  UseKeychain yes\n  IdentityFile ~/.ssh/id_ed25519\nEOF\n\n# 5. Test connection\nssh -T git@github.com\n\n# 6. Install GitHub CLI\nbrew install gh\ngh auth login`;
    case 'linux':
      return `# GitHub SSH Setup on Linux\n\n# 1. Generate SSH key\nssh-keygen -t ed25519 -C "your_email@example.com"\n\n# 2. Add to SSH agent\neval "$(ssh-agent -s)"\nssh-add ~/.ssh/id_ed25519\n\n# 3. Copy public key\nxclip -sel clip < ~/.ssh/id_ed25519.pub\n# Or: cat ~/.ssh/id_ed25519.pub\n\n# 4. Configure SSH\nmkdir -p ~/.ssh && chmod 700 ~/.ssh\ncat >> ~/.ssh/config << EOF\nHost github.com\n  AddKeysToAgent yes\n  IdentityFile ~/.ssh/id_ed25519\nEOF\nchmod 600 ~/.ssh/config\n\n# 5. Test connection\nssh -T git@github.com\n\n# 6. Install GitHub CLI (Ubuntu/Debian)\ncurl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg\necho "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null\nsudo apt update && sudo apt install gh\ngh auth login`;
  }
}

// ============ UTILITIES ============

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
