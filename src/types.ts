export type Platform = 'windows' | 'macos' | 'linux';
export type TerminalApp = 
  | 'windows-terminal' | 'cmd' | 'powershell' | 'putty' | 'mobaXterm' | 'tabby'
  | 'iterm2' | 'terminal-app' | 'warp' | 'alacritty'
  | 'gnome-terminal' | 'konsole' | 'xfce4-terminal' | 'tilix' | 'alacritty-linux' | 'tabby-linux';

export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key' | 'agent' | 'certificate';
  keyPath: string;
  password: string;
  certPath: string;
  color: string;
  tags: string[];
  notes: string;
  groupId: string;
  createdAt: number;
  lastConnected?: number;
  protocol: 'ssh' | 'sftp' | 'scp' | 'rdp' | 'telnet' | 'serial' | 'vnc';
  favorite: boolean;
  status: 'online' | 'offline' | 'unknown';
  portForwards: PortForward[];
  timeout: number;
  keepAliveInterval: number;
  encoding: string;
  startupCommands: string[];
  envVars: Record<string, string>;
  jumpHost: string;
  jumpPort: number;
  jumpUser: string;
  fontSize: number;
  theme: 'default' | 'solarized' | 'monokai' | 'dracula' | 'nord' | 'gruvbox';
  rdpResolution: string;
  rdpFullScreen: boolean;
  serialBaudRate: number;
  serialDataBits: number;
  totalConnections: number;
  avgSessionTime: number;
  zmodemEnabled: boolean;
  zmodemAutoReceive: boolean;
  zmodemBufferSize: number;
  githubEnabled: boolean;
  githubToken: string;
  githubRepos: string[];
  githubDeployKeys: DeployKey[];
  githubWebhooks: Webhook[];
  // Platform-specific
  vncPort: number;
  vncPassword: string;
  customTerminalCmd: string;
}

export interface PortForward {
  id: string;
  type: 'local' | 'remote' | 'dynamic';
  localPort: number;
  remoteHost: string;
  remotePort: number;
  enabled: boolean;
}

export interface ConnectionGroup {
  id: string;
  name: string;
  icon: string;
  expanded: boolean;
  color: string;
}

export interface CommandSnippet {
  id: string;
  name: string;
  command: string;
  description: string;
  tags: string[];
  createdAt: number;
  platform?: Platform;
}

export interface ConnectionHistory {
  id: string;
  connectionId: string;
  connectionName: string;
  host: string;
  timestamp: number;
  duration: number;
  status: 'success' | 'failed' | 'timeout';
  platform: Platform;
}

export interface FileTransfer {
  id: string;
  connectionId: string;
  type: 'upload' | 'download';
  protocol: 'zmodem' | 'scp' | 'sftp' | 'rsync';
  localPath: string;
  remotePath: string;
  fileSize: number;
  transferredSize: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  speed: number;
  startedAt: number;
  completedAt?: number;
}

export interface DeployKey {
  id: string;
  title: string;
  key: string;
  readOnly: boolean;
  createdAt: number;
  repository?: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  createdAt: number;
}

export interface AppSettings {
  platform: Platform;
  detectedPlatform: Platform;
  theme: 'dark' | 'light' | 'system';
  defaultPort: number;
  defaultUsername: string;
  defaultKeyPath: string;
  autoSave: boolean;
  confirmDelete: boolean;
  showStatusBar: boolean;
  terminalFont: string;
  terminalFontSize: number;
  scrollbackLines: number;
  copyOnSelect: boolean;
  bellSound: boolean;
  language: string;
  startupAction: 'dashboard' | 'lastConnection' | 'newConnection';
  proxyHost: string;
  proxyPort: number;
  proxyEnabled: boolean;
  zmodemDefaultPath: string;
  zmodemAutoAccept: boolean;
  zmodemMaxConcurrent: number;
  githubDefaultOrg: string;
  githubAutoSync: boolean;
  githubTokenStorage: 'memory' | 'encrypted' | 'system';
  // Platform-specific terminal
  preferredTerminal: TerminalApp;
  // Platform-specific paths
  sshConfigPath: string;
  sshKeyDir: string;
  downloadDir: string;
  // Platform-specific package manager
  packageManager: 'winget' | 'scoop' | 'choco' | 'brew' | 'apt' | 'dnf' | 'pacman' | 'zypper';
  // Auto-detect
  autoDetectPlatform: boolean;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration: number;
}

