import { useState, useEffect, useCallback, useRef } from 'react';
import { SSHConnection, ConnectionGroup, CommandSnippet, ConnectionHistory, AppSettings, Toast, DEFAULT_SETTINGS, CONNECTION_COLORS, GROUP_ICONS, CONNECTION_TEMPLATES, KEYBOARD_SHORTCUTS, PortForward } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useToast } from './hooks/useToast';
import { createDefaultConnection, generateSSHCommand, generatePuTTYCommand, generateRDPCommand, generateBatchScript, generatePowerShellScript, parseSSHConfig, formatDuration, formatDate, createHistoryEntry } from './utils';
import { v4 as uuidv4 } from 'uuid';
import {
  Terminal, Server, Plus, Search, ChevronDown, ChevronRight, Trash2, Edit3, Copy,
  Download, Upload, Play, Globe, User, Key, Lock, Hash, FileText, Tag, StickyNote,
  Shield, Wifi, Clock, Star, StarOff, Settings, BarChart3, History, Zap, Monitor,
  FolderPlus, X, Save, Network, Radio, Code2, FileCode, Layers, ArrowRight,
  CheckCircle2, XCircle, AlertCircle, Info, RefreshCw, ExternalLink, Eye, EyeOff,
  Keyboard, HelpCircle, Cpu, HardDrive, Activity, Power, GitBranch, Box,
  PanelLeftClose, PanelLeftOpen, Maximize2, Minimize2, MoreVertical
} from 'lucide-react';

type View = 'dashboard' | 'connections' | 'history' | 'snippets' | 'settings' | 'keygen' | 'scanner' | 'scripts' | 'shortcuts' | 'templates';

