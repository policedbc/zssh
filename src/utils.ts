import { SSHConnection, ConnectionHistory, Platform, PLATFORMS, AppSettings } from './types';
import { v4 as uuidv4 } from 'uuid';

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
    username: 'root',
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

export function generateSSHCommand(conn: SSHConnection, platform: Platform = 'windows'): string {
  let cmd = 'ssh';
  if (conn.port !== 22) cmd += ` -p ${conn.port}`;
  if (conn.authType === 'key' && conn.keyPath) cmd += ` -i "${conn.keyPath}"`;
  if (conn.authType === 'certificate' && conn.certPath) cmd += ` -o CertificateFile="${conn.certPath}"`;
  if (conn.jumpHost) {
    const jumpStr = conn.jumpUser ? `${conn.jumpUser}@${conn.jumpHost}` : conn.jumpHost;
    cmd += ` -J ${jumpStr}${conn.jumpPort && conn.jumpPort !== 22 ? `:${conn.jumpPort}` : ''}`;
  }
  conn.portForwards.filter(pf => pf.enabled).forEach(pf => {
    if (pf.type === 'local') cmd += ` -L ${pf.localPort}:${pf.remoteHost}:${pf.remotePort}`;
    if (pf.type === 'remote') cmd += ` -R ${pf.localPort}:${pf.remoteHost}:${pf.remotePort}`;
    if (pf.type === 'dynamic') cmd += ` -D ${pf.localPort}`;
  });
  if (conn.timeout !== 30) cmd += ` -o ConnectTimeout=${conn.timeout}`;
  if (conn.keepAliveInterval !== 60) cmd += ` -o ServerAliveInterval=${conn.keepAliveInterval}`;
  cmd += ` ${conn.username}@${conn.host}`;
  return cmd;
}

// ============ CROSS-PLATFORM TERMINAL LAUNCHERS ============

export function generateTerminalLaunch(conn: SSHConnection, settings: AppSettings): string {
  const sshCmd = generateSSHCommand(conn, settings.platform);
  const platform = settings.platform;
  const terminal = settings.preferredTerminal;

  switch (platform) {
    case 'windows':
      switch (terminal) {
        case 'windows-terminal': return `wt new-tab --title "${conn.name}" ${sshCmd}`;
        case 'powershell': return `powershell -NoExit -Command "${sshCmd}"`;
        case 'cmd': return `cmd /k "${sshCmd}"`;
        case 'putty': return generatePuTTYCommand(conn);
        case 'mobaXterm': return `mobaxterm -ssh ${conn.username}@${conn.host} -p ${conn.port}`;
        case 'tabby': return `tabby open ssh://${conn.username}@${conn.host}:${conn.port}`;
        default: return sshCmd;
      }
    case 'macos':
      switch (terminal) {
        case 'iterm2': return `osascript -e 'tell application "iTerm2" to create window with default command "${sshCmd}"'`;
        case 'terminal-app': return `osascript -e 'tell application "Terminal" to do script "${sshCmd}"'`;
        case 'warp': return `warp --command "${sshCmd}"`;
        case 'alacritty': return `alacritty -e ${sshCmd}`;
        case 'tabby': return `tabby open ssh://${conn.username}@${conn.host}:${conn.port}`;
        default: return sshCmd;
      }
    case 'linux':
      switch (terminal) {
        case 'gnome-terminal': return `gnome-terminal --title="${conn.name}" -- ${sshCmd}`;
        case 'konsole': return `konsole --title "${conn.name}" -e ${sshCmd}`;
        case 'xfce4-terminal': return `xfce4-terminal --title="${conn.name}" -x ${sshCmd}`;
        case 'tilix': return `tilix --title="${conn.name}" -e ${sshCmd}`;
        case 'alacritty-linux': return `alacritty --title "${conn.name}" -e ${sshCmd}`;
        case 'tabby-linux': return `tabby open ssh://${conn.username}@${conn.host}:${conn.port}`;
        default: return sshCmd;
      }
  }
}

// ============ CROSS-PLATFORM FILE TRANSFER ============