export interface PlatformInfo {
  name: string;
  icon: string;
  defaultShell: string;
  pathSep: string;
  homeDir: string;
  sshDir: string;
  defaultKeyPath: string;
  defaultTerminal: TerminalApp;
  packageManagers: { id: AppSettings['packageManager']; name: string; installCmd: string }[];
  terminals: { id: TerminalApp; name: string; icon: string }[];
}

export const PLATFORMS: Record<string, PlatformInfo> = {
  windows: {
    name: 'Windows',
    icon: '🪟',
    defaultShell: 'powershell',
    pathSep: '\\',
    homeDir: 'C:\\Users\\%USERNAME%',
    sshDir: 'C:\\Users\\%USERNAME%\\.ssh',
    defaultKeyPath: 'C:\\Users\\%USERNAME%\\.ssh\\id_ed25519',
    defaultTerminal: 'windows-terminal',
    packageManagers: [
      { id: 'winget', name: 'Windows Package Manager', installCmd: 'winget install' },
      { id: 'scoop', name: 'Scoop', installCmd: 'scoop install' },
      { id: 'choco', name: 'Chocolatey', installCmd: 'choco install' },
    ],
    terminals: [
      { id: 'windows-terminal', name: 'Windows Terminal', icon: '⬛' },
      { id: 'powershell', name: 'PowerShell', icon: '🔷' },
      { id: 'cmd', name: 'Command Prompt', icon: '⬜' },
      { id: 'putty', name: 'PuTTY', icon: '🟢' },
      { id: 'mobaXterm', name: 'MobaXterm', icon: '🔵' },
      { id: 'tabby', name: 'Tabby', icon: '🟤' },
    ],
  },
  macos: {
    name: 'macOS',
    icon: '🍎',
    defaultShell: 'zsh',
    pathSep: '/',
    homeDir: '~',
    sshDir: '~/.ssh',
    defaultKeyPath: '~/.ssh/id_ed25519',
    defaultTerminal: 'iterm2',
    packageManagers: [
      { id: 'brew', name: 'Homebrew', installCmd: 'brew install' },
    ],
    terminals: [
      { id: 'iterm2', name: 'iTerm2', icon: '🟩' },
      { id: 'terminal-app', name: 'Terminal.app', icon: '⬜' },
      { id: 'warp', name: 'Warp', icon: '🔶' },
      { id: 'alacritty', name: 'Alacritty', icon: '🔴' },
      { id: 'tabby', name: 'Tabby', icon: '🟤' },
    ],
  },
  linux: {
    name: 'Linux',
    icon: '🐧',
    defaultShell: 'bash',
    pathSep: '/',
    homeDir: '~',
    sshDir: '~/.ssh',
    defaultKeyPath: '~/.ssh/id_ed25519',
    defaultTerminal: 'gnome-terminal',
    packageManagers: [
      { id: 'apt', name: 'APT (Debian/Ubuntu)', installCmd: 'sudo apt install' },
      { id: 'dnf', name: 'DNF (Fedora)', installCmd: 'sudo dnf install' },
      { id: 'pacman', name: 'Pacman (Arch)', installCmd: 'sudo pacman -S' },
      { id: 'zypper', name: 'Zypper (openSUSE)', installCmd: 'sudo zypper install' },
    ],
    terminals: [
      { id: 'gnome-terminal', name: 'GNOME Terminal', icon: '⬛' },
      { id: 'konsole', name: 'Konsole', icon: '🟦' },
      { id: 'xfce4-terminal', name: 'XFCE Terminal', icon: '🟪' },
      { id: 'tilix', name: 'Tilix', icon: '🟫' },
      { id: 'alacritty-linux', name: 'Alacritty', icon: '🔴' },
      { id: 'tabby-linux', name: 'Tabby', icon: '🟤' },
    ],
  },
};

export const CONNECTION_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  '#84cc16', '#14b8a6', '#6366f1', '#e11d48',
];

export const GROUP_ICONS = [
  '🖥️', '🌐', '🔒', '📦', '🗄️', '⚡', '🏢', '🔧', '🌍', '💻',
  '🚀', '🛡️', '📡', '🔗', '🧪', '🎯', '📊', '🔑', '☁️', '🏠'
];

