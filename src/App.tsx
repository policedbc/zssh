import { useState } from 'react';
import { SSHConnection, ConnectionGroup, CONNECTION_COLORS } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import Sidebar from './components/Sidebar';
import ConnectionForm from './components/ConnectionForm';
import ConnectionDetail from './components/ConnectionDetail';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Terminal, Server, Shield, Zap, Globe, Monitor } from 'lucide-react';

const DEFAULT_GROUPS: ConnectionGroup[] = [
  { id: 'prod', name: 'Production', icon: '🔒', expanded: true, color: '#ef4444' },
  { id: 'staging', name: 'Staging', icon: '⚡', expanded: true, color: '#f59e0b' },
  { id: 'dev', name: 'Development', icon: '💻', expanded: true, color: '#10b981' },
];

const SAMPLE_CONNECTIONS: SSHConnection[] = [
  {
    id: uuidv4(),
    name: 'Web Server (Prod)',
    host: '10.0.1.50',
    port: 22,
    username: 'deploy',
    authType: 'key',
    keyPath: 'C:\\Users\\admin\\.ssh\\prod_key',
    color: '#ef4444',
    tags: ['production', 'web', 'nginx'],
    notes: 'Main production web server running Nginx + Node.js',
    groupId: 'prod',
    protocol: 'ssh',
    createdAt: Date.now() - 86400000 * 30,
    lastConnected: Date.now() - 3600000,
  },
  {
    id: uuidv4(),
    name: 'Database Server',
    host: '10.0.1.51',
    port: 22,
    username: 'dbadmin',
    authType: 'key',
    keyPath: 'C:\\Users\\admin\\.ssh\\prod_key',
    color: '#ef4444',
    tags: ['production', 'database', 'postgresql'],
    notes: 'PostgreSQL 15 primary database server',
    groupId: 'prod',
    protocol: 'ssh',
    createdAt: Date.now() - 86400000 * 25,
  },
  {
    id: uuidv4(),
    name: 'Staging API',
    host: 'staging-api.example.com',
    port: 2222,
    username: 'developer',
    authType: 'password',
    color: '#f59e0b',
    tags: ['staging', 'api', 'nodejs'],
    notes: 'Staging environment for API testing',
    groupId: 'staging',
    protocol: 'ssh',
    createdAt: Date.now() - 86400000 * 15,
  },
  {
    id: uuidv4(),
    name: 'Dev VM (Local)',
    host: '192.168.56.10',
    port: 22,
    username: 'vagrant',
    authType: 'key',
    keyPath: 'C:\\Users\\admin\\.vagrant.d\\insecure_private_key',
    color: '#10b981',
    tags: ['development', 'vagrant', 'virtualbox'],
    notes: 'Local Vagrant development VM',
    groupId: 'dev',
    protocol: 'ssh',
    createdAt: Date.now() - 86400000 * 10,
  },
  {
    id: uuidv4(),
    name: 'CI/CD Runner',
    host: 'ci.internal.company.com',
    port: 22,
    username: 'gitlab-runner',
    authType: 'agent',
    color: '#8b5cf6',
    tags: ['ci', 'gitlab', 'runner'],
    notes: 'GitLab CI runner for automated builds',
    groupId: '',
    protocol: 'ssh',
    createdAt: Date.now() - 86400000 * 5,
  },
];

