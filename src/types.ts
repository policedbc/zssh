export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key' | 'agent' | 'certificate';
  keyPath?: string;
  password?: string;
  certPath?: string;
  color: string;
  tags: string[];
  notes: string;
  groupId: string;
  createdAt: number;
  lastConnected?: number;
  protocol: 'ssh' | 'sftp' | 'scp' | 'rdp' | 'telnet' | 'serial';
  favorite: boolean;
  status: 'online' | 'offline' | 'unknown';
  portForwards: PortForward[];
  timeout: number;
  keepAliveInterval: number;
  encoding: string;
  startupCommands: string[];
  envVars: Record<string, string>;
  jumpHost?: string;
  jumpPort?: number;
  jumpUser?: string;
  fontSize: number;
  theme: 'default' | 'solarized' | 'monokai' | 'dracula';
  rdpResolution?: string;
  rdpFullScreen?: boolean;
  serialBaudRate?: number;
  serialDataBits?: number;
  totalConnections: number;
  avgSessionTime: number;
  // Zmodem/ZSSH features
  zmodemEnabled: boolean;
  zmodemAutoReceive: boolean;
  zmodemBufferSize: number;
  // GitHub integration
  githubEnabled: boolean;
  githubToken?: string;
  githubRepos?: string[];
  githubDeployKeys?: DeployKey[];
  githubWebhooks?: Webhook[];
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
  parentId?: string;
}

export interface CommandSnippet {
  id: string;
  name: string;
  command: string;
  description: string;
  tags: string[];
  createdAt: number;
}

export interface ConnectionHistory {
  id: string;
  connectionId: string;
  connectionName: string;
  host: string;
  timestamp: number;
  duration: number;
  status: 'success' | 'failed' | 'timeout';
  errorMessage?: string;
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
  errorMessage?: string;
}

export interface DeployKey {
  id: string;
  title: string;
  key: string;
  readOnly: boolean;
  createdAt: number;
  lastUsed?: number;
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

export interface GitHubRepo {
  id: string;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  sshUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  updatedAt: number;
}

export interface AppSettings {
  theme: 'dark' | 'light';
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
  // Zmodem settings
  zmodemDefaultPath: string;
  zmodemAutoAccept: boolean;
  zmodemMaxConcurrent: number;
  // GitHub settings
  githubDefaultOrg: string;
  githubAutoSync: boolean;
  githubTokenStorage: 'memory' | 'encrypted' | 'system';
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration: number;
}

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
};

export const CONNECTION_TEMPLATES: Partial<SSHConnection>[] = [
  { name: 'AWS EC2', host: '', port: 22, username: 'ec2-user', authType: 'key', keyPath: 'C:\\Users\\%USERNAME%\\.ssh\\aws-key.pem', tags: ['aws', 'cloud'], protocol: 'ssh' },
  { name: 'Azure VM', host: '', port: 22, username: 'azureuser', authType: 'key', tags: ['azure', 'cloud'], protocol: 'ssh' },
  { name: 'DigitalOcean', host: '', port: 22, username: 'root', authType: 'key', tags: ['digitalocean', 'cloud'], protocol: 'ssh' },
  { name: 'Raspberry Pi', host: '', port: 22, username: 'pi', authType: 'password', tags: ['raspberry', 'iot'], protocol: 'ssh' },
  { name: 'Docker Container', host: 'localhost', port: 2222, username: 'root', authType: 'password', tags: ['docker', 'container'], protocol: 'ssh' },
  { name: 'Vagrant Box', host: '127.0.0.1', port: 2222, username: 'vagrant', authType: 'key', keyPath: 'C:\\Users\\%USERNAME%\\.vagrant.d\\insecure_private_key', tags: ['vagrant'], protocol: 'ssh' },
  { name: 'Windows RDP', host: '', port: 3389, username: 'Administrator', authType: 'password', tags: ['windows', 'rdp'], protocol: 'rdp' },
  { name: 'Network Switch', host: '', port: 22, username: 'admin', authType: 'password', tags: ['network', 'switch'], protocol: 'ssh' },
  { name: 'Cisco Router', host: '', port: 22, username: 'cisco', authType: 'password', tags: ['cisco', 'router'], protocol: 'ssh' },
  { name: 'Serial Device', host: 'COM1', port: 9600, username: '', authType: 'agent', tags: ['serial', 'iot'], protocol: 'serial', serialBaudRate: 9600 },
];

export const KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl+N', action: 'newConnection', description: 'New Connection' },
  { keys: 'Ctrl+F', action: 'search', description: 'Search Connections' },
  { keys: 'Ctrl+E', action: 'editConnection', description: 'Edit Selected' },
  { keys: 'Ctrl+D', action: 'duplicateConnection', description: 'Duplicate Selected' },
  { keys: 'Delete', action: 'deleteConnection', description: 'Delete Selected' },
  { keys: 'Ctrl+Shift+D', action: 'dashboard', description: 'Open Dashboard' },
  { keys: 'Ctrl+,', action: 'settings', description: 'Open Settings' },
  { keys: 'Ctrl+Shift+S', action: 'snippets', description: 'Command Snippets' },
  { keys: 'Ctrl+Shift+K', action: 'keygen', description: 'Key Generator' },
  { keys: 'Ctrl+Shift+N', action: 'networkScan', description: 'Network Scanner' },
  { keys: 'Ctrl+T', action: 'fileTransfer', description: 'File Transfer' },
  { keys: 'Ctrl+G', action: 'github', description: 'GitHub Integration' },
  { keys: 'Ctrl+H', action: 'help', description: 'Help & Documentation' },
  { keys: 'Escape', action: 'closeModal', description: 'Close Modal' },
  { keys: 'Ctrl+1-9', action: 'switchGroup', description: 'Switch to Group' },
];