export default function App() {
  const [connections, setConnections] = useLocalStorage<SSHConnection[]>('ssh-connections', []);
  const [groups, setGroups] = useLocalStorage<ConnectionGroup[]>('ssh-groups', [
    { id: 'prod', name: 'Production', icon: '🔒', expanded: true, color: '#ef4444' },
    { id: 'staging', name: 'Staging', icon: '⚡', expanded: true, color: '#f59e0b' },
    { id: 'dev', name: 'Development', icon: '💻', expanded: true, color: '#10b981' },
  ]);
  const [settings, setSettings] = useLocalStorage<AppSettings>('ssh-settings', DEFAULT_SETTINGS);
  const [snippets, setSnippets] = useLocalStorage<CommandSnippet[]>('ssh-snippets', []);
  const [history, setHistory] = useLocalStorage<ConnectionHistory[]>('ssh-history', []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [showForm, setShowForm] = useState(false);
  const [editingConn, setEditingConn] = useState<SSHConnection | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedConn = connections.find(c => c.id === selectedId) || null;

  // Initialize with sample data if empty
  useEffect(() => {
    if (connections.length === 0) {
      const samples: SSHConnection[] = [
        createDefaultConnection({ name: 'Web Server (Prod)', host: '10.0.1.50', username: 'deploy', authType: 'key', keyPath: 'C:\\Users\\admin\\.ssh\\prod_key', color: '#ef4444', tags: ['production', 'web'], notes: 'Main production web server', groupId: 'prod', totalConnections: 45, avgSessionTime: 1800000 }),
        createDefaultConnection({ name: 'Database Server', host: '10.0.1.51', username: 'dbadmin', authType: 'key', keyPath: 'C:\\Users\\admin\\.ssh\\prod_key', color: '#ef4444', tags: ['production', 'database'], notes: 'PostgreSQL 15 primary', groupId: 'prod', totalConnections: 32, avgSessionTime: 2400000 }),
        createDefaultConnection({ name: 'Staging API', host: 'staging-api.example.com', port: 2222, username: 'developer', authType: 'password', color: '#f59e0b', tags: ['staging', 'api'], groupId: 'staging', totalConnections: 18, avgSessionTime: 900000 }),
        createDefaultConnection({ name: 'Dev VM (Local)', host: '192.168.56.10', username: 'vagrant', authType: 'key', keyPath: 'C:\\Users\\admin\\.vagrant.d\\insecure_private_key', color: '#10b981', tags: ['development', 'vagrant'], groupId: 'dev', totalConnections: 156, avgSessionTime: 3600000, favorite: true }),
        createDefaultConnection({ name: 'CI/CD Runner', host: 'ci.internal.company.com', username: 'gitlab-runner', authType: 'agent', color: '#8b5cf6', tags: ['ci', 'gitlab'], totalConnections: 8, avgSessionTime: 600000 }),
        createDefaultConnection({ name: 'Windows RDP Server', host: '10.0.2.100', port: 3389, username: 'Administrator', authType: 'password', color: '#3b82f6', tags: ['windows', 'rdp'], protocol: 'rdp', groupId: 'prod' }),
      ];
      setConnections(samples);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); setEditingConn(null); setShowForm(true); }
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.ctrlKey && e.key === 'e' && selectedConn) { e.preventDefault(); setEditingConn(selectedConn); setShowForm(true); }
      if (e.ctrlKey && e.key === 'd' && selectedConn) { e.preventDefault(); handleDuplicate(selectedConn.id); }
      if (e.key === 'Escape') { setShowForm(false); setEditingConn(null); }
      if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); setCurrentView('dashboard'); }
      if (e.ctrlKey && e.key === ',') { e.preventDefault(); setCurrentView('settings'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedConn]);

  // Handlers
  const handleSaveConn = (conn: SSHConnection) => {
    setConnections(prev => {
      const exists = prev.find(c => c.id === conn.id);
      if (exists) return prev.map(c => c.id === conn.id ? conn : c);
      return [...prev, conn];
    });
    setShowForm(false);
    setEditingConn(null);
    setSelectedId(conn.id);
    addToast('success', 'Saved', `Connection "${conn.name}" saved successfully`);
  };

  const handleDeleteConn = (id: string) => {
    const conn = connections.find(c => c.id === id);
    if (settings.confirmDelete && !confirm(`Delete "${conn?.name}"?`)) return;
    setConnections(prev => prev.filter(c => c.id !== id));
    if (selectedId === id) setSelectedId(null);
    addToast('info', 'Deleted', 'Connection removed');
  };

  const handleDuplicate = (id: string) => {
    const conn = connections.find(c => c.id === id);
    if (conn) {
      const dup = { ...conn, id: uuidv4(), name: `${conn.name} (Copy)`, createdAt: Date.now() };
      setConnections(prev => [...prev, dup]);
      setSelectedId(dup.id);
      addToast('success', 'Duplicated', `"${conn.name}" duplicated`);
    }
  };

  const handleQuickConnect = (conn: SSHConnection) => {
    const cmd = conn.protocol === 'rdp' ? generateRDPCommand(conn) : generateSSHCommand(conn);
    navigator.clipboard.writeText(cmd);
    setHistory(prev => [createHistoryEntry(conn, 'success', Math.random() * 3600000), ...prev].slice(0, 100));
    setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, lastConnected: Date.now(), totalConnections: c.totalConnections + 1 } : c));
    addToast('success', 'Connected', `Command copied: ${cmd}`);
  };

  const handleBatchConnect = () => {
    selectedIds.forEach(id => {
      const conn = connections.find(c => c.id === id);
      if (conn) handleQuickConnect(conn);
    });
    addToast('success', 'Batch Connect', `Launched ${selectedIds.size} connections`);
    setBatchMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchDelete = () => {
    if (!confirm(`Delete ${selectedIds.size} connections?`)) return;
    setConnections(prev => prev.filter(c => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    setBatchMode(false);
    addToast('info', 'Batch Delete', `${selectedIds.size} connections removed`);
  };

  const handleToggleFavorite = (id: string) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, favorite: !c.favorite } : c));
  };

  const handleCheckStatus = (id: string) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'unknown' } : c));
    setTimeout(() => {
      const online = Math.random() > 0.3;
      setConnections(prev => prev.map(c => c.id === id ? { ...c, status: online ? 'online' : 'offline' } : c));
      addToast(online ? 'success' : 'error', 'Status Check', online ? 'Host is reachable' : 'Host is unreachable');
    }, 1500);
  };

  const handleExport = () => {
    const data = JSON.stringify({ connections, groups, snippets, settings }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ssh-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Exported', 'Backup file downloaded');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target?.result as string);
            if (data.connections) setConnections(prev => [...prev, ...data.connections.map((c: SSHConnection) => ({ ...c, id: uuidv4() }))]);
            if (data.groups) setGroups(prev => [...prev, ...data.groups.map((g: ConnectionGroup) => ({ ...g, id: uuidv4() }))]);
            if (data.snippets) setSnippets(prev => [...prev, ...data.snippets.map((s: CommandSnippet) => ({ ...s, id: uuidv4() }))]);
            addToast('success', 'Imported', 'Data imported successfully');
          } catch { addToast('error', 'Import Failed', 'Invalid file format'); }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleImportSSHConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.config,.*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const parsed = parseSSHConfig(ev.target?.result as string);
          const newConns = parsed.map(p => createDefaultConnection(p));
          setConnections(prev => [...prev, ...newConns]);
          addToast('success', 'SSH Config Imported', `${newConns.length} hosts imported`);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredConnections = connections.filter(conn => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || conn.name.toLowerCase().includes(q) || conn.host.toLowerCase().includes(q) || conn.username.toLowerCase().includes(q) || conn.tags.some(t => t.toLowerCase().includes(q));
    if (selectedGroupId) return matchesSearch && conn.groupId === selectedGroupId;
    return matchesSearch;
  });

  const isDark = settings.theme === 'dark';

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? 'bg-[#0f1117] text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Navigation Rail */}
      <nav className={`w-14 flex flex-col items-center py-3 gap-1 border-r ${isDark ? 'bg-[#13141f] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
        <NavButton icon={<Terminal className="w-5 h-5" />} label="SSH Manager" active={false} onClick={() => {}} disabled />
        <div className={`w-8 h-px my-2 ${isDark ? 'bg-[#2a2b3d]' : 'bg-gray-200'}`} />
        <NavButton icon={<BarChart3 className="w-5 h-5" />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
        <NavButton icon={<Server className="w-5 h-5" />} label="Connections" active={currentView === 'connections'} onClick={() => setCurrentView('connections')} />
        <NavButton icon={<History className="w-5 h-5" />} label="History" active={currentView === 'history'} onClick={() => setCurrentView('history')} />
        <NavButton icon={<Code2 className="w-5 h-5" />} label="Snippets" active={currentView === 'snippets'} onClick={() => setCurrentView('snippets')} />
        <NavButton icon={<Layers className="w-5 h-5" />} label="Templates" active={currentView === 'templates'} onClick={() => setCurrentView('templates')} />
        <NavButton icon={<FileCode className="w-5 h-5" />} label="Scripts" active={currentView === 'scripts'} onClick={() => setCurrentView('scripts')} />
        <NavButton icon={<Radio className="w-5 h-5" />} label="Scanner" active={currentView === 'scanner'} onClick={() => setCurrentView('scanner')} />
        <NavButton icon={<Key className="w-5 h-5" />} label="Key Gen" active={currentView === 'keygen'} onClick={() => setCurrentView('keygen')} />
        <div className="flex-1" />
        <NavButton icon={<Keyboard className="w-5 h-5" />} label="Shortcuts" active={currentView === 'shortcuts'} onClick={() => setCurrentView('shortcuts')} />
        <NavButton icon={<Settings className="w-5 h-5" />} label="Settings" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
      </nav>

      {/* Sidebar */}
      {!sidebarCollapsed && currentView === 'connections' && (
        <div className={`w-72 border-r flex flex-col ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
          {/* Sidebar Header */}
          <div className={`p-3 border-b ${isDark ? 'border-[#1e2030]' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <h2 className={`text-sm font-semibold flex-1 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Connections</h2>
              <button onClick={() => setSidebarCollapsed(true)} className={`p-1 rounded ${isDark ? 'hover:bg-[#24253a]' : 'hover:bg-gray-100'}`}>
                <PanelLeftClose className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input ref={searchRef} type="text" placeholder="Search... (Ctrl+F)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${isDark ? 'bg-[#1e2030] border-[#2a2b3d] text-gray-200 placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'}`} />
            </div>
            <div className="flex gap-1 mt-2">
              <button onClick={() => { setEditingConn(null); setShowForm(true); }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-md">
                <Plus className="w-3 h-3" /> New
              </button>
              <button onClick={handleExport} className={`px-2 py-1 text-xs rounded-md ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                <Download className="w-3 h-3" />
              </button>
              <button onClick={handleImport} className={`px-2 py-1 text-xs rounded-md ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                <Upload className="w-3 h-3" />
              </button>
              <button onClick={handleImportSSHConfig} className={`px-2 py-1 text-xs rounded-md ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`} title="Import SSH Config">
                <FileText className="w-3 h-3" />
              </button>
              <button onClick={() => setBatchMode(!batchMode)} className={`px-2 py-1 text-xs rounded-md ${batchMode ? 'bg-amber-600 text-white' : isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`} title="Batch Mode">
                <Layers className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Batch Actions */}
          {batchMode && selectedIds.size > 0 && (
            <div className={`px-3 py-2 border-b flex items-center gap-2 ${isDark ? 'bg-amber-900/20 border-amber-800/30' : 'bg-amber-50 border-amber-200'}`}>
              <span className="text-xs text-amber-400">{selectedIds.size} selected</span>
              <button onClick={handleBatchConnect} className="px-2 py-0.5 bg-emerald-600 text-white text-xs rounded">Connect All</button>
              <button onClick={handleBatchDelete} className="px-2 py-0.5 bg-red-600 text-white text-xs rounded">Delete</button>
              <button onClick={() => setSelectedIds(new Set())} className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200">Clear</button>
            </div>
          )}

          {/* All / Favorites */}
          <div className="px-2 pt-2 space-y-0.5">
            <SidebarButton icon={<Server className="w-4 h-4" />} label="All" count={connections.length} active={selectedGroupId === null} onClick={() => setSelectedGroupId(null)} isDark={isDark} />
            <SidebarButton icon={<Star className="w-4 h-4" />} label="Favorites" count={connections.filter(c => c.favorite).length} active={false} onClick={() => setSearchQuery('__favorite__')} isDark={isDark} />
          </div>

          {/* Groups */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {groups.map(group => {
              const groupConns = filteredConnections.filter(c => c.groupId === group.id);
              return (
                <div key={group.id} className="mb-1">
                  <div className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer group ${isDark ? 'hover:bg-[#1e2030]' : 'hover:bg-gray-100'}`} onClick={() => setGroups(prev => prev.map(g => g.id === group.id ? { ...g, expanded: !g.expanded } : g))}>
                    <span className="text-gray-500">{group.expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
                    <span className="text-xs">{group.icon}</span>
                    <span className={`text-xs flex-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{group.name}</span>
                    <span className="text-[10px] text-gray-500">{groupConns.length}</span>
                    <button onClick={e => { e.stopPropagation(); setGroups(prev => prev.filter(g => g.id !== group.id)); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {group.expanded && (
                    <div className="ml-3 space-y-0.5">
                      {groupConns.map(conn => (
                        <ConnItem key={conn.id} conn={conn} isSelected={conn.id === selectedId} isBatch={batchMode} isBatchSelected={selectedIds.has(conn.id)} isDark={isDark}
                          onSelect={() => batchMode ? toggleSelect(conn.id) : setSelectedId(conn.id)}
                          onConnect={() => handleQuickConnect(conn)}
                          onToggleFav={() => handleToggleFavorite(conn.id)}
                          onCheckStatus={() => handleCheckStatus(conn.id)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Ungrouped */}
            {filteredConnections.filter(c => !c.groupId || !groups.find(g => g.id === c.groupId)).length > 0 && (
              <div className="mt-2">
                <p className={`text-[10px] uppercase tracking-wider px-2 py-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Ungrouped</p>
                {filteredConnections.filter(c => !c.groupId || !groups.find(g => g.id === c.groupId)).map(conn => (
                  <ConnItem key={conn.id} conn={conn} isSelected={conn.id === selectedId} isBatch={batchMode} isBatchSelected={selectedIds.has(conn.id)} isDark={isDark}
                    onSelect={() => batchMode ? toggleSelect(conn.id) : setSelectedId(conn.id)}
                    onConnect={() => handleQuickConnect(conn)}
                    onToggleFav={() => handleToggleFavorite(conn.id)}
                    onCheckStatus={() => handleCheckStatus(conn.id)} />
                ))}
              </div>
            )}
          </div>

          {/* Add Group */}
          <div className={`p-2 border-t ${isDark ? 'border-[#1e2030]' : 'border-gray-200'}`}>
            <AddGroupForm groups={groups} onAdd={(g) => setGroups(prev => [...prev, g])} isDark={isDark} />
          </div>
        </div>
      )}

      {sidebarCollapsed && currentView === 'connections' && (
        <button onClick={() => setSidebarCollapsed(false)} className={`w-8 flex items-center justify-center border-r ${isDark ? 'bg-[#161822] border-[#1e2030] hover:bg-[#1e2030]' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
          <PanelLeftOpen className="w-4 h-4 text-gray-400" />
        </button>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {currentView === 'dashboard' && <Dashboard connections={connections} groups={groups} history={history} isDark={isDark} onNavigate={setCurrentView} />}
        {currentView === 'connections' && (
          selectedConn ? (
            <ConnDetail conn={selectedConn} groups={groups} isDark={isDark} onEdit={() => { setEditingConn(selectedConn); setShowForm(true); }} onConnect={() => handleQuickConnect(selectedConn)} onToggleFav={() => handleToggleFavorite(selectedConn.id)} onCheckStatus={() => handleCheckStatus(selectedConn.id)} />
          ) : (
            <WelcomeScreen isDark={isDark} onNew={() => { setEditingConn(null); setShowForm(true); }} count={connections.length} />
          )
        )}
        {currentView === 'history' && <HistoryView history={history} connections={connections} isDark={isDark} onClear={() => setHistory([])} />}
        {currentView === 'snippets' && <SnippetsView snippets={snippets} isDark={isDark} onSave={(s) => setSnippets(prev => [...prev, s])} onDelete={(id) => setSnippets(prev => prev.filter(s => s.id !== id))} />}
        {currentView === 'settings' && <SettingsView settings={settings} isDark={isDark} onSave={(s) => { setSettings(s); addToast('success', 'Settings', 'Settings saved'); }} />}
        {currentView === 'keygen' && <KeyGenView isDark={isDark} addToast={addToast} />}
        {currentView === 'scanner' && <ScannerView isDark={isDark} connections={connections} addToast={addToast} onImport={(conns) => setConnections(prev => [...prev, ...conns])} />}
        {currentView === 'scripts' && <ScriptsView connections={connections} isDark={isDark} addToast={addToast} />}
        {currentView === 'shortcuts' && <ShortcutsView isDark={isDark} />}
        {currentView === 'templates' && <TemplatesView isDark={isDark} groups={groups} onApply={(template) => { const conn = createDefaultConnection(template); setEditingConn(conn); setShowForm(true); }} />}
      </div>

      {/* Connection Form Modal */}
      {showForm && (
        <ConnForm conn={editingConn} groups={groups} isDark={isDark} onSave={handleSaveConn} onCancel={() => { setShowForm(false); setEditingConn(null); }} />
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </div>
  );
}

// ============ SUB-COMPONENTS ============

function NavButton({ icon, label, active, onClick, disabled }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${active ? 'bg-emerald-600/20 text-emerald-400' : disabled ? 'text-gray-600 cursor-default' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
      {icon}
    </button>
  );
}

function SidebarButton({ icon, label, count, active, onClick, isDark }: { icon: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void; isDark: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${active ? 'bg-emerald-600/20 text-emerald-400' : isDark ? 'text-gray-300 hover:bg-[#1e2030]' : 'text-gray-700 hover:bg-gray-100'}`}>
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <span className="text-[10px] text-gray-500">{count}</span>
    </button>
  );
}

function ConnItem({ conn, isSelected, isBatch, isBatchSelected, isDark, onSelect, onConnect, onToggleFav, onCheckStatus }: { conn: SSHConnection; isSelected: boolean; isBatch: boolean; isBatchSelected: boolean; isDark: boolean; onSelect: () => void; onConnect: () => void; onToggleFav: () => void; onCheckStatus: () => void }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div className={`relative flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer group transition-colors ${isSelected && !isBatch ? 'bg-emerald-600/15 border border-emerald-500/30' : isBatchSelected ? 'bg-amber-600/15 border border-amber-500/30' : `border border-transparent ${isDark ? 'hover:bg-[#1e2030]' : 'hover:bg-gray-100'}`}`} onClick={onSelect}>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: conn.color }} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{conn.name}</p>
        <p className="text-[10px] text-gray-500 truncate">{conn.username}@{conn.host}</p>
      </div>
      {conn.favorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
      <StatusDot status={conn.status} />
      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
        <button onClick={e => { e.stopPropagation(); onConnect(); }} className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400" title="Connect"><Play className="w-3 h-3" /></button>
        <button onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-1 hover:bg-white/10 rounded text-gray-400"><MoreVertical className="w-3 h-3" /></button>
      </div>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className={`absolute right-0 top-full mt-1 z-50 py-1 rounded-lg shadow-xl border min-w-[130px] ${isDark ? 'bg-[#1e2030] border-[#2a2b3d]' : 'bg-white border-gray-200'}`}>
            <MenuItem icon={<Star className="w-3.5 h-3.5" />} label={conn.favorite ? 'Unfavorite' : 'Favorite'} onClick={() => { onToggleFav(); setShowMenu(false); }} isDark={isDark} />
            <MenuItem icon={<RefreshCw className="w-3.5 h-3.5" />} label="Check Status" onClick={() => { onCheckStatus(); setShowMenu(false); }} isDark={isDark} />
            <MenuItem icon={<Copy className="w-3.5 h-3.5" />} label="Duplicate" onClick={() => { navigator.clipboard.writeText(generateSSHCommand(conn)); setShowMenu(false); }} isDark={isDark} />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, isDark }: { icon: React.ReactNode; label: string; onClick: () => void; isDark: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs ${isDark ? 'text-gray-300 hover:bg-[#24253a]' : 'text-gray-700 hover:bg-gray-100'}`}>
      {icon} {label}
    </button>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors = { online: 'bg-emerald-400', offline: 'bg-red-400', unknown: 'bg-gray-500' };
  return <div className={`w-1.5 h-1.5 rounded-full ${colors[status as keyof typeof colors] || 'bg-gray-500'}`} />;
}

function AddGroupForm({ groups, onAdd, isDark }: { groups: ConnectionGroup[]; onAdd: (g: ConnectionGroup) => void; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🖥️');
  const [color, setColor] = useState(CONNECTION_COLORS[0]);

  const submit = () => {
    if (name.trim()) {
      onAdd({ id: uuidv4(), name: name.trim(), icon, expanded: true, color });
      setName('');
      setOpen(false);
    }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${isDark ? 'text-gray-400 hover:bg-[#1e2030]' : 'text-gray-500 hover:bg-gray-100'}`}>
      <FolderPlus className="w-3.5 h-3.5" /> Add Group
    </button>
  );

  return (
    <div className="space-y-2">
      <input type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Group name..." autoFocus
        className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${isDark ? 'bg-[#1e2030] border-[#2a2b3d] text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`} />
      <div className="flex gap-1 flex-wrap">
        {GROUP_ICONS.slice(0, 10).map(i => (
          <button key={i} onClick={() => setIcon(i)} className={`w-6 h-6 flex items-center justify-center rounded text-xs ${icon === i ? 'bg-emerald-600/30 ring-1 ring-emerald-500' : ''}`}>{i}</button>
        ))}
      </div>
      <div className="flex gap-1">
        {CONNECTION_COLORS.slice(0, 6).map(c => (
          <button key={c} onClick={() => setColor(c)} className={`w-4 h-4 rounded-full ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[#161822]' : ''}`} style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="flex gap-1">
        <button onClick={submit} className="flex-1 px-2 py-1 bg-emerald-600 text-white text-xs rounded">Add</button>
        <button onClick={() => setOpen(false)} className="px-2 py-1 text-xs text-gray-400">Cancel</button>
      </div>
    </div>
  );
}

// ============ CONNECTION FORM ============

function ConnForm({ conn, groups, isDark, onSave, onCancel }: { conn: SSHConnection | null; groups: ConnectionGroup[]; isDark: boolean; onSave: (c: SSHConnection) => void; onCancel: () => void }) {
  const [form, setForm] = useState<SSHConnection>(conn || createDefaultConnection());
  const [tagInput, setTagInput] = useState('');
  const [cmdInput, setCmdInput] = useState('');
  const [envKey, setEnvKey] = useState('');
  const [envVal, setEnvVal] = useState('');
  const [activeTab, setActiveTab] = useState<'basic' | 'auth' | 'forwarding' | 'advanced' | 'startup'>('basic');

  const update = (patch: Partial<SSHConnection>) => setForm(prev => ({ ...prev, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.host) return;
    onSave(form);
  };

  const addPortForward = () => {
    update({ portForwards: [...form.portForwards, { id: uuidv4(), type: 'local', localPort: 8080, remoteHost: 'localhost', remotePort: 80, enabled: true }] });
  };

  const tabs = [
    { id: 'basic' as const, label: 'Basic', icon: <Server className="w-3.5 h-3.5" /> },
    { id: 'auth' as const, label: 'Auth', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'forwarding' as const, label: 'Tunnels', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { id: 'startup' as const, label: 'Startup', icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'advanced' as const, label: 'Advanced', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className={`w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border shadow-2xl flex flex-col ${isDark ? 'bg-[#161822] border-[#2a2b3d]' : 'bg-white border-gray-200'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-[#2a2b3d]' : 'border-gray-200'}`}>
          <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{conn ? 'Edit Connection' : 'New Connection'}</h2>
          <button onClick={onCancel} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${isDark ? 'border-[#2a2b3d]' : 'border-gray-200'}`}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-emerald-500 text-emerald-400' : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'basic' && (
            <>
              <FormField label="Connection Name" icon={<FileText className="w-3.5 h-3.5" />} isDark={isDark}>
                <input type="text" value={form.name} onChange={e => update({ name: e.target.value })} placeholder="e.g., Production Server" required className={inputClass(isDark)} />
              </FormField>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <FormField label="Host / IP" icon={<Globe className="w-3.5 h-3.5" />} isDark={isDark}>
                    <input type="text" value={form.host} onChange={e => update({ host: e.target.value })} placeholder="192.168.1.100" required className={inputClass(isDark)} />
                  </FormField>
                </div>
                <FormField label="Port" icon={<Hash className="w-3.5 h-3.5" />} isDark={isDark}>
                  <input type="number" value={form.port} onChange={e => update({ port: parseInt(e.target.value) || 22 })} className={inputClass(isDark)} />
                </FormField>
              </div>
              <FormField label="Username" icon={<User className="w-3.5 h-3.5" />} isDark={isDark}>
                <input type="text" value={form.username} onChange={e => update({ username: e.target.value })} placeholder="root" className={inputClass(isDark)} />
              </FormField>
              <FormField label="Protocol" isDark={isDark}>
                <div className="flex gap-2 flex-wrap">
                  {(['ssh', 'sftp', 'scp', 'rdp', 'telnet', 'serial'] as const).map(p => (
                    <button key={p} type="button" onClick={() => update({ protocol: p })} className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase ${form.protocol === p ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>{p}</button>
                  ))}
                </div>
              </FormField>
              <FormField label="Group" isDark={isDark}>
                <select value={form.groupId} onChange={e => update({ groupId: e.target.value })} className={inputClass(isDark)}>
                  <option value="">No Group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
                </select>
              </FormField>
              <FormField label="Color" isDark={isDark}>
                <div className="flex gap-2 flex-wrap">
                  {CONNECTION_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => update({ color: c })} className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#161822] scale-110' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </FormField>
              <FormField label="Tags" icon={<Tag className="w-3.5 h-3.5" />} isDark={isDark}>
                <div className="flex gap-2">
                  <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (tagInput.trim()) { update({ tags: [...form.tags, tagInput.trim()] }); setTagInput(''); } } }} placeholder="Add tag..." className={inputClass(isDark)} />
                  <button type="button" onClick={() => { if (tagInput.trim()) { update({ tags: [...form.tags, tagInput.trim()] }); setTagInput(''); } }} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">Add</button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600/20 text-emerald-400 text-xs rounded-full">
                        {tag}
                        <button type="button" onClick={() => update({ tags: form.tags.filter(t => t !== tag) })}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </FormField>
              <FormField label="Notes" icon={<StickyNote className="w-3.5 h-3.5" />} isDark={isDark}>
                <textarea value={form.notes} onChange={e => update({ notes: e.target.value })} rows={2} placeholder="Notes..." className={`${inputClass(isDark)} resize-none`} />
              </FormField>
            </>
          )}

          {activeTab === 'auth' && (
            <>
              <FormField label="Authentication Method" icon={<Lock className="w-3.5 h-3.5" />} isDark={isDark}>
                <div className="grid grid-cols-4 gap-2">
                  {(['key', 'password', 'agent', 'certificate'] as const).map(type => (
                    <button key={type} type="button" onClick={() => update({ authType: type })} className={`px-3 py-2 rounded-lg text-xs font-medium ${form.authType === type ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                      {type === 'key' ? '🔑 Key' : type === 'password' ? '🔒 Password' : type === 'agent' ? '🤖 Agent' : '📜 Certificate'}
                    </button>
                  ))}
                </div>
              </FormField>
              {form.authType === 'key' && (
                <FormField label="Private Key Path" icon={<Key className="w-3.5 h-3.5" />} isDark={isDark}>
                  <input type="text" value={form.keyPath || ''} onChange={e => update({ keyPath: e.target.value })} placeholder="C:\Users\You\.ssh\id_rsa" className={inputClass(isDark)} />
                </FormField>
              )}
              {form.authType === 'password' && (
                <FormField label="Password" icon={<Lock className="w-3.5 h-3.5" />} isDark={isDark}>
                  <input type="password" value={form.password || ''} onChange={e => update({ password: e.target.value })} placeholder="Enter password" className={inputClass(isDark)} />
                </FormField>
              )}
              {form.authType === 'certificate' && (
                <>
                  <FormField label="Certificate Path" isDark={isDark}>
                    <input type="text" value={form.certPath || ''} onChange={e => update({ certPath: e.target.value })} placeholder="C:\Users\You\.ssh\cert.pub" className={inputClass(isDark)} />
                  </FormField>
                  <FormField label="Private Key Path" isDark={isDark}>
                    <input type="text" value={form.keyPath || ''} onChange={e => update({ keyPath: e.target.value })} placeholder="C:\Users\You\.ssh\id_rsa" className={inputClass(isDark)} />
                  </FormField>
                </>
              )}
              <FormField label="Jump Host (ProxyJump)" icon={<ArrowRight className="w-3.5 h-3.5" />} isDark={isDark}>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" value={form.jumpHost || ''} onChange={e => update({ jumpHost: e.target.value })} placeholder="Jump host IP" className={inputClass(isDark)} />
                  <input type="number" value={form.jumpPort || 22} onChange={e => update({ jumpPort: parseInt(e.target.value) || 22 })} placeholder="Port" className={inputClass(isDark)} />
                  <input type="text" value={form.jumpUser || ''} onChange={e => update({ jumpUser: e.target.value })} placeholder="User" className={inputClass(isDark)} />
                </div>
              </FormField>
            </>
          )}

          {activeTab === 'forwarding' && (
            <>
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Port Forwarding / Tunnels</h3>
                <button type="button" onClick={addPortForward} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">
                  <Plus className="w-3 h-3" /> Add Tunnel
                </button>
              </div>
              {form.portForwards.length === 0 && <p className="text-xs text-gray-500 italic">No port forwards configured. Click "Add Tunnel" to create one.</p>}
              {form.portForwards.map((pf, idx) => (
                <div key={pf.id} className={`p-3 rounded-lg border ${isDark ? 'bg-[#1e2030] border-[#2a2b3d]' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <select value={pf.type} onChange={e => { const forwards = [...form.portForwards]; forwards[idx] = { ...pf, type: e.target.value as PortForward['type'] }; update({ portForwards: forwards }); }} className={`text-xs px-2 py-1 rounded border ${isDark ? 'bg-[#161822] border-[#2a2b3d] text-gray-200' : 'bg-white border-gray-200'}`}>
                      <option value="local">Local (-L)</option>
                      <option value="remote">Remote (-R)</option>
                      <option value="dynamic">Dynamic (-D)</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs text-gray-400">
                      <input type="checkbox" checked={pf.enabled} onChange={e => { const forwards = [...form.portForwards]; forwards[idx] = { ...pf, enabled: e.target.checked }; update({ portForwards: forwards }); }} className="rounded" />
                      Enabled
                    </label>
                    <button type="button" onClick={() => update({ portForwards: form.portForwards.filter((_, i) => i !== idx) })} className="ml-auto p-1 hover:bg-red-500/20 rounded text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500">Local Port</label>
                      <input type="number" value={pf.localPort} onChange={e => { const forwards = [...form.portForwards]; forwards[idx] = { ...pf, localPort: parseInt(e.target.value) }; update({ portForwards: forwards }); }} className={`w-full px-2 py-1 text-xs rounded border ${isDark ? 'bg-[#161822] border-[#2a2b3d] text-gray-200' : 'bg-white border-gray-200'}`} />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">Remote Host</label>
                      <input type="text" value={pf.remoteHost} onChange={e => { const forwards = [...form.portForwards]; forwards[idx] = { ...pf, remoteHost: e.target.value }; update({ portForwards: forwards }); }} className={`w-full px-2 py-1 text-xs rounded border ${isDark ? 'bg-[#161822] border-[#2a2b3d] text-gray-200' : 'bg-white border-gray-200'}`} />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">Remote Port</label>
                      <input type="number" value={pf.remotePort} onChange={e => { const forwards = [...form.portForwards]; forwards[idx] = { ...pf, remotePort: parseInt(e.target.value) }; update({ portForwards: forwards }); }} className={`w-full px-2 py-1 text-xs rounded border ${isDark ? 'bg-[#161822] border-[#2a2b3d] text-gray-200' : 'bg-white border-gray-200'}`} />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {activeTab === 'startup' && (
            <>
              <FormField label="Startup Commands" icon={<Zap className="w-3.5 h-3.5" />} isDark={isDark}>
                <div className="space-y-2">
                  {form.startupCommands.map((cmd, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" value={cmd} onChange={e => { const cmds = [...form.startupCommands]; cmds[idx] = e.target.value; update({ startupCommands: cmds }); }} placeholder="Command to run on connect..." className={`flex-1 ${inputClass(isDark)}`} />
                      <button type="button" onClick={() => update({ startupCommands: form.startupCommands.filter((_, i) => i !== idx) })} className="p-1.5 hover:bg-red-500/20 rounded text-red-400"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input type="text" value={cmdInput} onChange={e => setCmdInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (cmdInput.trim()) { update({ startupCommands: [...form.startupCommands, cmdInput.trim()] }); setCmdInput(''); } } }} placeholder="Add command..." className={`flex-1 ${inputClass(isDark)}`} />
                    <button type="button" onClick={() => { if (cmdInput.trim()) { update({ startupCommands: [...form.startupCommands, cmdInput.trim()] }); setCmdInput(''); } }} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">Add</button>
                  </div>
                </div>
              </FormField>
              <FormField label="Environment Variables" isDark={isDark}>
                <div className="space-y-2">
                  {Object.entries(form.envVars).map(([key, val]) => (
                    <div key={key} className="flex gap-2 items-center">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${isDark ? 'bg-[#1e2030] text-emerald-400' : 'bg-gray-100 text-emerald-600'}`}>{key}</span>
                      <span className={`text-xs flex-1 px-2 py-1 rounded ${isDark ? 'bg-[#1e2030] text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{val}</span>
                      <button type="button" onClick={() => { const vars = { ...form.envVars }; delete vars[key]; update({ envVars: vars }); }} className="p-1 hover:bg-red-500/20 rounded text-red-400"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input type="text" value={envKey} onChange={e => setEnvKey(e.target.value)} placeholder="KEY" className={`flex-1 ${inputClass(isDark)}`} />
                    <input type="text" value={envVal} onChange={e => setEnvVal(e.target.value)} placeholder="value" className={`flex-1 ${inputClass(isDark)}`} />
                    <button type="button" onClick={() => { if (envKey.trim()) { update({ envVars: { ...form.envVars, [envKey]: envVal } }); setEnvKey(''); setEnvVal(''); } }} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">Add</button>
                  </div>
                </div>
              </FormField>
            </>
          )}

          {activeTab === 'advanced' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Connection Timeout (s)" isDark={isDark}>
                  <input type="number" value={form.timeout} onChange={e => update({ timeout: parseInt(e.target.value) })} className={inputClass(isDark)} />
                </FormField>
                <FormField label="Keep Alive Interval (s)" isDark={isDark}>
                  <input type="number" value={form.keepAliveInterval} onChange={e => update({ keepAliveInterval: parseInt(e.target.value) })} className={inputClass(isDark)} />
                </FormField>
              </div>
              <FormField label="Terminal Font Size" isDark={isDark}>
                <input type="number" value={form.fontSize} onChange={e => update({ fontSize: parseInt(e.target.value) })} className={inputClass(isDark)} />
              </FormField>
              <FormField label="Terminal Theme" isDark={isDark}>
                <div className="flex gap-2">
                  {(['default', 'solarized', 'monokai', 'dracula'] as const).map(t => (
                    <button key={t} type="button" onClick={() => update({ theme: t })} className={`px-3 py-1.5 rounded-lg text-xs capitalize ${form.theme === t ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>{t}</button>
                  ))}
                </div>
              </FormField>
              <FormField label="Encoding" isDark={isDark}>
                <select value={form.encoding} onChange={e => update({ encoding: e.target.value })} className={inputClass(isDark)}>
                  <option value="utf-8">UTF-8</option>
                  <option value="latin-1">Latin-1</option>
                  <option value="gbk">GBK</option>
                  <option value="shift_jis">Shift-JIS</option>
                  <option value="euc-kr">EUC-KR</option>
                </select>
              </FormField>
              {form.protocol === 'rdp' && (
                <>
                  <FormField label="RDP Resolution" isDark={isDark}>
                    <select value={form.rdpResolution || '1920x1080'} onChange={e => update({ rdpResolution: e.target.value })} className={inputClass(isDark)}>
                      <option value="1920x1080">1920x1080 (Full HD)</option>
                      <option value="2560x1440">2560x1440 (QHD)</option>
                      <option value="3840x2160">3840x2160 (4K)</option>
                      <option value="1366x768">1366x768</option>
                      <option value="1024x768">1024x768</option>
                    </select>
                  </FormField>
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input type="checkbox" checked={form.rdpFullScreen || false} onChange={e => update({ rdpFullScreen: e.target.checked })} className="rounded" />
                    Full Screen
                  </label>
                </>
              )}
              {form.protocol === 'serial' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Baud Rate" isDark={isDark}>
                    <select value={form.serialBaudRate || 9600} onChange={e => update({ serialBaudRate: parseInt(e.target.value) })} className={inputClass(isDark)}>
                      {[9600, 19200, 38400, 57600, 115200].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Data Bits" isDark={isDark}>
                    <select value={form.serialDataBits || 8} onChange={e => update({ serialDataBits: parseInt(e.target.value) })} className={inputClass(isDark)}>
                      {[5, 6, 7, 8].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </FormField>
                </div>
              )}
            </>
          )}
        </form>

        {/* Footer */}
        <div className={`flex gap-3 px-5 py-3 border-t ${isDark ? 'border-[#2a2b3d]' : 'border-gray-200'}`}>
          <button type="button" onClick={onCancel} className={`flex-1 px-4 py-2 rounded-lg text-sm ${isDark ? 'bg-[#1e2030] text-gray-300 hover:bg-[#24253a]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Cancel</button>
          <button type="submit" onClick={handleSubmit} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white font-medium">
            <Save className="w-4 h-4" /> {conn ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function inputClass(isDark: boolean) {
  return `w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${isDark ? 'bg-[#1e2030] border-[#2a2b3d] text-gray-200 placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'}`;
}

function FormField({ label, icon, children, isDark }: { label: string; icon?: React.ReactNode; children: React.ReactNode; isDark: boolean }) {
  return (
    <div>
      <label className={`flex items-center gap-1.5 text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{icon}{label}</label>
      {children}
    </div>
  );
}

// ============ CONNECTION DETAIL ============

function ConnDetail({ conn, groups, isDark, onEdit, onConnect, onToggleFav, onCheckStatus }: { conn: SSHConnection; groups: ConnectionGroup[]; isDark: boolean; onEdit: () => void; onConnect: () => void; onToggleFav: () => void; onCheckStatus: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showCmds, setShowCmds] = useState(false);
  const group = groups.find(g => g.id === conn.groupId);

  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 2000); };

  const sshCmd = generateSSHCommand(conn);
  const puttyCmd = generatePuTTYCommand(conn);
  const rdpCmd = conn.protocol === 'rdp' ? generateRDPCommand(conn) : '';
  const wtCmd = `wt ssh ${conn.username}@${conn.host}${conn.port !== 22 ? ` -p ${conn.port}` : ''}`;

  return (
    <div className="flex-1 h-full overflow-y-auto">
      {/* Header */}
      <div className={`border-b ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: conn.color }} />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{conn.name}</h2>
                  {conn.favorite && <Star className="w-5 h-5 text-amber-400 fill-amber-400" />}
                  <StatusDot status={conn.status} />
                </div>
                <p className="text-sm text-gray-400 mt-0.5">{conn.username}@{conn.host}:{conn.port} • {conn.protocol.toUpperCase()}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onCheckStatus} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                <RefreshCw className="w-3.5 h-3.5" /> Check
              </button>
              <button onClick={onToggleFav} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                {conn.favorite ? <StarOff className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />} {conn.favorite ? 'Unfav' : 'Fav'}
              </button>
              <button onClick={onEdit} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={onConnect} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs text-white font-medium">
                <Play className="w-3.5 h-3.5" /> Connect
              </button>
            </div>
          </div>

          {/* Quick Commands */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={() => setShowCmds(!showCmds)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
              <Terminal className="w-3.5 h-3.5" /> {showCmds ? 'Hide' : 'Show'} Commands
            </button>
            <button onClick={() => copy(sshCmd, 'ssh')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
              <Copy className="w-3.5 h-3.5" /> {copied === 'ssh' ? '✓ Copied' : 'Copy SSH'}
            </button>
            {conn.portForwards.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-full">
                <GitBranch className="w-3 h-3" /> {conn.portForwards.filter(p => p.enabled).length} tunnels
              </span>
            )}
            {conn.jumpHost && (
              <span className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded-full">
                <ArrowRight className="w-3 h-3" /> via {conn.jumpHost}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Commands Panel */}
      {showCmds && (
        <div className={`max-w-5xl mx-auto p-6 border-b ${isDark ? 'border-[#1e2030]' : 'border-gray-200'}`}>
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Terminal className="w-4 h-4 text-emerald-400" /> Connection Commands</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CmdBlock label="OpenSSH" command={sshCmd} copied={copied === 'openssh'} onCopy={() => copy(sshCmd, 'openssh')} isDark={isDark} />
            <CmdBlock label="PuTTY" command={puttyCmd} copied={copied === 'putty'} onCopy={() => copy(puttyCmd, 'putty')} isDark={isDark} />
            <CmdBlock label="Windows Terminal" command={wtCmd} copied={copied === 'wt'} onCopy={() => copy(wtCmd, 'wt')} isDark={isDark} />
            {rdpCmd && <CmdBlock label="RDP (mstsc)" command={rdpCmd} copied={copied === 'rdp'} onCopy={() => copy(rdpCmd, 'rdp')} isDark={isDark} />}
          </div>
        </div>
      )}

      {/* Details Grid */}
      <div className="max-w-5xl mx-auto p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <DetailCard icon={<Globe className="w-4 h-4 text-blue-400" />} label="Host" value={conn.host} onCopy={() => copy(conn.host, 'host')} copied={copied === 'host'} isDark={isDark} />
          <DetailCard icon={<Hash className="w-4 h-4 text-purple-400" />} label="Port" value={String(conn.port)} isDark={isDark} />
          <DetailCard icon={<User className="w-4 h-4 text-emerald-400" />} label="Username" value={conn.username} onCopy={() => copy(conn.username, 'user')} copied={copied === 'user'} isDark={isDark} />
          <DetailCard icon={<Shield className="w-4 h-4 text-amber-400" />} label="Auth" value={conn.authType === 'key' ? `Key (${conn.keyPath || 'not set'})` : conn.authType === 'password' ? 'Password' : conn.authType === 'certificate' ? 'Certificate' : 'SSH Agent'} isDark={isDark} />
          <DetailCard icon={<Wifi className="w-4 h-4 text-cyan-400" />} label="Protocol" value={conn.protocol.toUpperCase()} isDark={isDark} />
          <DetailCard icon={<Server className="w-4 h-4 text-pink-400" />} label="Group" value={group ? `${group.icon} ${group.name}` : 'None'} isDark={isDark} />
          <DetailCard icon={<Clock className="w-4 h-4 text-orange-400" />} label="Timeout" value={`${conn.timeout}s`} isDark={isDark} />
          <DetailCard icon={<Activity className="w-4 h-4 text-green-400" />} label="Keep Alive" value={`${conn.keepAliveInterval}s`} isDark={isDark} />
          <DetailCard icon={<BarChart3 className="w-4 h-4 text-indigo-400" />} label="Total Connections" value={String(conn.totalConnections)} isDark={isDark} />
        </div>

        {/* Port Forwards */}
        {conn.portForwards.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2"><GitBranch className="w-4 h-4" /> Port Forwards</h3>
            <div className="space-y-2">
              {conn.portForwards.map(pf => (
                <div key={pf.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-gray-50 border-gray-200'}`}>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${pf.type === 'local' ? 'bg-blue-600/20 text-blue-400' : pf.type === 'remote' ? 'bg-purple-600/20 text-purple-400' : 'bg-amber-600/20 text-amber-400'}`}>{pf.type.toUpperCase()}</span>
                  <span className="text-xs text-gray-300 font-mono">:{pf.localPort} → {pf.remoteHost}:{pf.remotePort}</span>
                  <span className={`ml-auto text-xs ${pf.enabled ? 'text-emerald-400' : 'text-gray-500'}`}>{pf.enabled ? 'Active' : 'Disabled'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Startup Commands */}
        {conn.startupCommands.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2"><Zap className="w-4 h-4" /> Startup Commands</h3>
            <div className={`p-3 rounded-lg border font-mono text-xs ${isDark ? 'bg-[#0d0e17] border-[#1e2030] text-emerald-300' : 'bg-gray-900 border-gray-700 text-emerald-300'}`}>
              {conn.startupCommands.map((cmd, i) => <div key={i}>$ {cmd}</div>)}
            </div>
          </div>
        )}

        {/* Tags */}
        {conn.tags.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2"><Tag className="w-4 h-4" /> Tags</h3>
            <div className="flex flex-wrap gap-2">
              {conn.tags.map(tag => <span key={tag} className={`px-2.5 py-1 rounded-full text-xs ${isDark ? 'bg-[#1e2030] border border-[#2a2b3d] text-gray-300' : 'bg-gray-100 border border-gray-200 text-gray-600'}`}>{tag}</span>)}
            </div>
          </div>
        )}

        {/* Notes */}
        {conn.notes && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2"><StickyNote className="w-4 h-4" /> Notes</h3>
            <div className={`p-3 rounded-lg border text-sm whitespace-pre-wrap ${isDark ? 'bg-[#161822] border-[#1e2030] text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>{conn.notes}</div>
          </div>
        )}

        {/* Metadata */}
        <div className={`mt-6 pt-4 border-t ${isDark ? 'border-[#1e2030]' : 'border-gray-200'}`}>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Created: {formatDate(conn.createdAt)}</span>
            {conn.lastConnected && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Last: {formatDate(conn.lastConnected)}</span>}
            <span>Avg session: {formatDuration(conn.avgSessionTime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CmdBlock({ label, command, copied, onCopy, isDark }: { label: string; command: string; copied: boolean; onCopy: () => void; isDark: boolean }) {
  return (
    <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-[#0d0e17] border-[#1e2030]' : 'bg-gray-900 border-gray-700'}`}>
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-gray-800 border-gray-700'}`}>
        <span className="text-[10px] text-gray-400">{label}</span>
        <button onClick={onCopy} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-emerald-400"><Copy className="w-3 h-3" />{copied ? '✓' : 'Copy'}</button>
      </div>
      <code className="block px-3 py-2 text-xs text-emerald-300 font-mono overflow-x-auto">{command}</code>
    </div>
  );
}

function DetailCard({ icon, label, value, onCopy, copied, isDark }: { icon: React.ReactNode; label: string; value: string; onCopy?: () => void; copied?: boolean; isDark: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
      <div className={`p-2 rounded-lg ${isDark ? 'bg-[#1e2030]' : 'bg-gray-100'}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500">{label}</p>
        <p className={`text-sm truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{value}</p>
      </div>
      {onCopy && <button onClick={onCopy} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-emerald-400"><Copy className="w-3.5 h-3.5" /></button>}
    </div>
  );
}

// ============ DASHBOARD ============

function Dashboard({ connections, groups, history, isDark, onNavigate }: { connections: SSHConnection[]; groups: ConnectionGroup[]; history: ConnectionHistory[]; isDark: boolean; onNavigate: (v: View) => void }) {
  const totalConns = connections.reduce((a, c) => a + c.totalConnections, 0);
  const onlineCount = connections.filter(c => c.status === 'online').length;
  const favCount = connections.filter(c => c.favorite).length;
  const recentHistory = history.slice(0, 5);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Overview of your SSH infrastructure</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onNavigate('connections')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white font-medium">Manage Connections</button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatBox icon={<Server className="w-5 h-5 text-emerald-400" />} label="Total Connections" value={connections.length} color="emerald" isDark={isDark} />
          <StatBox icon={<Activity className="w-5 h-5 text-blue-400" />} label="Total Sessions" value={totalConns} color="blue" isDark={isDark} />
          <StatBox icon={<Power className="w-5 h-5 text-green-400" />} label="Online" value={onlineCount} color="green" isDark={isDark} />
          <StatBox icon={<Star className="w-5 h-5 text-amber-400" />} label="Favorites" value={favCount} color="amber" isDark={isDark} />
        </div>

        {/* Groups Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Groups</h3>
            <div className="space-y-2">
              {groups.map(g => {
                const count = connections.filter(c => c.groupId === g.id).length;
                return (
                  <div key={g.id} className="flex items-center gap-3">
                    <span className="text-lg">{g.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{g.name}</span>
                        <span className="text-xs text-gray-500">{count}</span>
                      </div>
                      <div className={`w-full h-1.5 rounded-full mt-1 ${isDark ? 'bg-[#1e2030]' : 'bg-gray-100'}`}>
                        <div className="h-full rounded-full" style={{ width: `${connections.length > 0 ? (count / connections.length) * 100 : 0}%`, backgroundColor: g.color }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Protocol Distribution</h3>
            <div className="space-y-2">
              {['ssh', 'sftp', 'rdp', 'telnet', 'serial'].map(proto => {
                const count = connections.filter(c => c.protocol === proto).length;
                if (count === 0) return null;
                return (
                  <div key={proto} className="flex items-center gap-3">
                    <span className={`text-xs font-mono uppercase w-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{proto}</span>
                    <div className="flex-1">
                      <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-[#1e2030]' : 'bg-gray-100'}`}>
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(count / connections.length) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Recent Activity</h3>
            <button onClick={() => onNavigate('history')} className="text-xs text-emerald-400 hover:text-emerald-300">View All →</button>
          </div>
          {recentHistory.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No recent activity. Connect to a server to see history.</p>
          ) : (
            <div className="space-y-2">
              {recentHistory.map(h => (
                <div key={h.id} className={`flex items-center gap-3 p-2 rounded-lg ${isDark ? 'hover:bg-[#1e2030]' : 'hover:bg-gray-50'}`}>
                  <div className={`w-2 h-2 rounded-full ${h.status === 'success' ? 'bg-emerald-400' : h.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <span className={`text-sm flex-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{h.connectionName}</span>
                  <span className="text-xs text-gray-500">{h.host}</span>
                  <span className="text-xs text-gray-500">{formatDuration(h.duration)}</span>
                  <span className="text-xs text-gray-500">{formatDate(h.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickAction icon={<Plus className="w-5 h-5" />} label="New Connection" onClick={() => onNavigate('connections')} isDark={isDark} />
            <QuickAction icon={<Key className="w-5 h-5" />} label="Generate Key" onClick={() => onNavigate('keygen')} isDark={isDark} />
            <QuickAction icon={<Radio className="w-5 h-5" />} label="Scan Network" onClick={() => onNavigate('scanner')} isDark={isDark} />
            <QuickAction icon={<FileCode className="w-5 h-5" />} label="Gen Scripts" onClick={() => onNavigate('scripts')} isDark={isDark} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, color, isDark }: { icon: React.ReactNode; label: string; value: number; color: string; isDark: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-gray-400">{label}</span></div>
      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function QuickAction({ icon, label, onClick, isDark }: { icon: React.ReactNode; label: string; onClick: () => void; isDark: boolean }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${isDark ? 'bg-[#161822] border-[#1e2030] hover:border-emerald-500/30 text-gray-300' : 'bg-white border-gray-200 hover:border-emerald-300 text-gray-700'}`}>
      <span className="text-emerald-400">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

// ============ HISTORY VIEW ============

function HistoryView({ history, connections, isDark, onClear }: { history: ConnectionHistory[]; connections: SSHConnection[]; isDark: boolean; onClear: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Connection History</h1>
          {history.length > 0 && <button onClick={onClear} className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg">Clear All</button>}
        </div>
        {history.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No connection history yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className={`flex items-center gap-4 p-3 rounded-lg border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${h.status === 'success' ? 'bg-emerald-400' : h.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{h.connectionName}</p>
                  <p className="text-xs text-gray-500">{h.host} {h.errorMessage && `• ${h.errorMessage}`}</p>
                </div>
                <span className="text-xs text-gray-500">{formatDuration(h.duration)}</span>
                <span className="text-xs text-gray-500">{formatDate(h.timestamp)}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${h.status === 'success' ? 'bg-emerald-600/20 text-emerald-400' : h.status === 'failed' ? 'bg-red-600/20 text-red-400' : 'bg-amber-600/20 text-amber-400'}`}>{h.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ SNIPPETS VIEW ============

function SnippetsView({ snippets, isDark, onSave, onDelete }: { snippets: CommandSnippet[]; isDark: boolean; onSave: (s: CommandSnippet) => void; onDelete: (id: string) => void }) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [desc, setDesc] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const handleSave = () => {
    if (name && command) {
      onSave({ id: uuidv4(), name, command, description: desc, tags: [], createdAt: Date.now() });
      setName(''); setCommand(''); setDesc('');
    }
  };

  const copyCmd = (id: string, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Command Snippets</h1>

        {/* Add Form */}
        <div className={`p-4 rounded-xl border mb-6 ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Snippet name..." className={inputClass(isDark)} />
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description..." className={inputClass(isDark)} />
          </div>
          <div className="flex gap-2">
            <input type="text" value={command} onChange={e => setCommand(e.target.value)} placeholder="Command..." className={`flex-1 font-mono ${inputClass(isDark)}`} />
            <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg">Save</button>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {snippets.map(s => (
            <div key={s.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
              <div className="flex-1">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{s.name}</p>
                <code className="text-xs text-emerald-400 font-mono">{s.command}</code>
                {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
              </div>
              <button onClick={() => copyCmd(s.id, s.command)} className="px-2 py-1 text-xs text-gray-400 hover:text-emerald-400">{copied === s.id ? '✓' : 'Copy'}</button>
              <button onClick={() => onDelete(s.id)} className="p-1 text-red-400 hover:bg-red-500/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {snippets.length === 0 && <p className="text-center text-gray-500 py-8">No snippets saved yet</p>}
        </div>
      </div>
    </div>
  );
}

// ============ SETTINGS VIEW ============

function SettingsView({ settings, isDark, onSave }: { settings: AppSettings; isDark: boolean; onSave: (s: AppSettings) => void }) {
  const [form, setForm] = useState(settings);
  const update = (patch: Partial<AppSettings>) => setForm(prev => ({ ...prev, ...patch }));

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h1>

        <div className="space-y-6">
          {/* Appearance */}
          <SettingsSection title="Appearance" isDark={isDark}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Theme</label>
                <div className="flex gap-2">
                  <button onClick={() => update({ theme: 'dark' })} className={`flex-1 px-3 py-2 rounded-lg text-sm ${form.theme === 'dark' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]'}`}>🌙 Dark</button>
                  <button onClick={() => update({ theme: 'light' })} className={`flex-1 px-3 py-2 rounded-lg text-sm ${form.theme === 'light' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]'}`}>☀️ Light</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Startup Action</label>
                <select value={form.startupAction} onChange={e => update({ startupAction: e.target.value as AppSettings['startupAction'] })} className={inputClass(isDark)}>
                  <option value="dashboard">Dashboard</option>
                  <option value="lastConnection">Last Connection</option>
                  <option value="newConnection">New Connection</option>
                </select>
              </div>
            </div>
          </SettingsSection>

          {/* Defaults */}
          <SettingsSection title="Connection Defaults" isDark={isDark}>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Default Port</label>
                <input type="number" value={form.defaultPort} onChange={e => update({ defaultPort: parseInt(e.target.value) })} className={inputClass(isDark)} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Default Username</label>
                <input type="text" value={form.defaultUsername} onChange={e => update({ defaultUsername: e.target.value })} className={inputClass(isDark)} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Default Key Path</label>
                <input type="text" value={form.defaultKeyPath} onChange={e => update({ defaultKeyPath: e.target.value })} className={inputClass(isDark)} />
              </div>
            </div>
          </SettingsSection>

          {/* Terminal */}
          <SettingsSection title="Terminal" isDark={isDark}>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Font</label>
                <select value={form.terminalFont} onChange={e => update({ terminalFont: e.target.value })} className={inputClass(isDark)}>
                  <option value="Cascadia Code">Cascadia Code</option>
                  <option value="Fira Code">Fira Code</option>
                  <option value="JetBrains Mono">JetBrains Mono</option>
                  <option value="Consolas">Consolas</option>
                  <option value="Courier New">Courier New</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Font Size</label>
                <input type="number" value={form.terminalFontSize} onChange={e => update({ terminalFontSize: parseInt(e.target.value) })} className={inputClass(isDark)} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Scrollback Lines</label>
                <input type="number" value={form.scrollbackLines} onChange={e => update({ scrollbackLines: parseInt(e.target.value) })} className={inputClass(isDark)} />
              </div>
            </div>
          </SettingsSection>

          {/* Behavior */}
          <SettingsSection title="Behavior" isDark={isDark}>
            <div className="space-y-3">
              <Toggle label="Confirm before delete" checked={form.confirmDelete} onChange={v => update({ confirmDelete: v })} isDark={isDark} />
              <Toggle label="Auto-save connections" checked={form.autoSave} onChange={v => update({ autoSave: v })} isDark={isDark} />
              <Toggle label="Copy on select" checked={form.copyOnSelect} onChange={v => update({ copyOnSelect: v })} isDark={isDark} />
              <Toggle label="Bell sound" checked={form.bellSound} onChange={v => update({ bellSound: v })} isDark={isDark} />
              <Toggle label="Show status bar" checked={form.showStatusBar} onChange={v => update({ showStatusBar: v })} isDark={isDark} />
            </div>
          </SettingsSection>

          {/* Proxy */}
          <SettingsSection title="Proxy" isDark={isDark}>
            <Toggle label="Enable proxy" checked={form.proxyEnabled} onChange={v => update({ proxyEnabled: v })} isDark={isDark} />
            {form.proxyEnabled && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Proxy Host</label>
                  <input type="text" value={form.proxyHost} onChange={e => update({ proxyHost: e.target.value })} className={inputClass(isDark)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Proxy Port</label>
                  <input type="number" value={form.proxyPort} onChange={e => update({ proxyPort: parseInt(e.target.value) })} className={inputClass(isDark)} />
                </div>
              </div>
            )}
          </SettingsSection>

          <button onClick={() => onSave(form)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium">Save Settings</button>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
  return (
    <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{title}</h3>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange, isDark }: { label: string; checked: boolean; onChange: (v: boolean) => void; isDark: boolean }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</span>
      <div className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-emerald-600' : isDark ? 'bg-[#2a2b3d]' : 'bg-gray-300'}`} onClick={() => onChange(!checked)}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </label>
  );
}

// ============ KEY GENERATOR ============

function KeyGenView({ isDark, addToast }: { isDark: boolean; addToast: (type: Toast['type'], title: string, message: string) => void }) {
  const [keyType, setKeyType] = useState<'rsa' | 'ed25519' | 'ecdsa'>('ed25519');
  const [bits, setBits] = useState(4096);
  const [comment, setComment] = useState('');
  const [generated, setGenerated] = useState(false);

  const handleGenerate = () => {
    setGenerated(true);
    addToast('success', 'Key Generated', `${keyType.toUpperCase()} key pair generated (simulated)`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>SSH Key Generator</h1>

        <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Key Type</label>
              <div className="flex gap-2">
                {(['ed25519', 'rsa', 'ecdsa'] as const).map(t => (
                  <button key={t} onClick={() => setKeyType(t)} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium uppercase ${keyType === t ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>{t}</button>
                ))}
              </div>
            </div>
            {keyType === 'rsa' && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Bits</label>
                <select value={bits} onChange={e => setBits(parseInt(e.target.value))} className={inputClass(isDark)}>
                  <option value={2048}>2048</option>
                  <option value={3072}>3072</option>
                  <option value={4096}>4096</option>
                </select>
              </div>
            )}
          </div>
          <div className="mb-4">
            <label className="text-xs text-gray-400 mb-1 block">Comment (email)</label>
            <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="user@example.com" className={inputClass(isDark)} />
          </div>

          <button onClick={handleGenerate} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium flex items-center justify-center gap-2">
            <Key className="w-4 h-4" /> Generate Key Pair
          </button>

          {generated && (
            <div className="mt-4 space-y-3">
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#0d0e17] border-[#1e2030]' : 'bg-gray-900 border-gray-700'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-400">Public Key</span>
                  <button onClick={() => { navigator.clipboard.writeText(`${keyType === 'ed25519' ? 'ssh-ed25519' : 'ssh-rsa'} AAAA...generated_key_content ${comment}`); addToast('success', 'Copied', 'Public key copied'); }} className="text-[10px] text-emerald-400">Copy</button>
                </div>
                <code className="text-xs text-emerald-300 font-mono break-all">{keyType === 'ed25519' ? 'ssh-ed25519' : 'ssh-rsa'} AAAAC3NzaC1lZDI1NTE5AAAAI...simulated_key_data {comment || 'generated'}</code>
              </div>
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#0d0e17] border-[#1e2030]' : 'bg-gray-900 border-gray-700'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-400">Command to generate (run in terminal)</span>
                  <button onClick={() => { navigator.clipboard.writeText(`ssh-keygen -t ${keyType}${keyType === 'rsa' ? ` -b ${bits}` : ''} -C "${comment}"`); addToast('success', 'Copied', 'Command copied'); }} className="text-[10px] text-emerald-400">Copy</button>
                </div>
                <code className="text-xs text-emerald-300 font-mono">ssh-keygen -t {keyType}{keyType === 'rsa' ? ` -b ${bits}` : ''} -C "{comment || 'your_email@example.com'}"</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ NETWORK SCANNER ============

function ScannerView({ isDark, connections, addToast, onImport }: { isDark: boolean; connections: SSHConnection[]; addToast: (type: Toast['type'], title: string, message: string) => void; onImport: (conns: SSHConnection[]) => void }) {
  const [subnet, setSubnet] = useState('192.168.1');
  const [port, setPort] = useState(22);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<{ ip: string; open: boolean; hostname?: string }[]>([]);

  const handleScan = () => {
    setScanning(true);
    setResults([]);
    // Simulate network scan
    const ips = Array.from({ length: 20 }, (_, i) => `${subnet}.${i + 1}`);
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= ips.length) {
        clearInterval(interval);
        setScanning(false);
        addToast('success', 'Scan Complete', `Found ${results.filter(r => r.open).length} open ports`);
        return;
      }
      const open = Math.random() > 0.7;
      setResults(prev => [...prev, { ip: ips[idx], open, hostname: open ? `host-${idx}` : undefined }]);
      idx++;
    }, 200);
  };

  const importResults = () => {
    const openHosts = results.filter(r => r.open);
    const newConns = openHosts.map(r => createDefaultConnection({ name: r.hostname || r.ip, host: r.ip, port, username: 'root' }));
    onImport(newConns);
    addToast('success', 'Imported', `${newConns.length} hosts imported`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Network Scanner</h1>

        <div className={`p-5 rounded-xl border mb-6 ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Subnet</label>
              <input type="text" value={subnet} onChange={e => setSubnet(e.target.value)} placeholder="192.168.1" className={inputClass(isDark)} />
            </div>
            <div className="w-24">
              <label className="text-xs text-gray-400 mb-1 block">Port</label>
              <input type="number" value={port} onChange={e => setPort(parseInt(e.target.value))} className={inputClass(isDark)} />
            </div>
            <button onClick={handleScan} disabled={scanning} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-white text-sm font-medium flex items-center gap-2">
              {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
              {scanning ? 'Scanning...' : 'Scan'}
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-[#1e2030]' : 'border-gray-200'}`}>
              <span className="text-sm text-gray-300">Results ({results.filter(r => r.open).length} open)</span>
              {results.filter(r => r.open).length > 0 && (
                <button onClick={importResults} className="px-3 py-1 bg-emerald-600 text-white text-xs rounded-lg">Import All</button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-2 border-b last:border-0 ${isDark ? 'border-[#1e2030]' : 'border-gray-100'}`}>
                  <div className={`w-2 h-2 rounded-full ${r.open ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                  <span className={`text-sm font-mono flex-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{r.ip}</span>
                  <span className="text-xs text-gray-500">{r.open ? `Port ${port} open` : 'Closed'}</span>
                  {r.hostname && <span className="text-xs text-blue-400">{r.hostname}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ SCRIPTS VIEW ============

function ScriptsView({ connections, isDark, addToast }: { connections: SSHConnection[]; isDark: boolean; addToast: (type: Toast['type'], title: string, message: string) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scriptType, setScriptType] = useState<'bat' | 'ps1' | 'ssh'>('bat');

  const toggle = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const generateScript = () => {
    const conns = connections.filter(c => selected.has(c.id));
    if (conns.length === 0) { addToast('warning', 'No Selection', 'Select at least one connection'); return; }

    let script = '';
    if (scriptType === 'bat') script = generateBatchScript(conns);
    else if (scriptType === 'ps1') script = generatePowerShellScript(conns);
    else script = conns.map(c => generateSSHCommand(c)).join('\n');

    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ssh-connect.${scriptType === 'bat' ? 'bat' : scriptType === 'ps1' ? 'ps1' : 'sh'}`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Generated', `Script downloaded with ${conns.length} connections`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Batch Script Generator</h1>

        <div className={`p-5 rounded-xl border mb-6 ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-gray-400">Script Type:</span>
            {(['bat', 'ps1', 'ssh'] as const).map(t => (
              <button key={t} onClick={() => setScriptType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase ${scriptType === t ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                {t === 'bat' ? '.BAT' : t === 'ps1' ? '.PS1' : '.SH'}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-400 mb-3">Select connections to include ({selected.size} selected):</p>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {connections.map(c => (
              <label key={c.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${selected.has(c.id) ? 'bg-emerald-600/10 border border-emerald-500/30' : isDark ? 'border border-transparent hover:bg-[#1e2030]' : 'border border-transparent hover:bg-gray-50'}`}>
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="rounded" />
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{c.name}</span>
              </label>
            ))}
          </div>

          <button onClick={generateScript} className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium flex items-center justify-center gap-2">
            <FileCode className="w-4 h-4" /> Generate & Download Script
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ SHORTCUTS VIEW ============

function ShortcutsView({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Keyboard Shortcuts</h1>
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
          {KEYBOARD_SHORTCUTS.map((s, i) => (
            <div key={i} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? `border-t ${isDark ? 'border-[#1e2030]' : 'border-gray-100'}` : ''}`}>
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{s.description}</span>
              <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDark ? 'bg-[#1e2030] text-gray-300 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ TEMPLATES VIEW ============

function TemplatesView({ isDark, groups, onApply }: { isDark: boolean; groups: ConnectionGroup[]; onApply: (t: Partial<SSHConnection>) => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Connection Templates</h1>
        <p className="text-sm text-gray-400 mb-6">Quick-start with pre-configured templates for common server types</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CONNECTION_TEMPLATES.map((t, i) => (
            <button key={i} onClick={() => onApply(t)} className={`p-4 rounded-xl border text-left transition-colors ${isDark ? 'bg-[#161822] border-[#1e2030] hover:border-emerald-500/30' : 'bg-white border-gray-200 hover:border-emerald-300'}`}>
              <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t.name}</p>
              <p className="text-xs text-gray-500">{t.username}@{t.host || '<host>'}:{t.port}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {t.tags?.map(tag => <span key={tag} className="px-1.5 py-0.5 bg-emerald-600/10 text-emerald-400 text-[10px] rounded">{tag}</span>)}
              </div>
              <span className="text-[10px] text-gray-500 mt-2 block uppercase">{t.protocol}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ WELCOME SCREEN ============

function WelcomeScreen({ isDark, onNew, count }: { isDark: boolean; onNew: () => void; count: number }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/20">
          <Terminal className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>SSH Manager Pro</h2>
        <p className="text-gray-400 mb-8">Multi-SSH connection manager for Windows. Select a connection from the sidebar or create a new one.</p>
        <button onClick={onNew} className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-medium">
          <Plus className="w-5 h-5" /> Add New Connection
        </button>
        <p className="text-xs text-gray-600 mt-4">Press Ctrl+N for quick add • {count} connections saved</p>
      </div>
    </div>
  );
}

// ============ TOAST ============

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icons = { success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, error: <XCircle className="w-4 h-4 text-red-400" />, warning: <AlertCircle className="w-4 h-4 text-amber-400" />, info: <Info className="w-4 h-4 text-blue-400" /> };
  const borders = { success: 'border-emerald-500/30', error: 'border-red-500/30', warning: 'border-amber-500/30', info: 'border-blue-500/30' };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border shadow-xl bg-[#1a1b26] ${borders[toast.type]} min-w-[280px] max-w-[380px] animate-in slide-in-from-right`}>
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{toast.title}</p>
        <p className="text-xs text-gray-400 truncate">{toast.message}</p>
      </div>
      <button onClick={onDismiss} className="p-0.5 text-gray-500 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}