export default function App() {
  const [connections, setConnections] = useLocalStorage<SSHConnection[]>('ssh-connections', SAMPLE_CONNECTIONS);
  const [groups, setGroups] = useLocalStorage<ConnectionGroup[]>('ssh-groups', DEFAULT_GROUPS);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<SSHConnection | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);

  const selectedConnection = connections.find(c => c.id === selectedConnectionId) || null;

  const handleSaveConnection = (conn: SSHConnection) => {
    setConnections(prev => {
      const exists = prev.find(c => c.id === conn.id);
      if (exists) {
        return prev.map(c => c.id === conn.id ? conn : c);
      }
      return [...prev, conn];
    });
    setShowForm(false);
    setEditingConnection(null);
    setSelectedConnectionId(conn.id);
  };

  const handleDeleteConnection = (id: string) => {
    if (confirm('Are you sure you want to delete this connection?')) {
      setConnections(prev => prev.filter(c => c.id !== id));
      if (selectedConnectionId === id) {
        setSelectedConnectionId(null);
      }
    }
  };

  const handleDuplicateConnection = (id: string) => {
    const conn = connections.find(c => c.id === id);
    if (conn) {
      const duplicate: SSHConnection = {
        ...conn,
        id: uuidv4(),
        name: `${conn.name} (Copy)`,
        createdAt: Date.now(),
      };
      setConnections(prev => [...prev, duplicate]);
      setSelectedConnectionId(duplicate.id);
    }
  };

  const handleAddGroup = (group: ConnectionGroup) => {
    setGroups(prev => [...prev, group]);
  };

  const handleDeleteGroup = (id: string) => {
    if (confirm('Delete this group? Connections will become ungrouped.')) {
      setGroups(prev => prev.filter(g => g.id !== id));
      setConnections(prev => prev.map(c => c.groupId === id ? { ...c, groupId: '' } : c));
      if (selectedGroupId === id) {
        setSelectedGroupId(null);
      }
    }
  };

  const handleToggleGroup = (id: string) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, expanded: !g.expanded } : g));
  };

  const handleEdit = () => {
    if (selectedConnection) {
      setEditingConnection(selectedConnection);
      setShowForm(true);
    }
  };

  const handleQuickConnect = (command: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalOutput(prev => [
      ...prev,
      `[${timestamp}] $ ${command}`,
      `[${timestamp}] Launching connection to ${selectedConnection?.host}...`,
      `[${timestamp}] Note: In a real environment, this would open your configured SSH client.`,
      `[${timestamp}] Command copied to clipboard for manual execution.`,
      '',
    ]);
    navigator.clipboard.writeText(command);
    setShowTerminal(true);
    
    // Update last connected
    if (selectedConnection) {
      setConnections(prev => prev.map(c => 
        c.id === selectedConnection.id ? { ...c, lastConnected: Date.now() } : c
      ));
    }
  };

  const handleImport = (data: { connections: SSHConnection[]; groups: ConnectionGroup[] }) => {
    if (confirm(`Import ${data.connections.length} connections and ${data.groups.length} groups? This will merge with existing data.`)) {
      setConnections(prev => [...prev, ...data.connections.map(c => ({ ...c, id: uuidv4() }))]);
      setGroups(prev => [...prev, ...data.groups.map(g => ({ ...g, id: uuidv4() }))]);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify({ connections, groups }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ssh-connections-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-[#13141f] text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        connections={connections}
        groups={groups}
        selectedConnectionId={selectedConnectionId}
        selectedGroupId={selectedGroupId}
        searchQuery={searchQuery}
        onSelectConnection={setSelectedConnectionId}
        onSelectGroup={setSelectedGroupId}
        onToggleGroup={handleToggleGroup}
        onSearchChange={setSearchQuery}
        onAddGroup={handleAddGroup}
        onDeleteGroup={handleDeleteGroup}
        onDeleteConnection={handleDeleteConnection}
        onDuplicateConnection={handleDuplicateConnection}
        onImport={handleImport}
        onExport={handleExport}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConnection ? (
          <ConnectionDetail
            connection={selectedConnection}
            groups={groups}
            onEdit={handleEdit}
            onQuickConnect={handleQuickConnect}
          />
        ) : (
          <WelcomeScreen
            connectionCount={connections.length}
            groupCount={groups.length}
            onNewConnection={() => { setEditingConnection(null); setShowForm(true); }}
          />
        )}

        {/* Terminal Output */}
        {showTerminal && (
          <div className="border-t border-[#2a2b3d] bg-[#0d0e17] max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2b3d]">
              <span className="text-xs text-gray-400 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Output
              </span>
              <button
                onClick={() => { setShowTerminal(false); setTerminalOutput([]); }}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Close
              </button>
            </div>
            <div className="p-4 font-mono text-xs">
              {terminalOutput.map((line, i) => (
                <div key={i} className={`${line.startsWith('[') && line.includes('$') ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {line || '\u00A0'}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Connection FAB */}
      <button
        onClick={() => { setEditingConnection(null); setShowForm(true); }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-500 rounded-full shadow-lg shadow-emerald-600/30 flex items-center justify-center transition-all hover:scale-110 z-30"
        title="New Connection"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Connection Form Modal */}
      {showForm && (
        <ConnectionForm
          connection={editingConnection}
          groups={groups}
          onSave={handleSaveConnection}
          onCancel={() => { setShowForm(false); setEditingConnection(null); }}
        />
      )}
    </div>
  );
}

function WelcomeScreen({ connectionCount, groupCount, onNewConnection }: { connectionCount: number; groupCount: number; onNewConnection: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/20">
          <Terminal className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">SSH Manager Pro</h2>
        <p className="text-gray-400 mb-8">
          Multi-SSH connection manager for Windows. Organize, manage, and quickly connect to all your servers.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard icon={<Server className="w-5 h-5 text-emerald-400" />} label="Connections" value={connectionCount} />
          <StatCard icon={<Monitor className="w-5 h-5 text-blue-400" />} label="Groups" value={groupCount} />
          <StatCard icon={<Shield className="w-5 h-5 text-purple-400" />} label="Protocols" value={3} />
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mb-8 text-left">
          <Feature icon={<Zap className="w-4 h-4 text-amber-400" />} text="Quick connect with one click" />
          <Feature icon={<Globe className="w-4 h-4 text-cyan-400" />} text="SSH, SFTP & SCP support" />
          <Feature icon={<Shield className="w-4 h-4 text-emerald-400" />} text="Key, password & agent auth" />
          <Feature icon={<Monitor className="w-4 h-4 text-purple-400" />} text="PuTTY & Windows Terminal" />
        </div>

        <button
          onClick={onNewConnection}
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-medium transition-colors"
        >
          <Plus className="w-5 h-5" /> Add New Connection
        </button>

        <p className="text-xs text-gray-600 mt-4">
          Tip: Use the + button or right-click connections for more options
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="p-3 bg-[#1a1b26] border border-[#2a2b3d] rounded-xl text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 p-2.5 bg-[#1a1b26] border border-[#2a2b3d] rounded-lg">
      {icon}
      <span className="text-xs text-gray-300">{text}</span>
    </div>
  );
}