export function generateSCPCommand(conn: SSHConnection, localPath: string, remotePath: string, direction: 'upload' | 'download', platform: Platform = 'windows'): string {
  const host = `${conn.username}@${conn.host}`;
  const portFlag = conn.port !== 22 ? `-P ${conn.port}` : '';
  const keyFlag = conn.authType === 'key' && conn.keyPath ? `-i "${conn.keyPath}"` : '';
  if (direction === 'upload') {
    return `scp ${portFlag} ${keyFlag} "${localPath}" ${host}:${remotePath}`.replace(/\s+/g, ' ').trim();
  }
  return `scp ${portFlag} ${keyFlag} ${host}:${remotePath} "${localPath}"`.replace(/\s+/g, ' ').trim();
}

export function generateRsyncCommand(conn: SSHConnection, localPath: string, remotePath: string, direction: 'upload' | 'download', platform: Platform = 'windows'): string {
  const host = `${conn.username}@${conn.host}`;
  const sshCmd = `ssh -p ${conn.port}${conn.authType === 'key' && conn.keyPath ? ` -i "${conn.keyPath}"` : ''}`;
  if (direction === 'upload') {
    return `rsync -avz -e "${sshCmd}" "${localPath}" ${host}:${remotePath}`;
  }
  return `rsync -avz -e "${sshCmd}" ${host}:${remotePath} "${localPath}"`;
}

export function generateZmodemCommand(conn: SSHConnection): string {
  return `ssh -o "Protocol=2" ${conn.username}@${conn.host} -t "rz -be"`;
}

// ============ CROSS-PLATFORM RDP/VNC ============

export function generateRDPCommand(conn: SSHConnection, platform: Platform = 'windows'): string {
  switch (platform) {
    case 'windows':
      return `mstsc /v:${conn.host}:${conn.port} /u:${conn.username}`;
    case 'macos':
      return `open "rdp://full address=s:${conn.host}:${conn.port}&username=s:${conn.username}"`;
    case 'linux':
      return `xfreerdp /v:${conn.host}:${conn.port} /u:${conn.username} /dynamic-resolution`;
  }
}

export function generateVNCCommand(conn: SSHConnection, platform: Platform = 'windows'): string {
  const vncUrl = `vnc://${conn.username ? `${conn.username}@` : ''}${conn.host}:${conn.vncPort || 5900}`;
  switch (platform) {
    case 'windows':
      return `start "" "${vncUrl}"  # Requires VNC client`;
    case 'macos':
      return `open "${vncUrl}"  # Uses built-in Screen Sharing`;
    case 'linux':
      return `vinagre ${vncUrl}  # Or: remmina --protocol=vnc --server=${conn.host}`;
  }
}

// ============ CROSS-PLATFORM PUTTY ============

export function generatePuTTYCommand(conn: SSHConnection): string {
  let cmd = 'putty';
  if (conn.port !== 22) cmd += ` -P ${conn.port}`;
  if (conn.authType === 'key' && conn.keyPath) {
    // Convert OpenSSH key to PuTTY format path
    const ppkPath = conn.keyPath.replace(/\.(pem|key)$/, '.ppk');
    cmd += ` -i "${ppkPath}"`;
  }
  cmd += ` ${conn.username}@${conn.host}`;
  return cmd;
}

// ============ CROSS-PLATFORM BATCH SCRIPTS ============

