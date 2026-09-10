export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key' | 'agent';
  keyPath?: string;
  password?: string;
  color: string;
  tags: string[];
  notes: string;
  groupId: string;
  createdAt: number;
  lastConnected?: number;
  protocol: 'ssh' | 'sftp' | 'scp';
}

export interface ConnectionGroup {
  id: string;
  name: string;
  icon: string;
  expanded: boolean;
  color: string;
}

export interface AppState {
  connections: SSHConnection[];
  groups: ConnectionGroup[];
  selectedConnectionId: string | null;
  selectedGroupId: string | null;
  searchQuery: string;
}

export const CONNECTION_COLORS = [
  '#10b981', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export const GROUP_ICONS = [
  '🖥️', '🌐', '🔒', '📦', '🗄️', '⚡', '🏢', '🔧', '🌍', '💻'
];