export const DEFAULT_SETTINGS: AppSettings = {
  platform: 'windows',
  detectedPlatform: 'windows',
  theme: 'dark',
  defaultPort: 22,
  defaultUsername: 'root',
  defaultKeyPath: 'C:\\Users\\%USERNAME%\\.ssh\\id_rsa',
  autoSave: true,
  confirmDelete: true,
  showStatusBar: true,
  terminalFont: 'Cascadia Code',
  terminalFontSize: 14,
  scrollbackLines: 10000,
  copyOnSelect: false,
  bellSound: true,
  language: 'en',
  startupAction: 'dashboard',
  proxyHost: '',
  proxyPort: 0,
  proxyEnabled: false,
  zmodemDefaultPath: 'C:\\Users\\%USERNAME%\\Downloads',
  zmodemAutoAccept: false,
  zmodemMaxConcurrent: 3,
  githubDefaultOrg: '',
  githubAutoSync: false,
  githubTokenStorage: 'encrypted',
  preferredTerminal: 'windows-terminal',
  sshConfigPath: 'C:\\Users\\%USERNAME%\\.ssh\\config',
  sshKeyDir: 'C:\\Users\\%USERNAME%\\.ssh',
  downloadDir: 'C:\\Users\\%USERNAME%\\Downloads',
  packageManager: 'winget',
  autoDetectPlatform: true,
};

export const CONNECTION_TEMPLATES: Partial<SSHConnection>[] = [
  { name: 'AWS EC2', host: '', port: 22, username: 'ec2-user', authType: 'key', tags: ['aws', 'cloud'], protocol: 'ssh' },
  { name: 'Azure VM', host: '', port: 22, username: 'azureuser', authType: 'key', tags: ['azure', 'cloud'], protocol: 'ssh' },
  { name: 'DigitalOcean', host: '', port: 22, username: 'root', authType: 'key', tags: ['digitalocean', 'cloud'], protocol: 'ssh' },
  { name: 'Raspberry Pi', host: '', port: 22, username: 'pi', authType: 'password', tags: ['raspberry', 'iot'], protocol: 'ssh' },
  { name: 'Docker Container', host: 'localhost', port: 2222, username: 'root', authType: 'password', tags: ['docker', 'container'], protocol: 'ssh' },
  { name: 'Vagrant Box', host: '127.0.0.1', port: 2222, username: 'vagrant', authType: 'key', tags: ['vagrant'], protocol: 'ssh' },
  { name: 'Windows RDP', host: '', port: 3389, username: 'Administrator', authType: 'password', tags: ['windows', 'rdp'], protocol: 'rdp' },
  { name: 'VNC Server', host: '', port: 5900, username: '', authType: 'password', tags: ['vnc', 'remote'], protocol: 'vnc' },
  { name: 'Network Switch', host: '', port: 22, username: 'admin', authType: 'password', tags: ['network', 'switch'], protocol: 'ssh' },
  { name: 'Cisco Router', host: '', port: 22, username: 'cisco', authType: 'password', tags: ['cisco', 'router'], protocol: 'ssh' },
  { name: 'Serial Device', host: 'COM1', port: 9600, username: '', authType: 'agent', tags: ['serial', 'iot'], protocol: 'serial', serialBaudRate: 9600 },
  { name: 'macOS Screen Share', host: '', port: 5900, username: '', authType: 'password', tags: ['macos', 'vnc'], protocol: 'vnc' },
];

export const KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl+N', mac: '⌘+N', action: 'newConnection', description: 'New Connection' },
  { keys: 'Ctrl+F', mac: '⌘+F', action: 'search', description: 'Search Connections' },
  { keys: 'Ctrl+E', mac: '⌘+E', action: 'editConnection', description: 'Edit Selected' },
  { keys: 'Ctrl+D', mac: '⌘+D', action: 'duplicateConnection', description: 'Duplicate Selected' },
  { keys: 'Delete', mac: '⌘+⌫', action: 'deleteConnection', description: 'Delete Selected' },
  { keys: 'Ctrl+Shift+D', mac: '⌘+⇧+D', action: 'dashboard', description: 'Open Dashboard' },
  { keys: 'Ctrl+,', mac: '⌘+,', action: 'settings', description: 'Open Settings' },
  { keys: 'Ctrl+T', mac: '⌘+T', action: 'fileTransfer', description: 'File Transfer' },
  { keys: 'Ctrl+G', mac: '⌘+G', action: 'github', description: 'GitHub Integration' },
  { keys: 'Ctrl+H', mac: '⌘+H', action: 'help', description: 'Help & Documentation' },
  { keys: 'Escape', mac: 'Escape', action: 'closeModal', description: 'Close Modal' },
];