export function generateBatchScript(connections: SSHConnection[], platform: Platform = 'windows'): string {
  if (platform === 'windows') {
    let script = '@echo off\r\n';
    script += 'REM Generated by SSH Manager Pro (Windows)\r\n';
    script += `REM Date: ${new Date().toLocaleDateString()}\r\n\r\n`;
    connections.forEach(conn => {
      script += `echo Connecting to ${conn.name}...\r\n`;
      script += `start "${conn.name}" cmd /k "${generateSSHCommand(conn, 'windows')}"\r\n\r\n`;
    });
    script += 'echo All connections launched!\r\npause\r\n';
    return script;
  } else if (platform === 'macos') {
    let script = '#!/bin/bash\n';
    script += '# Generated by SSH Manager Pro (macOS)\n';
    script += `# Date: ${new Date().toLocaleDateString()}\n\n`;
    connections.forEach(conn => {
      script += `echo "Connecting to ${conn.name}..."\n`;
      script += `osascript -e 'tell application "Terminal" to do script "${generateSSHCommand(conn, 'macos')}"'\n\n`;
    });
    return script;
  } else {
    let script = '#!/bin/bash\n';
    script += '# Generated by SSH Manager Pro (Linux)\n';
    script += `# Date: ${new Date().toLocaleDateString()}\n\n`;
    connections.forEach(conn => {
      script += `echo "Connecting to ${conn.name}..."\n`;
      script += `gnome-terminal --title="${conn.name}" -- ${generateSSHCommand(conn, 'linux')} &\n\n`;
    });
    script += 'echo "All connections launched!"\n';
    return script;
  }
}

export function generatePowerShellScript(connections: SSHConnection[], platform: Platform = 'windows'): string {
  if (platform === 'windows') {
    let script = '# Generated by SSH Manager Pro (Windows PowerShell)\r\n';
    script += `# Date: ${new Date().toLocaleDateString()}\r\n\r\n`;
    connections.forEach(conn => {
      script += `Write-Host "Connecting to ${conn.name}..." -ForegroundColor Cyan\r\n`;
      script += `Start-Process wt -ArgumentList 'new-tab --title "${conn.name}" ${generateSSHCommand(conn, 'windows')}'\r\n\r\n`;
    });
    return script;
  } else if (platform === 'macos') {
    let script = '# Generated by SSH Manager Pro (macOS PowerShell)\n';
    script += `# Date: ${new Date().toLocaleDateString()}\n\n`;
    connections.forEach(conn => {
      script += `Write-Host "Connecting to ${conn.name}..." -ForegroundColor Cyan\n`;
      script += `osascript -e 'tell application "iTerm2" to create window with default command "${generateSSHCommand(conn, 'macos')}"'\n\n`;
    });
    return script;
  } else {
    let script = '# Generated by SSH Manager Pro (Linux PowerShell)\n';
    script += `# Date: ${new Date().toLocaleDateString()}\n\n`;
    connections.forEach(conn => {
      script += `Write-Host "Connecting to ${conn.name}..." -ForegroundColor Cyan\n`;
      script += `gnome-terminal --title="${conn.name}" -- ${generateSSHCommand(conn, 'linux')} &\n\n`;
    });
    return script;
  }
}

// ============ CROSS-PLATFORM SSH CONFIG PARSER ============

export function parseSSHConfig(config: string, platform: Platform = 'windows'): Partial<SSHConnection>[] {
  const results: Partial<SSHConnection>[] = [];
  const lines = config.split('\n');
  let current: Partial<SSHConnection> | null = null;
  const pInfo = PLATFORMS[platform];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(\S+)\s+(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key.toLowerCase() === 'host') {
      if (current && current.name) results.push(current);
      current = { name: value, host: value, protocol: 'ssh' };
    } else if (current) {
      switch (key.toLowerCase()) {
        case 'hostname': current.host = value; break;
        case 'port': current.port = parseInt(value); break;
        case 'user': current.username = value; break;
        case 'identityfile':
          current.keyPath = value.replace('~', pInfo.homeDir);
          current.authType = 'key';
          break;
      }
    }
  }
  if (current && current.name) results.push(current);
  return results;
}

// ============ CROSS-PLATFORM PACKAGE INSTALL COMMANDS ============

export function generateInstallCommand(pkg: string, settings: AppSettings): string {
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
  const pInfo = PLATFORMS[platform];
  let cmd = `ssh-keygen -t ${keyType}`;
  if (keyType === 'rsa') cmd += ` -b ${bits}`;
  if (keyType === 'ecdsa') cmd += ` -b 521`;
  cmd += ` -C "${comment || 'your@email.com'}"`;
  cmd += ` -f ${pInfo.defaultKeyPath.replace('id_ed25519', `id_${keyType}`)}`;
  return cmd;
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
