import { useState, useEffect, useRef } from 'react';
import { SSHConnection, ConnectionGroup, CommandSnippet, ConnectionHistory, AppSettings, Toast, FileTransfer, DeployKey, GitHubRepo, DEFAULT_SETTINGS, CONNECTION_COLORS, GROUP_ICONS, CONNECTION_TEMPLATES, KEYBOARD_SHORTCUTS, PortForward } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useToast } from './hooks/useToast';
import { createDefaultConnection, generateSSHCommand, generatePuTTYCommand, generateRDPCommand, generateBatchScript, generatePowerShellScript, generateSCPCommand, generateRsyncCommand, generateZmodemCommand, parseSSHConfig, formatDuration, formatDate, formatFileSize, createHistoryEntry, generateGitHubSSHKeyCommand, generateGitHubAddKeyCommand, generateGitHubTestCommand } from './utils';
import { v4 as uuidv4 } from 'uuid';
import {
  Terminal, Server, Plus, Search, ChevronDown, ChevronRight, Trash2, Edit3, Copy,
  Download, Upload, Play, Globe, User, Key, Lock, Hash, FileText, Tag, StickyNote,
  Shield, Wifi, Clock, Star, StarOff, Settings, BarChart3, History, Zap, Monitor,
  FolderPlus, X, Save, Network, Radio, Code2, FileCode, Layers, ArrowRight,
  CheckCircle2, XCircle, AlertCircle, Info, RefreshCw, ExternalLink, Eye, EyeOff,
  Keyboard, HelpCircle, Cpu, HardDrive, Activity, Power, GitBranch, Box,
  PanelLeftClose, PanelLeftOpen, MoreVertical, FileUp, FileDown, FolderOpen,
  Github, BookOpen, BookMarked, GitPullRequest, GitCommit, GitMerge,
  Send, ArrowUpDown, FolderSync, Package, AlertTriangle, Link2,
  Book, FileQuestion, Lightbulb, Wrench, Database, Cloud, Lock as LockIcon,
  Users, Tag as GitTag, ShieldCheck, Fingerprint, KeyRound
} from 'lucide-react';

type View = 'dashboard' | 'connections' | 'history' | 'snippets' | 'settings' | 'keygen' | 'scanner' | 'scripts' | 'shortcuts' | 'templates' | 'fileTransfer' | 'github' | 'docs';

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
  const [transfers, setTransfers] = useLocalStorage<FileTransfer[]>('ssh-transfers', []);
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

  useEffect(() => {
    if (connections.length === 0) {
      const samples: SSHConnection[] = [
        createDefaultConnection({ name: 'Web Server (Prod)', host: '10.0.1.50', username: 'deploy', authType: 'key', keyPath: 'C:\\Users\\admin\\.ssh\\prod_key', color: '#ef4444', tags: ['production', 'web'], notes: 'Main production web server', groupId: 'prod', totalConnections: 45, avgSessionTime: 1800000, githubEnabled: true, githubRepos: ['myorg/webapp', 'myorg/api'] }),
        createDefaultConnection({ name: 'Database Server', host: '10.0.1.51', username: 'dbadmin', authType: 'key', keyPath: 'C:\\Users\\admin\\.ssh\\prod_key', color: '#ef4444', tags: ['production', 'database'], notes: 'PostgreSQL 15 primary', groupId: 'prod', totalConnections: 32, avgSessionTime: 2400000 }),
        createDefaultConnection({ name: 'Staging API', host: 'staging-api.example.com', port: 2222, username: 'developer', authType: 'password', color: '#f59e0b', tags: ['staging', 'api'], groupId: 'staging', totalConnections: 18, avgSessionTime: 900000 }),
        createDefaultConnection({ name: 'Dev VM (Local)', host: '192.168.56.10', username: 'vagrant', authType: 'key', keyPath: 'C:\\Users\\admin\\.vagrant.d\\insecure_private_key', color: '#10b981', tags: ['development', 'vagrant'], groupId: 'dev', totalConnections: 156, avgSessionTime: 3600000, favorite: true, zmodemEnabled: true }),
        createDefaultConnection({ name: 'CI/CD Runner', host: 'ci.internal.company.com', username: 'gitlab-runner', authType: 'agent', color: '#8b5cf6', tags: ['ci', 'gitlab'], totalConnections: 8, avgSessionTime: 600000 }),
        createDefaultConnection({ name: 'Windows RDP Server', host: '10.0.2.100', port: 3389, username: 'Administrator', authType: 'password', color: '#3b82f6', tags: ['windows', 'rdp'], protocol: 'rdp', groupId: 'prod' }),
      ];
      setConnections(samples);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); setEditingConn(null); setShowForm(true); }
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.ctrlKey && e.key === 'e' && selectedConn) { e.preventDefault(); setEditingConn(selectedConn); setShowForm(true); }
      if (e.ctrlKey && e.key === 'd' && selectedConn) { e.preventDefault(); handleDuplicate(selectedConn.id); }
      if (e.ctrlKey && e.key === 't') { e.preventDefault(); setCurrentView('fileTransfer'); }
      if (e.ctrlKey && e.key === 'g') { e.preventDefault(); setCurrentView('github'); }
      if (e.ctrlKey && e.key === 'h') { e.preventDefault(); setCurrentView('docs'); }
      if (e.key === 'Escape') { setShowForm(false); setEditingConn(null); }
      if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); setCurrentView('dashboard'); }
      if (e.ctrlKey && e.key === ',') { e.preventDefault(); setCurrentView('settings'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedConn]);

  const handleSaveConn = (conn: SSHConnection) => {
    setConnections(prev => {
      const exists = prev.find(c => c.id === conn.id);
      if (exists) return prev.map(c => c.id === conn.id ? conn : c);
      return [...prev, conn];
    });
    setShowForm(false); setEditingConn(null); setSelectedId(conn.id);
    addToast('success', 'Saved', `Connection "${conn.name}" saved`);
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
    selectedIds.forEach(id => { const conn = connections.find(c => c.id === id); if (conn) handleQuickConnect(conn); });
    addToast('success', 'Batch Connect', `Launched ${selectedIds.size} connections`);
    setBatchMode(false); setSelectedIds(new Set());
  };

  const handleBatchDelete = () => {
    if (!confirm(`Delete ${selectedIds.size} connections?`)) return;
    setConnections(prev => prev.filter(c => !selectedIds.has(c.id)));
    setSelectedIds(new Set()); setBatchMode(false);
    addToast('info', 'Batch Delete', `${selectedIds.size} connections removed`);
  };

  const handleToggleFavorite = (id: string) => { setConnections(prev => prev.map(c => c.id === id ? { ...c, favorite: !c.favorite } : c)); };
  const handleCheckStatus = (id: string) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'unknown' } : c));
    setTimeout(() => {
      const online = Math.random() > 0.3;
      setConnections(prev => prev.map(c => c.id === id ? { ...c, status: online ? 'online' : 'offline' } : c));
      addToast(online ? 'success' : 'error', 'Status', online ? 'Host is reachable' : 'Host is unreachable');
    }, 1500);
  };

  const handleExport = () => {
    const data = JSON.stringify({ connections, groups, snippets, settings }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ssh-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
    addToast('success', 'Exported', 'Backup file downloaded');
  };

  const handleImport = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
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
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.config,.*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const parsed = parseSSHConfig(ev.target?.result as string);
          const newConns = parsed.map(p => createDefaultConnection(p));
          setConnections(prev => [...prev, ...newConns]);
          addToast('success', 'SSH Config', `${newConns.length} hosts imported`);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
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
      <nav className={`w-14 flex flex-col items-center py-3 gap-0.5 border-r ${isDark ? 'bg-[#13141f] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
        <NavBtn icon={<Terminal className="w-5 h-5" />} label="SSH Manager" disabled />
        <Divider isDark={isDark} />
        <NavBtn icon={<BarChart3 className="w-4 h-4" />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
        <NavBtn icon={<Server className="w-4 h-4" />} label="Connections" active={currentView === 'connections'} onClick={() => setCurrentView('connections')} />
        <NavBtn icon={<ArrowUpDown className="w-4 h-4" />} label="File Transfer" active={currentView === 'fileTransfer'} onClick={() => setCurrentView('fileTransfer')} />
        <NavBtn icon={<Github className="w-4 h-4" />} label="GitHub" active={currentView === 'github'} onClick={() => setCurrentView('github')} />
        <NavBtn icon={<History className="w-4 h-4" />} label="History" active={currentView === 'history'} onClick={() => setCurrentView('history')} />
        <NavBtn icon={<Code2 className="w-4 h-4" />} label="Snippets" active={currentView === 'snippets'} onClick={() => setCurrentView('snippets')} />
        <NavBtn icon={<Layers className="w-4 h-4" />} label="Templates" active={currentView === 'templates'} onClick={() => setCurrentView('templates')} />
        <NavBtn icon={<FileCode className="w-4 h-4" />} label="Scripts" active={currentView === 'scripts'} onClick={() => setCurrentView('scripts')} />
        <NavBtn icon={<Radio className="w-4 h-4" />} label="Scanner" active={currentView === 'scanner'} onClick={() => setCurrentView('scanner')} />
        <NavBtn icon={<Key className="w-4 h-4" />} label="Key Gen" active={currentView === 'keygen'} onClick={() => setCurrentView('keygen')} />
        <div className="flex-1" />
        <NavBtn icon={<BookOpen className="w-4 h-4" />} label="Docs" active={currentView === 'docs'} onClick={() => setCurrentView('docs')} />
        <NavBtn icon={<Keyboard className="w-4 h-4" />} label="Shortcuts" active={currentView === 'shortcuts'} onClick={() => setCurrentView('shortcuts')} />
        <NavBtn icon={<Settings className="w-4 h-4" />} label="Settings" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
      </nav>

      {/* Sidebar for connections view */}
      {!sidebarCollapsed && currentView === 'connections' && (
        <div className={`w-72 border-r flex flex-col ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
          <div className={`p-3 border-b ${isDark ? 'border-[#1e2030]' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <h2 className={`text-sm font-semibold flex-1 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Connections</h2>
              <button onClick={() => setSidebarCollapsed(true)} className={`p-1 rounded ${isDark ? 'hover:bg-[#24253a]' : 'hover:bg-gray-100'}`}><PanelLeftClose className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input ref={searchRef} type="text" placeholder="Search... (Ctrl+F)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${isDark ? 'bg-[#1e2030] border-[#2a2b3d] text-gray-200 placeholder-gray-500' : 'bg-gray-50 border-gray-200'}`} />
            </div>
            <div className="flex gap-1 mt-2">
              <button onClick={() => { setEditingConn(null); setShowForm(true); }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-md"><Plus className="w-3 h-3" /> New</button>
              <button onClick={handleExport} className={`px-2 py-1 text-xs rounded-md ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 text-gray-600'}`}><Download className="w-3 h-3" /></button>
              <button onClick={handleImport} className={`px-2 py-1 text-xs rounded-md ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 text-gray-600'}`}><Upload className="w-3 h-3" /></button>
              <button onClick={handleImportSSHConfig} className={`px-2 py-1 text-xs rounded-md ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 text-gray-600'}`} title="Import SSH Config"><FileText className="w-3 h-3" /></button>
              <button onClick={() => setBatchMode(!batchMode)} className={`px-2 py-1 text-xs rounded-md ${batchMode ? 'bg-amber-600 text-white' : isDark ? 'bg-[#1e2030] text-gray-300' : 'bg-gray-100 text-gray-600'}`}><Layers className="w-3 h-3" /></button>
            </div>
          </div>
          {batchMode && selectedIds.size > 0 && (
            <div className={`px-3 py-2 border-b flex items-center gap-2 ${isDark ? 'bg-amber-900/20 border-amber-800/30' : 'bg-amber-50 border-amber-200'}`}>
              <span className="text-xs text-amber-400">{selectedIds.size} selected</span>
              <button onClick={handleBatchConnect} className="px-2 py-0.5 bg-emerald-600 text-white text-xs rounded">Connect</button>
              <button onClick={handleBatchDelete} className="px-2 py-0.5 bg-red-600 text-white text-xs rounded">Delete</button>
            </div>
          )}
          <div className="px-2 pt-2 space-y-0.5">
            <SideBtn icon={<Server className="w-4 h-4" />} label="All" count={connections.length} active={selectedGroupId === null} onClick={() => setSelectedGroupId(null)} isDark={isDark} />
            <SideBtn icon={<Star className="w-4 h-4" />} label="Favorites" count={connections.filter(c => c.favorite).length} active={false} onClick={() => {}} isDark={isDark} />
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {groups.map(group => {
              const gc = filteredConnections.filter(c => c.groupId === group.id);
              return (
                <div key={group.id} className="mb-1">
                  <div className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer group ${isDark ? 'hover:bg-[#1e2030]' : 'hover:bg-gray-100'}`} onClick={() => setGroups(prev => prev.map(g => g.id === group.id ? { ...g, expanded: !g.expanded } : g))}>
                    <span className="text-gray-500">{group.expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
                    <span className="text-xs">{group.icon}</span>
                    <span className={`text-xs flex-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{group.name}</span>
                    <span className="text-[10px] text-gray-500">{gc.length}</span>
                    <button onClick={e => { e.stopPropagation(); setGroups(prev => prev.filter(g => g.id !== group.id)); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                  {group.expanded && <div className="ml-3 space-y-0.5">{gc.map(conn => <ConnItem key={conn.id} conn={conn} isSelected={conn.id === selectedId} isBatch={batchMode} isBatchSelected={selectedIds.has(conn.id)} isDark={isDark} onSelect={() => batchMode ? toggleSelect(conn.id) : setSelectedId(conn.id)} onConnect={() => handleQuickConnect(conn)} onToggleFav={() => handleToggleFavorite(conn.id)} onCheckStatus={() => handleCheckStatus(conn.id)} />)}</div>}
                </div>
              );
            })}
            {filteredConnections.filter(c => !c.groupId || !groups.find(g => g.id === c.groupId)).length > 0 && (
              <div className="mt-2">
                <p className={`text-[10px] uppercase tracking-wider px-2 py-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Ungrouped</p>
                {filteredConnections.filter(c => !c.groupId || !groups.find(g => g.id === c.groupId)).map(conn => <ConnItem key={conn.id} conn={conn} isSelected={conn.id === selectedId} isBatch={batchMode} isBatchSelected={selectedIds.has(conn.id)} isDark={isDark} onSelect={() => batchMode ? toggleSelect(conn.id) : setSelectedId(conn.id)} onConnect={() => handleQuickConnect(conn)} onToggleFav={() => handleToggleFavorite(conn.id)} onCheckStatus={() => handleCheckStatus(conn.id)} />)}
              </div>
            )}
          </div>
          <div className={`p-2 border-t ${isDark ? 'border-[#1e2030]' : 'border-gray-200'}`}>
            <AddGroupForm groups={groups} onAdd={(g: ConnectionGroup) => setGroups(prev => [...prev, g])} isDark={isDark} />
          </div>
        </div>
      )}
      {sidebarCollapsed && currentView === 'connections' && (
        <button onClick={() => setSidebarCollapsed(false)} className={`w-8 flex items-center justify-center border-r ${isDark ? 'bg-[#161822] border-[#1e2030] hover:bg-[#1e2030]' : 'bg-white border-gray-200 hover:bg-gray-50'}`}><PanelLeftOpen className="w-4 h-4 text-gray-400" /></button>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {currentView === 'dashboard' && <Dashboard connections={connections} groups={groups} history={history} isDark={isDark} onNavigate={setCurrentView} />}
        {currentView === 'connections' && (selectedConn ? <ConnDetail conn={selectedConn} groups={groups} isDark={isDark} onEdit={() => { setEditingConn(selectedConn); setShowForm(true); }} onConnect={() => handleQuickConnect(selectedConn)} onToggleFav={() => handleToggleFavorite(selectedConn.id)} onCheckStatus={() => handleCheckStatus(selectedConn.id)} /> : <WelcomeScreen isDark={isDark} onNew={() => { setEditingConn(null); setShowForm(true); }} count={connections.length} />)}
        {currentView === 'fileTransfer' && <FileTransferView connections={connections} isDark={isDark} transfers={transfers} setTransfers={setTransfers} addToast={addToast} />}
        {currentView === 'github' && <GitHubView connections={connections} isDark={isDark} setConnections={setConnections} addToast={addToast} />}
        {currentView === 'history' && <HistoryView history={history} isDark={isDark} onClear={() => setHistory([])} />}
        {currentView === 'snippets' && <SnippetsView snippets={snippets} isDark={isDark} onSave={(s: CommandSnippet) => setSnippets(prev => [...prev, s])} onDelete={(id: string) => setSnippets(prev => prev.filter((s: CommandSnippet) => s.id !== id))} />}
        {currentView === 'settings' && <SettingsView settings={settings} isDark={isDark} onSave={(s: AppSettings) => { setSettings(s); addToast('success', 'Settings', 'Saved'); }} />}
        {currentView === 'keygen' && <KeyGenView isDark={isDark} addToast={addToast} />}
        {currentView === 'scanner' && <ScannerView isDark={isDark} addToast={addToast} onImport={(conns: SSHConnection[]) => setConnections(prev => [...prev, ...conns])} />}
        {currentView === 'scripts' && <ScriptsView connections={connections} isDark={isDark} addToast={addToast} />}
        {currentView === 'shortcuts' && <ShortcutsView isDark={isDark} />}
        {currentView === 'templates' && <TemplatesView isDark={isDark} onApply={(t: Partial<SSHConnection>) => { const conn = createDefaultConnection(t); setEditingConn(conn); setShowForm(true); }} />}
        {currentView === 'docs' && <DocsView isDark={isDark} />}
      </div>

      {showForm && <ConnForm conn={editingConn} groups={groups} isDark={isDark} onSave={handleSaveConn} onCancel={() => { setShowForm(false); setEditingConn(null); }} />}

      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />)}
      </div>
    </div>
  );
}

// ============ SHARED COMPONENTS ============

function NavBtn({ icon, label, active, onClick, disabled }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} title={label} className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${active ? 'bg-emerald-600/20 text-emerald-400' : disabled ? 'text-gray-600 cursor-default' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>{icon}</button>;
}

function Divider({ isDark }: { isDark: boolean }) { return <div className={`w-8 h-px my-1 ${isDark ? 'bg-[#2a2b3d]' : 'bg-gray-200'}`} />; }

function SideBtn({ icon, label, count, active, onClick, isDark }: { icon: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void; isDark: boolean }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${active ? 'bg-emerald-600/20 text-emerald-400' : isDark ? 'text-gray-300 hover:bg-[#1e2030]' : 'text-gray-700 hover:bg-gray-100'}`}>{icon}<span className="flex-1 text-left">{label}</span><span className="text-[10px] text-gray-500">{count}</span></button>;
}

function ConnItem({ conn, isSelected, isBatch, isBatchSelected, isDark, onSelect, onConnect, onToggleFav, onCheckStatus }: any) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div className={`relative flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer group ${isSelected && !isBatch ? 'bg-emerald-600/15 border border-emerald-500/30' : isBatchSelected ? 'bg-amber-600/15 border border-amber-500/30' : `border border-transparent ${isDark ? 'hover:bg-[#1e2030]' : 'hover:bg-gray-100'}`}`} onClick={onSelect}>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: conn.color }} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{conn.name}</p>
        <p className="text-[10px] text-gray-500 truncate">{conn.username}@{conn.host}</p>
      </div>
      {conn.favorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
      <StatusDot status={conn.status} />
      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
        <button onClick={e => { e.stopPropagation(); onConnect(); }} className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400"><Play className="w-3 h-3" /></button>
        <button onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-1 hover:bg-white/10 rounded text-gray-400"><MoreVertical className="w-3 h-3" /></button>
      </div>
      {showMenu && (<><div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} /><div className={`absolute right-0 top-full mt-1 z-50 py-1 rounded-lg shadow-xl border min-w-[130px] ${isDark ? 'bg-[#1e2030] border-[#2a2b3d]' : 'bg-white border-gray-200'}`}>
        <MenuBtn icon={<Star className="w-3.5 h-3.5" />} label={conn.favorite ? 'Unfavorite' : 'Favorite'} onClick={() => { onToggleFav(); setShowMenu(false); }} isDark={isDark} />
        <MenuBtn icon={<RefreshCw className="w-3.5 h-3.5" />} label="Check Status" onClick={() => { onCheckStatus(); setShowMenu(false); }} isDark={isDark} />
      </div></>)}
    </div>
  );
}

function MenuBtn({ icon, label, onClick, isDark }: any) {
  return <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs ${isDark ? 'text-gray-300 hover:bg-[#24253a]' : 'text-gray-700 hover:bg-gray-100'}`}>{icon} {label}</button>;
}

function StatusDot({ status }: { status: string }) {
  return <div className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-emerald-400' : status === 'offline' ? 'bg-red-400' : 'bg-gray-500'}`} />;
}

function AddGroupForm({ groups, onAdd, isDark }: any) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🖥️');
  const [color, setColor] = useState(CONNECTION_COLORS[0]);
  const submit = () => { if (name.trim()) { onAdd({ id: uuidv4(), name: name.trim(), icon, expanded: true, color }); setName(''); setOpen(false); } };
  if (!open) return <button onClick={() => setOpen(true)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${isDark ? 'text-gray-400 hover:bg-[#1e2030]' : 'text-gray-500 hover:bg-gray-100'}`}><FolderPlus className="w-3.5 h-3.5" /> Add Group</button>;
  return (
    <div className="space-y-2">
      <input type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Group name..." autoFocus className={`w-full px-2 py-1 text-xs rounded border focus:outline-none ${isDark ? 'bg-[#1e2030] border-[#2a2b3d] text-gray-200' : 'bg-gray-50 border-gray-200'}`} />
      <div className="flex gap-1 flex-wrap">{GROUP_ICONS.slice(0, 10).map(i => <button key={i} onClick={() => setIcon(i)} className={`w-6 h-6 flex items-center justify-center rounded text-xs ${icon === i ? 'bg-emerald-600/30 ring-1 ring-emerald-500' : ''}`}>{i}</button>)}</div>
      <div className="flex gap-1">{CONNECTION_COLORS.slice(0, 6).map(c => <button key={c} onClick={() => setColor(c)} className={`w-4 h-4 rounded-full ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[#161822]' : ''}`} style={{ backgroundColor: c }} />)}</div>
      <div className="flex gap-1"><button onClick={submit} className="flex-1 px-2 py-1 bg-emerald-600 text-white text-xs rounded">Add</button><button onClick={() => setOpen(false)} className="px-2 py-1 text-xs text-gray-400">Cancel</button></div>
    </div>
  );
}

function inputCls(isDark: boolean) { return `w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${isDark ? 'bg-[#1e2030] border-[#2a2b3d] text-gray-200 placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'}`; }

function FF({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <div><label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">{icon}{label}</label>{children}</div>;
}

// ============ CONNECTION FORM ============

function ConnForm({ conn, groups, isDark, onSave, onCancel }: any) {
  const [form, setForm] = useState<SSHConnection>(conn || createDefaultConnection());
  const [tagInput, setTagInput] = useState('');
  const [cmdInput, setCmdInput] = useState('');
  const [envKey, setEnvKey] = useState('');
  const [envVal, setEnvVal] = useState('');
  const [tab, setTab] = useState<'basic' | 'auth' | 'tunnels' | 'startup' | 'zmodem' | 'github' | 'advanced'>('basic');
  const update = (p: Partial<SSHConnection>) => setForm((prev: SSHConnection) => ({ ...prev, ...p }));

  const tabs = [
    { id: 'basic' as const, label: 'Basic', icon: <Server className="w-3.5 h-3.5" /> },
    { id: 'auth' as const, label: 'Auth', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'tunnels' as const, label: 'Tunnels', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { id: 'startup' as const, label: 'Startup', icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'zmodem' as const, label: 'Zmodem', icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
    { id: 'github' as const, label: 'GitHub', icon: <Github className="w-3.5 h-3.5" /> },
    { id: 'advanced' as const, label: 'Advanced', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className={`w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border shadow-2xl flex flex-col ${isDark ? 'bg-[#161822] border-[#2a2b3d]' : 'bg-white border-gray-200'}`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-[#2a2b3d]' : 'border-gray-200'}`}>
          <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{conn ? 'Edit Connection' : 'New Connection'}</h2>
          <button onClick={onCancel} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className={`flex border-b overflow-x-auto ${isDark ? 'border-[#2a2b3d]' : 'border-gray-200'}`}>
          {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${tab === t.id ? 'border-emerald-500 text-emerald-400' : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500'}`}`}>{t.icon} {t.label}</button>)}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (form.name && form.host) onSave(form); }} className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'basic' && (<>
            <FF label="Name" icon={<FileText className="w-3.5 h-3.5" />}><input type="text" value={form.name} onChange={e => update({ name: e.target.value })} placeholder="Production Server" required className={inputCls(isDark)} /></FF>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><FF label="Host" icon={<Globe className="w-3.5 h-3.5" />}><input type="text" value={form.host} onChange={e => update({ host: e.target.value })} placeholder="192.168.1.100" required className={inputCls(isDark)} /></FF></div>
              <FF label="Port" icon={<Hash className="w-3.5 h-3.5" />}><input type="number" value={form.port} onChange={e => update({ port: parseInt(e.target.value) || 22 })} className={inputCls(isDark)} /></FF>
            </div>
            <FF label="Username" icon={<User className="w-3.5 h-3.5" />}><input type="text" value={form.username} onChange={e => update({ username: e.target.value })} placeholder="root" className={inputCls(isDark)} /></FF>
            <FF label="Protocol"><div className="flex gap-2 flex-wrap">{(['ssh','sftp','scp','rdp','telnet','serial'] as const).map(p => <button key={p} type="button" onClick={() => update({ protocol: p })} className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase ${form.protocol === p ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>{p}</button>)}</div></FF>
            <FF label="Group"><select value={form.groupId} onChange={e => update({ groupId: e.target.value })} className={inputCls(isDark)}><option value="">No Group</option>{groups.map((g: ConnectionGroup) => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}</select></FF>
            <FF label="Color"><div className="flex gap-2 flex-wrap">{CONNECTION_COLORS.map(c => <button key={c} type="button" onClick={() => update({ color: c })} className={`w-6 h-6 rounded-full ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#161822] scale-110' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />)}</div></FF>
            <FF label="Tags" icon={<Tag className="w-3.5 h-3.5" />}>
              <div className="flex gap-2"><input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (tagInput.trim()) { update({ tags: [...form.tags, tagInput.trim()] }); setTagInput(''); } } }} placeholder="Add tag..." className={inputCls(isDark)} /><button type="button" onClick={() => { if (tagInput.trim()) { update({ tags: [...form.tags, tagInput.trim()] }); setTagInput(''); } }} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">Add</button></div>
              {form.tags.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{form.tags.map((tag: string) => <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600/20 text-emerald-400 text-xs rounded-full">{tag}<button type="button" onClick={() => update({ tags: form.tags.filter((t: string) => t !== tag) })}><X className="w-3 h-3" /></button></span>)}</div>}
            </FF>
            <FF label="Notes" icon={<StickyNote className="w-3.5 h-3.5" />}><textarea value={form.notes} onChange={e => update({ notes: e.target.value })} rows={2} className={`${inputCls(isDark)} resize-none`} /></FF>
          </>)}

          {tab === 'auth' && (<><FF label="Auth Method" icon={<Lock className="w-3.5 h-3.5" />}><div className="grid grid-cols-4 gap-2">{(['key','password','agent','certificate'] as const).map(t => <button key={t} type="button" onClick={() => update({ authType: t })} className={`px-3 py-2 rounded-lg text-xs font-medium ${form.authType === t ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>{t === 'key' ? '🔑 Key' : t === 'password' ? '🔒 Password' : t === 'agent' ? '🤖 Agent' : '📜 Cert'}</button>)}</div></FF>
            {form.authType === 'key' && <FF label="Key Path" icon={<Key className="w-3.5 h-3.5" />}><input type="text" value={form.keyPath || ''} onChange={e => update({ keyPath: e.target.value })} placeholder="C:\Users\You\.ssh\id_rsa" className={inputCls(isDark)} /></FF>}
            {form.authType === 'password' && <FF label="Password" icon={<Lock className="w-3.5 h-3.5" />}><input type="password" value={form.password || ''} onChange={e => update({ password: e.target.value })} className={inputCls(isDark)} /></FF>}
            {form.authType === 'certificate' && <><FF label="Cert Path"><input type="text" value={form.certPath || ''} onChange={e => update({ certPath: e.target.value })} className={inputCls(isDark)} /></FF><FF label="Key Path"><input type="text" value={form.keyPath || ''} onChange={e => update({ keyPath: e.target.value })} className={inputCls(isDark)} /></FF></>}
            <FF label="Jump Host" icon={<ArrowRight className="w-3.5 h-3.5" />}><div className="grid grid-cols-3 gap-2"><input type="text" value={form.jumpHost || ''} onChange={e => update({ jumpHost: e.target.value })} placeholder="Host" className={inputCls(isDark)} /><input type="number" value={form.jumpPort || 22} onChange={e => update({ jumpPort: parseInt(e.target.value) || 22 })} placeholder="Port" className={inputCls(isDark)} /><input type="text" value={form.jumpUser || ''} onChange={e => update({ jumpUser: e.target.value })} placeholder="User" className={inputCls(isDark)} /></div></FF>
          </>)}

          {tab === 'tunnels' && (<><div className="flex items-center justify-between"><h3 className="text-sm font-medium text-gray-200">Port Forwarding</h3><button type="button" onClick={() => update({ portForwards: [...form.portForwards, { id: uuidv4(), type: 'local', localPort: 8080, remoteHost: 'localhost', remotePort: 80, enabled: true }] })} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg"><Plus className="w-3 h-3" /> Add</button></div>
            {form.portForwards.length === 0 && <p className="text-xs text-gray-500 italic">No tunnels configured</p>}
            {form.portForwards.map((pf: PortForward, idx: number) => (<div key={pf.id} className={`p-3 rounded-lg border ${isDark ? 'bg-[#1e2030] border-[#2a2b3d]' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-2"><select value={pf.type} onChange={e => { const f = [...form.portForwards]; f[idx] = { ...pf, type: e.target.value as any }; update({ portForwards: f }); }} className={`text-xs px-2 py-1 rounded border ${isDark ? 'bg-[#161822] border-[#2a2b3d] text-gray-200' : 'bg-white border-gray-200'}`}><option value="local">Local (-L)</option><option value="remote">Remote (-R)</option><option value="dynamic">Dynamic (-D)</option></select><label className="flex items-center gap-1 text-xs text-gray-400"><input type="checkbox" checked={pf.enabled} onChange={e => { const f = [...form.portForwards]; f[idx] = { ...pf, enabled: e.target.checked }; update({ portForwards: f }); }} /> Active</label><button type="button" onClick={() => update({ portForwards: form.portForwards.filter((_: any, i: number) => i !== idx) })} className="ml-auto p-1 hover:bg-red-500/20 rounded text-red-400"><Trash2 className="w-3 h-3" /></button></div>
              <div className="grid grid-cols-3 gap-2"><div><label className="text-[10px] text-gray-500">Local Port</label><input type="number" value={pf.localPort} onChange={e => { const f = [...form.portForwards]; f[idx] = { ...pf, localPort: parseInt(e.target.value) }; update({ portForwards: f }); }} className={`w-full px-2 py-1 text-xs rounded border ${isDark ? 'bg-[#161822] border-[#2a2b3d] text-gray-200' : 'bg-white border-gray-200'}`} /></div><div><label className="text-[10px] text-gray-500">Remote Host</label><input type="text" value={pf.remoteHost} onChange={e => { const f = [...form.portForwards]; f[idx] = { ...pf, remoteHost: e.target.value }; update({ portForwards: f }); }} className={`w-full px-2 py-1 text-xs rounded border ${isDark ? 'bg-[#161822] border-[#2a2b3d] text-gray-200' : 'bg-white border-gray-200'}`} /></div><div><label className="text-[10px] text-gray-500">Remote Port</label><input type="number" value={pf.remotePort} onChange={e => { const f = [...form.portForwards]; f[idx] = { ...pf, remotePort: parseInt(e.target.value) }; update({ portForwards: f }); }} className={`w-full px-2 py-1 text-xs rounded border ${isDark ? 'bg-[#161822] border-[#2a2b3d] text-gray-200' : 'bg-white border-gray-200'}`} /></div></div>
            </div>))}
          </>)}

          {tab === 'startup' && (<><FF label="Startup Commands" icon={<Zap className="w-3.5 h-3.5" />}>
            <div className="space-y-2">{form.startupCommands.map((cmd: string, idx: number) => <div key={idx} className="flex gap-2"><input type="text" value={cmd} onChange={e => { const c = [...form.startupCommands]; c[idx] = e.target.value; update({ startupCommands: c }); }} className={`flex-1 ${inputCls(isDark)}`} /><button type="button" onClick={() => update({ startupCommands: form.startupCommands.filter((_: string, i: number) => i !== idx) })} className="p-1.5 hover:bg-red-500/20 rounded text-red-400"><X className="w-4 h-4" /></button></div>)}</div>
            <div className="flex gap-2 mt-2"><input type="text" value={cmdInput} onChange={e => setCmdInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (cmdInput.trim()) { update({ startupCommands: [...form.startupCommands, cmdInput.trim()] }); setCmdInput(''); } } }} placeholder="Add command..." className={`flex-1 ${inputCls(isDark)}`} /><button type="button" onClick={() => { if (cmdInput.trim()) { update({ startupCommands: [...form.startupCommands, cmdInput.trim()] }); setCmdInput(''); } }} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">Add</button></div>
          </FF>
          <FF label="Environment Variables">
            <div className="space-y-2">{Object.entries(form.envVars).map(([key, val]) => <div key={key} className="flex gap-2 items-center"><span className={`text-xs font-mono px-2 py-1 rounded ${isDark ? 'bg-[#1e2030] text-emerald-400' : 'bg-gray-100 text-emerald-600'}`}>{key}</span><span className={`text-xs flex-1 px-2 py-1 rounded ${isDark ? 'bg-[#1e2030] text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{val as string}</span><button type="button" onClick={() => { const v = { ...form.envVars }; delete v[key]; update({ envVars: v }); }} className="p-1 hover:bg-red-500/20 rounded text-red-400"><X className="w-3 h-3" /></button></div>)}</div>
            <div className="flex gap-2 mt-2"><input type="text" value={envKey} onChange={e => setEnvKey(e.target.value)} placeholder="KEY" className={`flex-1 ${inputCls(isDark)}`} /><input type="text" value={envVal} onChange={e => setEnvVal(e.target.value)} placeholder="value" className={`flex-1 ${inputCls(isDark)}`} /><button type="button" onClick={() => { if (envKey.trim()) { update({ envVars: { ...form.envVars, [envKey]: envVal } }); setEnvKey(''); setEnvVal(''); } }} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">Add</button></div>
          </FF></>)}

          {tab === 'zmodem' && (<><div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1e2030] border-[#2a2b3d]' : 'bg-gray-50 border-gray-200'}`}>
            <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2"><ArrowUpDown className="w-4 h-4 text-emerald-400" /> Zmodem / ZSSH Settings</h3>
            <p className="text-xs text-gray-400 mb-4">Zmodem enables file transfer directly through your SSH session using rz/sz commands. Compatible with lrzsz, zssh, and similar tools.</p>
            <div className="space-y-3">
              <label className="flex items-center justify-between"><span className="text-sm text-gray-300">Enable Zmodem</span><Toggle checked={form.zmodemEnabled} onChange={v => update({ zmodemEnabled: v })} isDark={isDark} /></label>
              <label className="flex items-center justify-between"><span className="text-sm text-gray-300">Auto-receive files</span><Toggle checked={form.zmodemAutoReceive} onChange={v => update({ zmodemAutoReceive: v })} isDark={isDark} /></label>
              <div><label className="text-xs text-gray-400 mb-1 block">Buffer Size (bytes)</label><input type="number" value={form.zmodemBufferSize} onChange={e => update({ zmodemBufferSize: parseInt(e.target.value) })} className={inputCls(isDark)} /></div>
            </div>
          </div>
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0d0e17] border-[#1e2030]' : 'bg-gray-900 border-gray-700'}`}>
            <h4 className="text-xs text-gray-400 mb-2">ZSSH Connection Command</h4>
            <code className="text-xs text-emerald-300 font-mono block">{generateZmodemCommand(form)}</code>
            <button type="button" onClick={() => { navigator.clipboard.writeText(generateZmodemCommand(form)); }} className="mt-2 text-xs text-emerald-400 hover:text-emerald-300">Copy command</button>
          </div>
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1e2030] border-[#2a2b3d]' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className="text-sm font-medium text-gray-200 mb-2">Zmodem Quick Reference</h4>
            <div className="space-y-1.5 text-xs text-gray-400">
              <p><code className="text-emerald-400">sz filename</code> — Send file from server to local</p>
              <p><code className="text-emerald-400">rz</code> — Receive file from local to server</p>
              <p><code className="text-emerald-400">sz -be file1 file2</code> — Batch send (binary, escape)</p>
              <p><code className="text-emerald-400">rz -be</code> — Batch receive</p>
              <p><code className="text-emerald-400">sz -E file</code> — Send with error correction</p>
            </div>
          </div></>)}

          {tab === 'github' && (<><div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1e2030] border-[#2a2b3d]' : 'bg-gray-50 border-gray-200'}`}>
            <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2"><Github className="w-4 h-4" /> GitHub Integration</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between"><span className="text-sm text-gray-300">Enable GitHub</span><Toggle checked={form.githubEnabled} onChange={v => update({ githubEnabled: v })} isDark={isDark} /></label>
              {form.githubEnabled && (<><div><label className="text-xs text-gray-400 mb-1 block">Personal Access Token</label><input type="password" value={form.githubToken || ''} onChange={e => update({ githubToken: e.target.value })} placeholder="ghp_xxxxxxxxxxxx" className={inputCls(isDark)} /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Linked Repositories</label>
                <div className="space-y-1">{(form.githubRepos || []).map((repo: string, idx: number) => <div key={idx} className="flex items-center gap-2"><span className="text-xs text-gray-300 flex-1">{repo}</span><button type="button" onClick={() => update({ githubRepos: form.githubRepos?.filter((_: string, i: number) => i !== idx) })} className="text-red-400 text-xs">Remove</button></div>)}</div>
                <button type="button" onClick={() => { const repo = prompt('Enter repository (owner/repo):'); if (repo) update({ githubRepos: [...(form.githubRepos || []), repo] }); }} className="mt-2 text-xs text-emerald-400 hover:text-emerald-300">+ Add Repository</button>
              </div></>)}
            </div>
          </div>
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1e2030] border-[#2a2b3d]' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className="text-sm font-medium text-gray-200 mb-2">Deploy Keys</h4>
            <div className="space-y-2">{(form.githubDeployKeys || []).map((dk: DeployKey) => <div key={dk.id} className={`p-2 rounded-lg border ${isDark ? 'border-[#2a2b3d]' : 'border-gray-200'}`}><div className="flex items-center justify-between"><span className="text-xs text-gray-300">{dk.title}</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${dk.readOnly ? 'bg-blue-600/20 text-blue-400' : 'bg-emerald-600/20 text-emerald-400'}`}>{dk.readOnly ? 'Read' : 'Read/Write'}</span></div><p className="text-[10px] text-gray-500 font-mono truncate mt-1">{dk.key}</p></div>)}</div>
            <button type="button" onClick={() => { const title = prompt('Key title:'); if (title) { const key = `ssh-ed25519 AAAA...generated_${Date.now()}`; update({ githubDeployKeys: [...(form.githubDeployKeys || []), { id: uuidv4(), title, key, readOnly: true, createdAt: Date.now() }] }); } }} className="mt-2 text-xs text-emerald-400 hover:text-emerald-300">+ Add Deploy Key</button>
          </div></>)}

          {tab === 'advanced' && (<><div className="grid grid-cols-2 gap-4">
            <FF label="Timeout (s)"><input type="number" value={form.timeout} onChange={e => update({ timeout: parseInt(e.target.value) })} className={inputCls(isDark)} /></FF>
            <FF label="Keep Alive (s)"><input type="number" value={form.keepAliveInterval} onChange={e => update({ keepAliveInterval: parseInt(e.target.value) })} className={inputCls(isDark)} /></FF>
          </div>
          <FF label="Font Size"><input type="number" value={form.fontSize} onChange={e => update({ fontSize: parseInt(e.target.value) })} className={inputCls(isDark)} /></FF>
          <FF label="Theme"><div className="flex gap-2">{(['default','solarized','monokai','dracula'] as const).map(t => <button key={t} type="button" onClick={() => update({ theme: t })} className={`px-3 py-1.5 rounded-lg text-xs capitalize ${form.theme === t ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>{t}</button>)}</div></FF>
          <FF label="Encoding"><select value={form.encoding} onChange={e => update({ encoding: e.target.value })} className={inputCls(isDark)}><option value="utf-8">UTF-8</option><option value="latin-1">Latin-1</option><option value="gbk">GBK</option><option value="shift_jis">Shift-JIS</option></select></FF>
          {form.protocol === 'rdp' && <><FF label="RDP Resolution"><select value={form.rdpResolution || '1920x1080'} onChange={e => update({ rdpResolution: e.target.value })} className={inputCls(isDark)}><option value="1920x1080">1920x1080</option><option value="2560x1440">2560x1440</option><option value="3840x2160">3840x2160</option></select></FF><label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={form.rdpFullScreen || false} onChange={e => update({ rdpFullScreen: e.target.checked })} /> Full Screen</label></>}
          {form.protocol === 'serial' && <div className="grid grid-cols-2 gap-4"><FF label="Baud Rate"><select value={form.serialBaudRate || 9600} onChange={e => update({ serialBaudRate: parseInt(e.target.value) })} className={inputCls(isDark)}>{[9600,19200,38400,57600,115200].map(r => <option key={r} value={r}>{r}</option>)}</select></FF><FF label="Data Bits"><select value={form.serialDataBits || 8} onChange={e => update({ serialDataBits: parseInt(e.target.value) })} className={inputCls(isDark)}>{[5,6,7,8].map(d => <option key={d} value={d}>{d}</option>)}</select></FF></div>}
          </>)}
        </form>
        <div className={`flex gap-3 px-5 py-3 border-t ${isDark ? 'border-[#2a2b3d]' : 'border-gray-200'}`}>
          <button type="button" onClick={onCancel} className={`flex-1 px-4 py-2 rounded-lg text-sm ${isDark ? 'bg-[#1e2030] text-gray-300' : 'bg-gray-100 text-gray-600'}`}>Cancel</button>
          <button type="submit" onClick={() => { if (form.name && form.host) onSave(form); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white font-medium"><Save className="w-4 h-4" /> {conn ? 'Update' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ============ CONNECTION DETAIL ============

function ConnDetail({ conn, groups, isDark, onEdit, onConnect, onToggleFav, onCheckStatus }: any) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showCmds, setShowCmds] = useState(false);
  const group = groups.find((g: ConnectionGroup) => g.id === conn.groupId);
  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 2000); };
  const sshCmd = generateSSHCommand(conn);
  const puttyCmd = generatePuTTYCommand(conn);
  const rdpCmd = conn.protocol === 'rdp' ? generateRDPCommand(conn) : '';
  const wtCmd = `wt ssh ${conn.username}@${conn.host}${conn.port !== 22 ? ` -p ${conn.port}` : ''}`;

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className={`border-b ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: conn.color }} />
              <div>
                <div className="flex items-center gap-2"><h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{conn.name}</h2>{conn.favorite && <Star className="w-5 h-5 text-amber-400 fill-amber-400" />}<StatusDot status={conn.status} /></div>
                <p className="text-sm text-gray-400 mt-0.5">{conn.username}@{conn.host}:{conn.port} • {conn.protocol.toUpperCase()}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onCheckStatus} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 text-gray-600'}`}><RefreshCw className="w-3.5 h-3.5" /> Check</button>
              <button onClick={onToggleFav} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{conn.favorite ? <StarOff className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}</button>
              <button onClick={onEdit} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-[#1e2030] hover:bg-[#24253a] text-gray-300' : 'bg-gray-100 text-gray-600'}`}><Edit3 className="w-3.5 h-3.5" /> Edit</button>
              <button onClick={onConnect} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs text-white font-medium"><Play className="w-3.5 h-3.5" /> Connect</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={() => setShowCmds(!showCmds)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${isDark ? 'bg-[#1e2030] text-gray-300' : 'bg-gray-100 text-gray-600'}`}><Terminal className="w-3.5 h-3.5" /> Commands</button>
            <button onClick={() => copy(sshCmd, 'ssh')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${isDark ? 'bg-[#1e2030] text-gray-300' : 'bg-gray-100 text-gray-600'}`}><Copy className="w-3.5 h-3.5" /> {copied === 'ssh' ? '✓' : 'SSH'}</button>
            {conn.zmodemEnabled && <span className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded-full"><ArrowUpDown className="w-3 h-3" /> Zmodem</span>}
            {conn.githubEnabled && <span className="flex items-center gap-1 px-2 py-1 bg-gray-600/20 text-gray-300 text-xs rounded-full"><Github className="w-3 h-3" /> GitHub</span>}
            {conn.portForwards.filter((p: PortForward) => p.enabled).length > 0 && <span className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-full"><GitBranch className="w-3 h-3" /> {conn.portForwards.filter((p: PortForward) => p.enabled).length} tunnels</span>}
          </div>
        </div>
      </div>
      {showCmds && (<div className={`max-w-5xl mx-auto p-6 border-b ${isDark ? 'border-[#1e2030]' : 'border-gray-200'}`}>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Terminal className="w-4 h-4 text-emerald-400" /> Commands</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CmdBlock label="OpenSSH" command={sshCmd} copied={copied === 'ssh'} onCopy={() => copy(sshCmd, 'ssh')} isDark={isDark} />
          <CmdBlock label="PuTTY" command={puttyCmd} copied={copied === 'putty'} onCopy={() => copy(puttyCmd, 'putty')} isDark={isDark} />
          <CmdBlock label="Windows Terminal" command={wtCmd} copied={copied === 'wt'} onCopy={() => copy(wtCmd, 'wt')} isDark={isDark} />
          {rdpCmd && <CmdBlock label="RDP" command={rdpCmd} copied={copied === 'rdp'} onCopy={() => copy(rdpCmd, 'rdp')} isDark={isDark} />}
          {conn.zmodemEnabled && <CmdBlock label="ZSSH" command={generateZmodemCommand(conn)} copied={copied === 'zssh'} onCopy={() => copy(generateZmodemCommand(conn), 'zssh')} isDark={isDark} />}
        </div>
      </div>)}
      <div className="max-w-5xl mx-auto p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <DCard icon={<Globe className="w-4 h-4 text-blue-400" />} label="Host" value={conn.host} isDark={isDark} />
          <DCard icon={<Hash className="w-4 h-4 text-purple-400" />} label="Port" value={String(conn.port)} isDark={isDark} />
          <DCard icon={<User className="w-4 h-4 text-emerald-400" />} label="Username" value={conn.username} isDark={isDark} />
          <DCard icon={<Shield className="w-4 h-4 text-amber-400" />} label="Auth" value={conn.authType} isDark={isDark} />
          <DCard icon={<Wifi className="w-4 h-4 text-cyan-400" />} label="Protocol" value={conn.protocol.toUpperCase()} isDark={isDark} />
          <DCard icon={<BarChart3 className="w-4 h-4 text-indigo-400" />} label="Sessions" value={String(conn.totalConnections)} isDark={isDark} />
        </div>
        {conn.portForwards.length > 0 && (<div className="mt-6"><h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2"><GitBranch className="w-4 h-4" /> Tunnels</h3><div className="space-y-2">{conn.portForwards.map((pf: PortForward) => (<div key={pf.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-gray-50 border-gray-200'}`}><span className={`px-2 py-0.5 rounded text-xs font-medium ${pf.type === 'local' ? 'bg-blue-600/20 text-blue-400' : pf.type === 'remote' ? 'bg-purple-600/20 text-purple-400' : 'bg-amber-600/20 text-amber-400'}`}>{pf.type.toUpperCase()}</span><span className="text-xs text-gray-300 font-mono">:{pf.localPort} → {pf.remoteHost}:{pf.remotePort}</span></div>))}</div></div>)}
        {conn.tags.length > 0 && (<div className="mt-6"><h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2"><Tag className="w-4 h-4" /> Tags</h3><div className="flex flex-wrap gap-2">{conn.tags.map((tag: string) => <span key={tag} className={`px-2.5 py-1 rounded-full text-xs ${isDark ? 'bg-[#1e2030] border border-[#2a2b3d] text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{tag}</span>)}</div></div>)}
        {conn.notes && (<div className="mt-6"><h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2"><StickyNote className="w-4 h-4" /> Notes</h3><div className={`p-3 rounded-lg border text-sm whitespace-pre-wrap ${isDark ? 'bg-[#161822] border-[#1e2030] text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>{conn.notes}</div></div>)}
      </div>
    </div>
  );
}

function CmdBlock({ label, command, copied, onCopy, isDark }: any) {
  return (<div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-[#0d0e17] border-[#1e2030]' : 'bg-gray-900 border-gray-700'}`}><div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-gray-800 border-gray-700'}`}><span className="text-[10px] text-gray-400">{label}</span><button onClick={onCopy} className="text-[10px] text-gray-400 hover:text-emerald-400">{copied ? '✓' : 'Copy'}</button></div><code className="block px-3 py-2 text-xs text-emerald-300 font-mono overflow-x-auto">{command}</code></div>);
}

function DCard({ icon, label, value, isDark }: any) {
  return (<div className={`flex items-center gap-3 p-3 rounded-lg border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}><div className={`p-2 rounded-lg ${isDark ? 'bg-[#1e2030]' : 'bg-gray-100'}`}>{icon}</div><div className="flex-1 min-w-0"><p className="text-[10px] text-gray-500">{label}</p><p className={`text-sm truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{value}</p></div></div>);
}

function Toggle({ checked, onChange, isDark }: { checked: boolean; onChange: (v: boolean) => void; isDark: boolean }) {
  return <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${checked ? 'bg-emerald-600' : isDark ? 'bg-[#2a2b3d]' : 'bg-gray-300'}`} onClick={() => onChange(!checked)}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} /></div>;
}

// ============ FILE TRANSFER VIEW ============

function FileTransferView({ connections, isDark, transfers, setTransfers, addToast }: any) {
  const [selectedConn, setSelectedConn] = useState<string>('');
  const [protocol, setProtocol] = useState<'zmodem' | 'scp' | 'sftp' | 'rsync'>('scp');
  const [localPath, setLocalPath] = useState('');
  const [remotePath, setRemotePath] = useState('');
  const [direction, setDirection] = useState<'upload' | 'download'>('upload');

  const conn = connections.find((c: SSHConnection) => c.id === selectedConn);

  const startTransfer = () => {
    if (!conn || !localPath || !remotePath) { addToast('warning', 'Missing Info', 'Fill all fields'); return; }
    const transfer: FileTransfer = {
      id: uuidv4(), connectionId: conn.id, type: direction, protocol,
      localPath, remotePath, fileSize: Math.floor(Math.random() * 100000000),
      transferredSize: 0, status: 'transferring', speed: 0, startedAt: Date.now(),
    };
    setTransfers((prev: FileTransfer[]) => [transfer, ...prev]);
    addToast('info', 'Transfer Started', `${direction === 'upload' ? '↑' : '↓'} ${localPath}`);
    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        clearInterval(interval);
        setTransfers((prev: FileTransfer[]) => prev.map((t: FileTransfer) => t.id === transfer.id ? { ...t, status: 'completed', transferredSize: t.fileSize, speed: t.fileSize / 5, completedAt: Date.now() } : t));
        addToast('success', 'Transfer Complete', `${localPath} transferred successfully`);
      } else {
        setTransfers((prev: FileTransfer[]) => prev.map((t: FileTransfer) => t.id === transfer.id ? { ...t, transferredSize: Math.floor(t.fileSize * progress / 100), speed: Math.floor(Math.random() * 5000000) } : t));
      }
    }, 500);
  };

  const getCommand = () => {
    if (!conn) return '';
    if (protocol === 'zmodem') return generateZmodemCommand(conn);
    if (protocol === 'rsync') return generateRsyncCommand(conn, localPath, remotePath, direction);
    return generateSCPCommand(conn, localPath, remotePath, direction);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>File Transfer</h1>
        <p className="text-sm text-gray-400 mb-6">Transfer files via Zmodem (ZSSH), SCP, SFTP, or Rsync</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Transfer Form */}
          <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
            <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2"><ArrowUpDown className="w-4 h-4 text-emerald-400" /> New Transfer</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-400 mb-1 block">Connection</label><select value={selectedConn} onChange={e => setSelectedConn(e.target.value)} className={inputCls(isDark)}><option value="">Select server...</option>{connections.map((c: SSHConnection) => <option key={c.id} value={c.id}>{c.name} ({c.host})</option>)}</select></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Protocol</label><div className="flex gap-2">{(['zmodem', 'scp', 'sftp', 'rsync'] as const).map(p => <button key={p} onClick={() => setProtocol(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase ${protocol === p ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>{p}</button>)}</div></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Direction</label><div className="flex gap-2"><button onClick={() => setDirection('upload')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs ${direction === 'upload' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}><FileUp className="w-3.5 h-3.5" /> Upload ↑</button><button onClick={() => setDirection('download')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs ${direction === 'download' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}><FileDown className="w-3.5 h-3.5" /> Download ↓</button></div></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Local Path</label><input type="text" value={localPath} onChange={e => setLocalPath(e.target.value)} placeholder="C:\Users\You\file.txt" className={inputCls(isDark)} /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Remote Path</label><input type="text" value={remotePath} onChange={e => setRemotePath(e.target.value)} placeholder="/home/user/file.txt" className={inputCls(isDark)} /></div>
              <button onClick={startTransfer} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2"><Send className="w-4 h-4" /> Start Transfer</button>
            </div>
            {conn && (<div className={`mt-4 p-3 rounded-lg border ${isDark ? 'bg-[#0d0e17] border-[#1e2030]' : 'bg-gray-900 border-gray-700'}`}><p className="text-[10px] text-gray-400 mb-1">Command:</p><code className="text-xs text-emerald-300 font-mono break-all">{getCommand()}</code><button onClick={() => { navigator.clipboard.writeText(getCommand()); addToast('success', 'Copied', 'Command copied'); }} className="mt-1 text-[10px] text-emerald-400">Copy</button></div>)}
          </div>

          {/* Zmodem Info */}
          <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
            <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2"><ArrowUpDown className="w-4 h-4 text-purple-400" /> Zmodem / ZSSH Guide</h3>
            <div className="space-y-3 text-xs text-gray-400">
              <div className={`p-3 rounded-lg ${isDark ? 'bg-[#1e2030]' : 'bg-gray-50'}`}>
                <p className="text-gray-200 font-medium mb-1">What is Zmodem?</p>
                <p>Zmodem is a file transfer protocol that works over SSH connections. Tools like <code className="text-emerald-400">zssh</code>, <code className="text-emerald-400">lrzsz</code>, and <code className="text-emerald-400">rz/sz</code> enable seamless file transfers without needing separate SFTP/SCP sessions.</p>
              </div>
              <div className={`p-3 rounded-lg ${isDark ? 'bg-[#1e2030]' : 'bg-gray-50'}`}>
                <p className="text-gray-200 font-medium mb-1">Setup on Server</p>
                <code className="text-emerald-400 block">sudo apt install lrzsz  # Debian/Ubuntu<br />sudo yum install lrzsz  # CentOS/RHEL</code>
              </div>
              <div className={`p-3 rounded-lg ${isDark ? 'bg-[#1e2030]' : 'bg-gray-50'}`}>
                <p className="text-gray-200 font-medium mb-1">Setup on Windows</p>
                <p>Install <code className="text-emerald-400">zssh</code> via scoop/choco, or use a terminal that supports Zmodem like <code className="text-emerald-400">Tera Term</code> or <code className="text-emerald-400">MobaXterm</code>.</p>
              </div>
              <div className={`p-3 rounded-lg ${isDark ? 'bg-[#1e2030]' : 'bg-gray-50'}`}>
                <p className="text-gray-200 font-medium mb-1">Quick Commands</p>
                <div className="space-y-1 mt-1">
                  <p><code className="text-emerald-400">sz file.txt</code> — Send file to local</p>
                  <p><code className="text-emerald-400">rz</code> — Receive file from local</p>
                  <p><code className="text-emerald-400">sz -be *.log</code> — Batch send</p>
                  <p><code className="text-emerald-400">sz -E file</code> — With error correction</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transfer History */}
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-[#1e2030]' : 'border-gray-200'}`}>
            <h3 className="text-sm font-semibold text-gray-200">Transfer History</h3>
            <span className="text-xs text-gray-500">{transfers.length} transfers</span>
          </div>
          {transfers.length === 0 ? (<div className="p-8 text-center"><ArrowUpDown className="w-8 h-8 text-gray-600 mx-auto mb-2" /><p className="text-sm text-gray-500">No transfers yet</p></div>) : (
            <div className="divide-y divide-[#1e2030]">{transfers.slice(0, 20).map((t: FileTransfer) => {
              const progress = t.fileSize > 0 ? Math.floor((t.transferredSize / t.fileSize) * 100) : 0;
              const connName = connections.find((c: SSHConnection) => c.id === t.connectionId)?.name || 'Unknown';
              return (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-lg ${t.type === 'upload' ? 'text-blue-400' : 'text-purple-400'}`}>{t.type === 'upload' ? '↑' : '↓'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t.localPath.split('\\').pop()}</p>
                      <p className="text-[10px] text-gray-500">{connName} • {t.protocol.toUpperCase()}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${t.status === 'completed' ? 'bg-emerald-600/20 text-emerald-400' : t.status === 'transferring' ? 'bg-blue-600/20 text-blue-400' : t.status === 'failed' ? 'bg-red-600/20 text-red-400' : 'bg-gray-600/20 text-gray-400'}`}>{t.status}</span>
                  </div>
                  {t.status === 'transferring' && (<div className="mt-1"><div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-[#1e2030]' : 'bg-gray-200'}`}><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div><div className="flex justify-between mt-0.5"><span className="text-[10px] text-gray-500">{formatFileSize(t.transferredSize)} / {formatFileSize(t.fileSize)}</span><span className="text-[10px] text-gray-500">{formatFileSize(t.speed)}/s • {progress}%</span></div></div>)}
                </div>
              );
            })}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ GITHUB VIEW ============

function GitHubView({ connections, isDark, setConnections, addToast }: any) {
  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'repos' | 'setup' | 'actions'>('overview');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const githubEnabledConns = connections.filter((c: SSHConnection) => c.githubEnabled);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Github className="w-8 h-8 text-gray-200" />
          <div><h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>GitHub Integration</h1><p className="text-sm text-gray-400">Manage SSH keys, deploy keys, and repository access</p></div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 mb-6 p-1 rounded-lg ${isDark ? 'bg-[#161822]' : 'bg-gray-100'}`}>
          {[{ id: 'overview', label: 'Overview', icon: <BarChart3 className="w-3.5 h-3.5" /> }, { id: 'keys', label: 'SSH Keys', icon: <Key className="w-3.5 h-3.5" /> }, { id: 'repos', label: 'Repositories', icon: <Server className="w-3.5 h-3.5" /> }, { id: 'setup', label: 'Setup Guide', icon: <BookOpen className="w-3.5 h-3.5" /> }, { id: 'actions', label: 'Actions', icon: <Zap className="w-3.5 h-3.5" /> }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${activeTab === t.id ? 'bg-emerald-600/20 text-emerald-400' : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500'}`}>{t.icon} {t.label}</button>
          ))}
        </div>

        {activeTab === 'overview' && (<div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={<Github className="w-5 h-5 text-gray-300" />} label="GitHub Connections" value={githubEnabledConns.length} isDark={isDark} />
            <StatCard icon={<Key className="w-5 h-5 text-amber-400" />} label="Deploy Keys" value={githubEnabledConns.reduce((a: number, c: SSHConnection) => a + (c.githubDeployKeys?.length || 0), 0)} isDark={isDark} />
            <StatCard icon={<Server className="w-5 h-5 text-blue-400" />} label="Linked Repos" value={githubEnabledConns.reduce((a: number, c: SSHConnection) => a + (c.githubRepos?.length || 0), 0)} isDark={isDark} />
          </div>
          <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
            <h3 className="text-sm font-semibold text-gray-200 mb-4">Connected Servers</h3>
            {githubEnabledConns.length === 0 ? <p className="text-sm text-gray-500">No servers with GitHub integration enabled. Enable it in connection settings.</p> : (
              <div className="space-y-2">{githubEnabledConns.map((c: SSHConnection) => (<div key={c.id} className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-[#1e2030]' : 'bg-gray-50'}`}><div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} /><div className="flex-1"><p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{c.name}</p><p className="text-xs text-gray-500">{c.host}</p></div><div className="flex gap-2"><span className="text-[10px] px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded">{c.githubRepos?.length || 0} repos</span><span className="text-[10px] px-2 py-0.5 bg-amber-600/20 text-amber-400 rounded">{c.githubDeployKeys?.length || 0} keys</span></div></div>))}</div>
            )}
          </div>
        </div>)}

        {activeTab === 'keys' && (<div className="space-y-6">
          <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
            <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2"><Fingerprint className="w-4 h-4 text-emerald-400" /> SSH Key Management</h3>
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${isDark ? 'bg-[#0d0e17] border-[#1e2030]' : 'bg-gray-900 border-gray-700'}`}>
                <p className="text-xs text-gray-400 mb-2">Generate a new SSH key for GitHub:</p>
                <code className="text-xs text-emerald-300 font-mono block">{generateGitHubSSHKeyCommand()}</code>
                <button onClick={() => { navigator.clipboard.writeText(generateGitHubSSHKeyCommand()); addToast('success', 'Copied', 'Command copied'); }} className="mt-2 text-xs text-emerald-400">Copy</button>
              </div>
              <div className={`p-4 rounded-lg border ${isDark ? 'bg-[#0d0e17] border-[#1e2030]' : 'bg-gray-900 border-gray-700'}`}>
                <p className="text-xs text-gray-400 mb-2">Add key to SSH agent:</p>
                <code className="text-xs text-emerald-300 font-mono block whitespace-pre">{generateGitHubAddKeyCommand()}</code>
                <button onClick={() => { navigator.clipboard.writeText(generateGitHubAddKeyCommand()); addToast('success', 'Copied', 'Command copied'); }} className="mt-2 text-xs text-emerald-400">Copy</button>
              </div>
              <div className={`p-4 rounded-lg border ${isDark ? 'bg-[#0d0e17] border-[#1e2030]' : 'bg-gray-900 border-gray-700'}`}>
                <p className="text-xs text-gray-400 mb-2">Test connection:</p>
                <code className="text-xs text-emerald-300 font-mono block">{generateGitHubTestCommand()}</code>
                <button onClick={() => { navigator.clipboard.writeText(generateGitHubTestCommand()); addToast('success', 'Copied', 'Command copied'); }} className="mt-2 text-xs text-emerald-400">Copy</button>
              </div>
            </div>
          </div>
          <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
            <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-blue-400" /> Deploy Keys by Server</h3>
            {githubEnabledConns.length === 0 ? <p className="text-sm text-gray-500">No deploy keys configured</p> : (
              <div className="space-y-4">{githubEnabledConns.map((c: SSHConnection) => (<div key={c.id}><p className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{c.name}</p>{(c.githubDeployKeys || []).length === 0 ? <p className="text-xs text-gray-500 italic ml-2">No deploy keys</p> : (c.githubDeployKeys || []).map((dk: DeployKey) => (<div key={dk.id} className={`flex items-center gap-3 p-2 rounded-lg ml-2 mb-1 ${isDark ? 'bg-[#1e2030]' : 'bg-gray-50'}`}><KeyRound className="w-3.5 h-3.5 text-amber-400" /><div className="flex-1"><p className="text-xs text-gray-300">{dk.title}</p><p className="text-[10px] text-gray-500 font-mono truncate">{dk.key}</p></div><span className={`text-[10px] px-1.5 py-0.5 rounded ${dk.readOnly ? 'bg-blue-600/20 text-blue-400' : 'bg-emerald-600/20 text-emerald-400'}`}>{dk.readOnly ? 'Read' : 'R/W'}</span></div>))}</div>))}</div>
            )}
          </div>
        </div>)}

        {activeTab === 'repos' && (<div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
          <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2"><Server className="w-4 h-4 text-blue-400" /> Linked Repositories</h3>
          {githubEnabledConns.length === 0 ? <p className="text-sm text-gray-500">No repositories linked</p> : (
            <div className="space-y-3">{githubEnabledConns.map((c: SSHConnection) => (c.githubRepos || []).length > 0 && (<div key={c.id}><p className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{c.name}</p><div className="space-y-1 ml-2">{(c.githubRepos || []).map((repo: string) => (<div key={repo} className={`flex items-center gap-3 p-2.5 rounded-lg ${isDark ? 'bg-[#1e2030]' : 'bg-gray-50'}`}><Github className="w-4 h-4 text-gray-400" /><div className="flex-1"><p className="text-sm text-gray-200">{repo}</p><p className="text-[10px] text-gray-500 font-mono">git@github.com:{repo}.git</p></div><button onClick={() => { navigator.clipboard.writeText(`git@github.com:${repo}.git`); addToast('success', 'Copied', 'Clone URL copied'); }} className="text-xs text-emerald-400 hover:text-emerald-300">Clone URL</button></div>))}</div></div>))}</div>
          )}
        </div>)}

        {activeTab === 'setup' && (<div className="space-y-4">
          <DocSection title="1. Generate SSH Key" isDark={isDark}><p className="text-sm text-gray-400 mb-2">Generate an ED25519 SSH key (recommended) or RSA key:</p><CodeBlock code="ssh-keygen -t ed25519 -C &quot;your_email@example.com&quot;" isDark={isDark} /></DocSection>
          <DocSection title="2. Add Key to SSH Agent" isDark={isDark}><CodeBlock code={`eval "$(ssh-agent -s)"\nssh-add ~/.ssh/id_ed25519`} isDark={isDark} /></DocSection>
          <DocSection title="3. Add Key to GitHub" isDark={isDark}><p className="text-sm text-gray-400 mb-2">Copy your public key:</p><CodeBlock code="cat ~/.ssh/id_ed25519.pub" isDark={isDark} /><p className="text-sm text-gray-400 mt-2">Then go to GitHub → Settings → SSH and GPG keys → New SSH key</p></DocSection>
          <DocSection title="4. Test Connection" isDark={isDark}><CodeBlock code="ssh -T git@github.com" isDark={isDark} /><p className="text-sm text-gray-400 mt-2">Expected output: <code className="text-emerald-400">Hi username! You've successfully authenticated...</code></p></DocSection>
          <DocSection title="5. Configure SSH Config" isDark={isDark}><p className="text-sm text-gray-400 mb-2">Add to <code className="text-emerald-400">~/.ssh/config</code>:</p><CodeBlock code={`Host github.com\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/id_ed25519\n  IdentitiesOnly yes`} isDark={isDark} /></DocSection>
          <DocSection title="6. Deploy Keys (per-repo)" isDark={isDark}><p className="text-sm text-gray-400 mb-2">For read-only access to specific repos, use deploy keys:</p><CodeBlock code={`# Generate separate key\ncp ~/.ssh/id_ed25519 ~/.ssh/deploy_key\n# Add to repo: Settings → Deploy keys → Add deploy key`} isDark={isDark} /></DocSection>
          <DocSection title="7. GitHub CLI (Optional)" isDark={isDark}><CodeBlock code={`# Install GitHub CLI\nwinget install GitHub.cli\n# Authenticate\ngh auth login\n# Clone with SSH\ngh repo clone owner/repo`} isDark={isDark} /></DocSection>
        </div>)}

        {activeTab === 'actions' && (<div className="space-y-4">
          <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
            <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> GitHub Actions SSH Deploy</h3>
            <CodeBlock code={`name: Deploy via SSH
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: \${{ secrets.SSH_HOST }}
          username: \${{ secrets.SSH_USER }}
          key: \${{ secrets.SSH_KEY }}
          port: \${{ secrets.SSH_PORT }}
          script: |
            cd /app
            git pull origin main
            docker compose up -d --build`} isDark={isDark} />
          </div>
          <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
            <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2"><GitPullRequest className="w-4 h-4 text-purple-400" /> Webhook-Triggered Deploy</h3>
            <CodeBlock code={`# webhook-deploy.sh
#!/bin/bash
REPO_PATH="/var/www/app"
cd $REPO_PATH
git fetch origin
git reset --hard origin/main
npm install --production
pm2 restart app`} isDark={isDark} />
          </div>
        </div>)}
      </div>
    </div>
  );
}

function DocSection({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
  return <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}><h3 className="text-sm font-semibold text-gray-200 mb-3">{title}</h3>{children}</div>;
}

function CodeBlock({ code, isDark }: { code: string; isDark: boolean }) {
  return <div className={`p-3 rounded-lg font-mono text-xs overflow-x-auto ${isDark ? 'bg-[#0d0e17] text-emerald-300' : 'bg-gray-900 text-emerald-300'}`}><pre className="whitespace-pre-wrap">{code}</pre></div>;
}

function StatCard({ icon, label, value, isDark }: any) {
  return <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}><div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-gray-400">{label}</span></div><p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p></div>;
}

// ============ DOCS VIEW ============

function DocsView({ isDark }: { isDark: boolean }) {
  const [section, setSection] = useState('getting-started');
  const sections = [
    { id: 'getting-started', label: 'Getting Started', icon: <Lightbulb className="w-4 h-4" /> },
    { id: 'connections', label: 'Connections', icon: <Server className="w-4 h-4" /> },
    { id: 'zmodem', label: 'Zmodem / ZSSH', icon: <ArrowUpDown className="w-4 h-4" /> },
    { id: 'github', label: 'GitHub Integration', icon: <Github className="w-4 h-4" /> },
    { id: 'file-transfer', label: 'File Transfer', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'port-forwarding', label: 'Port Forwarding', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'key-management', label: 'Key Management', icon: <Key className="w-4 h-4" /> },
    { id: 'scripts', label: 'Scripts & Automation', icon: <FileCode className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'faq', label: 'FAQ', icon: <FileQuestion className="w-4 h-4" /> },
  ];

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Docs Sidebar */}
      <div className={`w-56 border-r overflow-y-auto p-3 ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 px-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Documentation</h3>
        <div className="space-y-0.5">{sections.map(s => <button key={s.id} onClick={() => setSection(s.id)} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${section === s.id ? 'bg-emerald-600/20 text-emerald-400' : isDark ? 'text-gray-400 hover:bg-[#1e2030]' : 'text-gray-500 hover:bg-gray-100'}`}>{s.icon} {s.label}</button>)}</div>
      </div>

      {/* Docs Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">
          {section === 'getting-started' && (<><h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Getting Started</h1>
          <div className="space-y-4 text-sm text-gray-400">
            <p>Welcome to <strong className="text-emerald-400">SSH Manager Pro</strong> — a comprehensive multi-SSH connection manager for Windows. This guide will help you get started quickly.</p>
            <DocSection title="Quick Start" isDark={isDark}><ol className="list-decimal list-inside space-y-2"><li>Click the <strong className="text-gray-200">+ New</strong> button or press <kbd className="px-1.5 py-0.5 bg-[#1e2030] rounded text-xs text-gray-300">Ctrl+N</kbd></li><li>Fill in connection details (host, port, username)</li><li>Select authentication method (key, password, agent)</li><li>Optionally configure port forwarding, Zmodem, or GitHub integration</li><li>Click <strong className="text-gray-200">Save</strong> — your connection is ready!</li></ol></DocSection>
            <DocSection title="Key Features" isDark={isDark}><div className="grid grid-cols-2 gap-3"><FeatureCard icon={<Server className="w-4 h-4 text-emerald-400" />} title="Multi-Protocol" desc="SSH, SFTP, SCP, RDP, Telnet, Serial" isDark={isDark} /><FeatureCard icon={<ArrowUpDown className="w-4 h-4 text-purple-400" />} title="Zmodem/ZSSH" desc="File transfer over SSH sessions" isDark={isDark} /><FeatureCard icon={<Github className="w-4 h-4 text-gray-300" />} title="GitHub Integration" desc="SSH keys, deploy keys, repos" isDark={isDark} /><FeatureCard icon={<GitBranch className="w-4 h-4 text-blue-400" />} title="Port Forwarding" desc="Local, remote, dynamic tunnels" isDark={isDark} /><FeatureCard icon={<Radio className="w-4 h-4 text-amber-400" />} title="Network Scanner" desc="Discover hosts on your network" isDark={isDark} /><FeatureCard icon={<FileCode className="w-4 h-4 text-cyan-400" />} title="Script Generator" desc="BAT, PowerShell, Shell scripts" isDark={isDark} /></div></DocSection>
            <DocSection title="Keyboard Shortcuts" isDark={isDark}><div className="space-y-1">{KEYBOARD_SHORTCUTS.map(s => <div key={s.action} className="flex items-center justify-between py-1"><span className="text-gray-300">{s.description}</span><kbd className="px-2 py-0.5 bg-[#1e2030] rounded text-xs text-gray-300 font-mono">{s.keys}</kbd></div>)}</div></DocSection>
          </div></>)}

          {section === 'connections' && (<><h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Managing Connections</h1><div className="space-y-4 text-sm text-gray-400">
            <DocSection title="Connection Types" isDark={isDark}><div className="space-y-2"><p><strong className="text-emerald-400">SSH</strong> — Standard Secure Shell connection for terminal access</p><p><strong className="text-emerald-400">SFTP</strong> — SSH File Transfer Protocol for secure file operations</p><p><strong className="text-emerald-400">SCP</strong> — Secure Copy Protocol for one-time file transfers</p><p><strong className="text-emerald-400">RDP</strong> — Remote Desktop Protocol for Windows machines</p><p><strong className="text-emerald-400">Telnet</strong> — Unencrypted terminal (legacy systems)</p><p><strong className="text-emerald-400">Serial</strong> — COM port connections for IoT/embedded devices</p></div></DocSection>
            <DocSection title="Authentication Methods" isDark={isDark}><div className="space-y-2"><p><strong className="text-amber-400">SSH Key</strong> — Most secure. Uses public/private key pairs. Supports RSA, ED25519, ECDSA.</p><p><strong className="text-amber-400">Password</strong> — Traditional username/password authentication.</p><p><strong className="text-amber-400">SSH Agent</strong> — Uses a running ssh-agent for key management. Best for multiple keys.</p><p><strong className="text-amber-400">Certificate</strong> — SSH certificate-based authentication for enterprise environments.</p></div></DocSection>
            <DocSection title="Groups & Organization" isDark={isDark}><p>Organize connections into groups with custom icons and colors. Groups can represent environments (Production, Staging, Development), teams, or projects. Use the sidebar to navigate between groups.</p></DocSection>
            <DocSection title="Batch Operations" isDark={isDark}><p>Enable batch mode (layers icon) to select multiple connections. You can then connect to all selected servers simultaneously or delete them in bulk.</p></DocSection>
          </div></>)}

          {section === 'zmodem' && (<><h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Zmodem / ZSSH File Transfer</h1><div className="space-y-4 text-sm text-gray-400">
            <DocSection title="What is Zmodem?" isDark={isDark}><p>Zmodem is a file transfer protocol that operates directly within an SSH session. Unlike SCP or SFTP which require separate connections, Zmodem transfers files through the existing terminal session using the <code className="text-emerald-400">rz</code> (receive) and <code className="text-emerald-400">sz</code> (send) commands.</p></DocSection>
            <DocSection title="What is ZSSH?" isDark={isDark}><p>ZSSH (Zmodem SSH) is a specialized SSH client that supports Zmodem file transfers. It intercepts Zmodem transfer negotiations and handles file transfers automatically. On Windows, alternatives include Tera Term, MobaXterm, or using <code className="text-emerald-400">lrzsz</code> with a compatible terminal.</p></DocSection>
            <DocSection title="Server Setup" isDark={isDark}><CodeBlock code={`# Debian/Ubuntu\nsudo apt update && sudo apt install lrzsz\n\n# CentOS/RHEL\nsudo yum install lrzsz\n\n# Verify installation\nwhich rz sz`} isDark={isDark} /></DocSection>
            <DocSection title="Windows Client Setup" isDark={isDark}><div className="space-y-2"><p><strong className="text-gray-200">Option 1: Using zssh</strong></p><CodeBlock code={`# Install via scoop\nscoop install zssh\n\n# Connect with Zmodem support\nzssh user@host`} isDark={isDark} /><p className="mt-2"><strong className="text-gray-200">Option 2: Using Tera Term</strong></p><p>Tera Term has built-in Zmodem support. Enable it in Setup → Transfer → Zmodem.</p><p className="mt-2"><strong className="text-gray-200">Option 3: Using MobaXterm</strong></p><p>MobaXterm automatically handles Zmodem transfers when detected in the session.</p></div></DocSection>
            <DocSection title="Transfer Commands" isDark={isDark}><div className="space-y-3"><p><strong className="text-gray-200">Send file from server to local:</strong></p><CodeBlock code="sz filename.txt" isDark={isDark} /><p><strong className="text-gray-200">Receive file from local to server:</strong></p><CodeBlock code="rz" isDark={isDark} /><p><strong className="text-gray-200">Batch send multiple files:</strong></p><CodeBlock code="sz -be file1.txt file2.log archive.tar.gz" isDark={isDark} /><p><strong className="text-gray-200">Send with error correction:</strong></p><CodeBlock code="sz -E important_data.csv" isDark={isDark} /><p><strong className="text-gray-200">Send directory (as tar):</strong></p><CodeBlock code="tar czf - /path/to/dir | sz -be" isDark={isDark} /></div></DocSection>
            <DocSection title="Zmodem Options" isDark={isDark}><div className="space-y-1"><p><code className="text-emerald-400">-b</code> — Binary mode (required for non-text files)</p><p><code className="text-emerald-400">-e</code> — Escape all control characters</p><p><code className="text-emerald-400">-E</code> — Enable error correction</p><p><code className="text-emerald-400">-a</code> — ASCII mode (text files only)</p><p><code className="text-emerald-400">-B NUM</code> — Set buffer size</p></div></DocSection>
            <DocSection title="In SSH Manager Pro" isDark={isDark}><p>Each connection has a Zmodem tab where you can:</p><ul className="list-disc list-inside space-y-1 mt-2"><li>Enable/disable Zmodem support</li><li>Configure auto-receive behavior</li><li>Set buffer size for optimal transfer speed</li><li>View the generated ZSSH connection command</li><li>Track file transfer history and progress</li></ul></DocSection>
          </div></>)}

          {section === 'github' && (<><h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>GitHub Integration</h1><div className="space-y-4 text-sm text-gray-400">
            <DocSection title="Overview" isDark={isDark}><p>SSH Manager Pro integrates with GitHub to help you manage SSH keys, deploy keys, and repository access across your servers. This is especially useful for CI/CD servers, deployment machines, and development environments.</p></DocSection>
            <DocSection title="SSH Keys for GitHub" isDark={isDark}><p>Generate and manage SSH keys that authenticate with GitHub. Each connection can have its own key pair, or you can share keys across servers using SSH agent forwarding.</p><CodeBlock code={`# Generate key\nssh-keygen -t ed25519 -C "deploy@server"\n\n# Add to agent\neval "$(ssh-agent -s)"\nssh-add ~/.ssh/id_ed25519\n\n# Test\nssh -T git@github.com`} isDark={isDark} /></DocSection>
            <DocSection title="Deploy Keys" isDark={isDark}><p>Deploy keys are SSH keys that grant access to a single GitHub repository. They're ideal for servers that need read-only (or read/write) access to specific repos.</p><CodeBlock code={`# Generate a deploy key\nssh-keygen -t ed25519 -C "deploy-key" -f ~/.ssh/deploy_key\n\n# Add to GitHub:\n# Repository → Settings → Deploy keys → Add deploy key\n# Paste contents of ~/.ssh/deploy_key.pub`} isDark={isDark} /></DocSection>
            <DocSection title="GitHub Actions Integration" isDark={isDark}><p>Use SSH Manager Pro to manage servers that are deployed via GitHub Actions. Store the SSH connection details alongside the GitHub repo information for easy reference.</p><CodeBlock code={`# .github/workflows/deploy.yml\nname: Deploy\non:\n  push:\n    branches: [main]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Deploy\n        uses: appleboy/ssh-action@v1.0.0\n        with:\n          host: \${{ secrets.HOST }}\n          username: \${{ secrets.USER }}\n          key: \${{ secrets.SSH_KEY }}\n          script: |\n            cd /app && git pull && docker compose up -d`} isDark={isDark} /></DocSection>
            <DocSection title="Webhooks" isDark={isDark}><p>Configure webhooks to trigger deployments when code is pushed. SSH Manager Pro can store webhook URLs and secrets alongside your connection details.</p></DocSection>
          </div></>)}

          {section === 'file-transfer' && (<><h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>File Transfer</h1><div className="space-y-4 text-sm text-gray-400">
            <DocSection title="Transfer Methods" isDark={isDark}><div className="space-y-3"><p><strong className="text-emerald-400">SCP (Secure Copy)</strong> — One-time file transfers over SSH. Simple and widely supported.</p><CodeBlock code={`# Upload\nscp local_file.txt user@host:/remote/path/\n# Download\nscp user@host:/remote/file.txt ./local/`} isDark={isDark} /><p><strong className="text-emerald-400">SFTP (SSH File Transfer Protocol)</strong> — Interactive file management with directory browsing.</p><CodeBlock code={`sftp user@host\nsftp> put local_file.txt\nsftp> get remote_file.txt\nsftp> ls\nsftp> cd /path`} isDark={isDark} /><p><strong className="text-emerald-400">Rsync</strong> — Efficient sync with delta transfers. Best for large directories.</p><CodeBlock code={`# Sync directory\nrsync -avz -e "ssh -p 22" ./local/ user@host:/remote/\n# Dry run\nrsync -avzn ./local/ user@host:/remote/`} isDark={isDark} /><p><strong className="text-emerald-400">Zmodem</strong> — Transfer within SSH session. See Zmodem/ZSSH section.</p></div></DocSection>
            <DocSection title="Using File Transfer in SSH Manager" isDark={isDark}><p>Navigate to the File Transfer view (Ctrl+T) to:</p><ul className="list-disc list-inside space-y-1 mt-2"><li>Select a connection from your saved servers</li><li>Choose protocol (Zmodem, SCP, SFTP, Rsync)</li><li>Set upload or download direction</li><li>Specify local and remote paths</li><li>View the generated command</li><li>Track transfer progress and history</li></ul></DocSection>
          </div></>)}

          {section === 'port-forwarding' && (<><h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Port Forwarding</h1><div className="space-y-4 text-sm text-gray-400">
            <DocSection title="Local Port Forwarding (-L)" isDark={isDark}><p>Forward a local port to a remote server. Useful for accessing services behind a firewall.</p><CodeBlock code={`ssh -L 8080:localhost:80 user@host\n# Now access http://localhost:8080 to reach port 80 on the remote server`} isDark={isDark} /></DocSection>
            <DocSection title="Remote Port Forwarding (-R)" isDark={isDark}><p>Forward a remote port to your local machine. Useful for exposing local services.</p><CodeBlock code={`ssh -R 9090:localhost:3000 user@host\n# Remote server's port 9090 now forwards to your local port 3000`} isDark={isDark} /></DocSection>
            <DocSection title="Dynamic Port Forwarding (-D)" isDark={isDark}><p>Create a SOCKS proxy for routing all traffic through the SSH connection.</p><CodeBlock code={`ssh -D 1080 user@host\n# Configure browser/system to use SOCKS proxy at localhost:1080`} isDark={isDark} /></DocSection>
            <DocSection title="In SSH Manager Pro" isDark={isDark}><p>Configure tunnels in the connection form's "Tunnels" tab. Multiple tunnels can be defined per connection and are included in the generated SSH command.</p></DocSection>
          </div></>)}

          {section === 'key-management' && (<><h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>SSH Key Management</h1><div className="space-y-4 text-sm text-gray-400">
            <DocSection title="Key Types" isDark={isDark}><div className="space-y-2"><p><strong className="text-emerald-400">ED25519</strong> — Recommended. Fast, secure, small keys. Best for new setups.</p><p><strong className="text-emerald-400">RSA</strong> — Widely compatible. Use 4096 bits minimum for security.</p><p><strong className="text-emerald-400">ECDSA</strong> — Good balance of speed and compatibility.</p></div></DocSection>
            <DocSection title="Generate Keys" isDark={isDark}><p>Use the built-in Key Generator (nav rail) or run:</p><CodeBlock code={`# ED25519 (recommended)\nssh-keygen -t ed25519 -C "your@email.com"\n\n# RSA 4096-bit\nssh-keygen -t rsa -b 4096 -C "your@email.com"\n\n# ECDSA\nssh-keygen -t ecdsa -b 521 -C "your@email.com"`} isDark={isDark} /></DocSection>
            <DocSection title="SSH Agent" isDark={isDark}><p>The SSH agent stores decrypted keys in memory, avoiding repeated passphrase entry.</p><CodeBlock code={`# Start agent (Windows)\nssh-agent -s\n\n# Add key\nssh-add ~/.ssh/id_ed25519\n\n# List loaded keys\nssh-add -l\n\n# Remove all\nssh-add -D`} isDark={isDark} /></DocSection>
            <DocSection title="SSH Config File" isDark={isDark}><p>Simplify connections with <code className="text-emerald-400">~/.ssh/config</code>:</p><CodeBlock code={`Host myserver\n    HostName 10.0.1.50\n    User deploy\n    IdentityFile ~/.ssh/prod_key\n    Port 22\n    ForwardAgent yes\n\nHost *.internal.com\n    User admin\n    ProxyJump gateway.internal.com`} isDark={isDark} /><p className="mt-2">Import this file directly into SSH Manager Pro using the import button!</p></DocSection>
          </div></>)}

          {section === 'scripts' && (<><h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Scripts & Automation</h1><div className="space-y-4 text-sm text-gray-400">
            <DocSection title="Batch Script (.BAT)" isDark={isDark}><p>Generate Windows batch files that open multiple SSH connections simultaneously.</p><CodeBlock code={`@echo off\nstart "Server 1" cmd /k "ssh user@host1"\nstart "Server 2" cmd /k "ssh user@host2"\necho All connections launched!\npause`} isDark={isDark} /></DocSection>
            <DocSection title="PowerShell Script (.PS1)" isDark={isDark}><p>Generate PowerShell scripts that use Windows Terminal for tabbed connections.</p><CodeBlock code={`Start-Process wt -ArgumentList 'new-tab --title "Server 1" ssh user@host1'\nStart-Process wt -ArgumentList 'new-tab --title "Server 2" ssh user@host2'`} isDark={isDark} /></DocSection>
            <DocSection title="Command Snippets" isDark={isDark}><p>Save frequently used commands in the Snippets view (Ctrl+Shift+S). Copy them to clipboard with one click.</p></DocSection>
            <DocSection title="Startup Commands" isDark={isDark}><p>Configure commands that automatically run when connecting. Useful for setting up your environment:</p><CodeBlock code={`export PATH=$PATH:/custom/bin\ncd /workspace\nsource .env\ntmux attach || tmux new`} isDark={isDark} /></DocSection>
          </div></>)}

          {section === 'security' && (<><h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Security Best Practices</h1><div className="space-y-4 text-sm text-gray-400">
            <DocSection title="Key Security" isDark={isDark}><ul className="list-disc list-inside space-y-1"><li>Use ED25519 keys when possible</li><li>Always protect private keys with passphrases</li><li>Never share or commit private keys</li><li>Use separate keys for different environments</li><li>Rotate keys periodically</li></ul></DocSection>
            <DocSection title="Connection Security" isDark={isDark}><ul className="list-disc list-inside space-y-1"><li>Use SSH keys instead of passwords</li><li>Disable password authentication on servers</li><li>Use jump hosts for internal servers</li><li>Set connection timeouts to prevent idle sessions</li><li>Enable keep-alive to detect dead connections</li></ul></DocSection>
            <DocSection title="Data Protection" isDark={isDark}><ul className="list-disc list-inside space-y-1"><li>Connection data is stored in browser localStorage</li><li>Export backups regularly</li><li>Use encrypted storage for sensitive tokens</li><li>Clear history periodically</li></ul></DocSection>
          </div></>)}

          {section === 'faq' && (<><h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>FAQ</h1><div className="space-y-4 text-sm text-gray-400">
            <DocSection title="How do I connect to a server?" isDark={isDark}><p>Select a connection from the sidebar and click "Connect", or use the Quick Connect button. The SSH command is copied to your clipboard — paste it in your terminal.</p></DocSection>
            <DocSection title="Does this app actually connect to servers?" isDark={isDark}><p>SSH Manager Pro generates the correct commands and copies them to your clipboard. The actual connection is handled by your system's SSH client (OpenSSH, PuTTY, Windows Terminal, etc.).</p></DocSection>
            <DocSection title="How do I transfer files with Zmodem?" isDark={isDark}><p>Enable Zmodem in the connection settings. Use <code className="text-emerald-400">sz</code> on the server to send files, or <code className="text-emerald-400">rz</code> to receive. Your terminal must support Zmodem (Tera Term, MobaXterm, or zssh).</p></DocSection>
            <DocSection title="Can I import my SSH config?" isDark={isDark}><p>Yes! Click the file icon in the sidebar to import <code className="text-emerald-400">~/.ssh/config</code>. All hosts will be imported as connections.</p></DocSection>
            <DocSection title="How do I set up GitHub deploy keys?" isDark={isDark}><p>Enable GitHub integration in connection settings, add deploy keys, and link repositories. Use the GitHub view for key management and setup guides.</p></DocSection>
            <DocSection title="Where is my data stored?" isDark={isDark}><p>All data is stored in your browser's localStorage. Use Export to create JSON backups. Data persists between sessions but is browser-specific.</p></DocSection>
          </div></>)}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc, isDark }: any) {
  return <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#1e2030] border-[#2a2b3d]' : 'bg-gray-50 border-gray-200'}`}><div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-medium text-gray-200">{title}</span></div><p className="text-[10px] text-gray-500">{desc}</p></div>;
}

// ============ REMAINING VIEWS ============

function QuickAction({ icon, label, onClick, isDark }: { icon: React.ReactNode; label: string; onClick: () => void; isDark: boolean }) {
  return <button onClick={onClick} className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${isDark ? 'bg-[#161822] border-[#1e2030] hover:border-emerald-500/30 text-gray-300' : 'bg-white border-gray-200 hover:border-emerald-300 text-gray-700'}`}><span className="text-emerald-400">{icon}</span><span className="text-sm font-medium">{label}</span></button>;
}

function Dashboard({ connections, groups, history, isDark, onNavigate }: any) {
  const total = connections.reduce((a: number, c: SSHConnection) => a + c.totalConnections, 0);
  const online = connections.filter((c: SSHConnection) => c.status === 'online').length;
  const fav = connections.filter((c: SSHConnection) => c.favorite).length;
  const gh = connections.filter((c: SSHConnection) => c.githubEnabled).length;
  const zm = connections.filter((c: SSHConnection) => c.zmodemEnabled).length;

  return (<div className="flex-1 overflow-y-auto p-8"><div className="max-w-6xl mx-auto">
    <div className="flex items-center justify-between mb-8"><div><h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Dashboard</h1><p className="text-sm text-gray-400 mt-1">SSH Manager Pro — Complete Overview</p></div></div>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <StatCard icon={<Server className="w-5 h-5 text-emerald-400" />} label="Connections" value={connections.length} isDark={isDark} />
      <StatCard icon={<Activity className="w-5 h-5 text-blue-400" />} label="Total Sessions" value={total} isDark={isDark} />
      <StatCard icon={<Power className="w-5 h-5 text-green-400" />} label="Online" value={online} isDark={isDark} />
      <StatCard icon={<Github className="w-5 h-5 text-gray-300" />} label="GitHub" value={gh} isDark={isDark} />
      <StatCard icon={<ArrowUpDown className="w-5 h-5 text-purple-400" />} label="Zmodem" value={zm} isDark={isDark} />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      <QuickAction icon={<Plus className="w-5 h-5" />} label="New Connection" onClick={() => onNavigate('connections')} isDark={isDark} />
      <QuickAction icon={<ArrowUpDown className="w-5 h-5" />} label="File Transfer" onClick={() => onNavigate('fileTransfer')} isDark={isDark} />
      <QuickAction icon={<Github className="w-5 h-5" />} label="GitHub" onClick={() => onNavigate('github')} isDark={isDark} />
      <QuickAction icon={<BookOpen className="w-5 h-5" />} label="Documentation" onClick={() => onNavigate('docs')} isDark={isDark} />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Groups</h3>
        <div className="space-y-2">{groups.map((g: ConnectionGroup) => { const count = connections.filter((c: SSHConnection) => c.groupId === g.id).length; return (<div key={g.id} className="flex items-center gap-3"><span className="text-lg">{g.icon}</span><div className="flex-1"><div className="flex justify-between"><span className="text-sm text-gray-300">{g.name}</span><span className="text-xs text-gray-500">{count}</span></div><div className={`w-full h-1.5 rounded-full mt-1 ${isDark ? 'bg-[#1e2030]' : 'bg-gray-100'}`}><div className="h-full rounded-full" style={{ width: `${connections.length > 0 ? (count / connections.length) * 100 : 0}%`, backgroundColor: g.color }} /></div></div></div>); })}</div>
      </div>
      <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Recent Activity</h3>
        {history.slice(0, 5).map((h: ConnectionHistory) => (<div key={h.id} className="flex items-center gap-3 py-1.5"><div className={`w-2 h-2 rounded-full ${h.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} /><span className="text-sm text-gray-300 flex-1">{h.connectionName}</span><span className="text-xs text-gray-500">{formatDuration(h.duration)}</span></div>))}
        {history.length === 0 && <p className="text-sm text-gray-500 italic">No activity yet</p>}
      </div>
    </div>
  </div></div>);
}

function HistoryView({ history, isDark, onClear }: any) {
  return (<div className="flex-1 overflow-y-auto p-8"><div className="max-w-4xl mx-auto">
    <div className="flex items-center justify-between mb-6"><h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>History</h1>{history.length > 0 && <button onClick={onClear} className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg">Clear</button>}</div>
    {history.length === 0 ? <div className="text-center py-12"><History className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-500">No history</p></div> : <div className="space-y-2">{history.map((h: ConnectionHistory) => (<div key={h.id} className={`flex items-center gap-4 p-3 rounded-lg border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}><div className={`w-2.5 h-2.5 rounded-full ${h.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} /><div className="flex-1"><p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{h.connectionName}</p><p className="text-xs text-gray-500">{h.host}</p></div><span className="text-xs text-gray-500">{formatDuration(h.duration)}</span><span className="text-xs text-gray-500">{formatDate(h.timestamp)}</span></div>))}</div>}
  </div></div>);
}

function SnippetsView({ snippets, isDark, onSave, onDelete }: any) {
  const [name, setName] = useState(''); const [command, setCommand] = useState(''); const [desc, setDesc] = useState(''); const [copied, setCopied] = useState<string | null>(null);
  const handleSave = () => { if (name && command) { onSave({ id: uuidv4(), name, command, description: desc, tags: [], createdAt: Date.now() }); setName(''); setCommand(''); setDesc(''); } };
  return (<div className="flex-1 overflow-y-auto p-8"><div className="max-w-4xl mx-auto">
    <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Command Snippets</h1>
    <div className={`p-4 rounded-xl border mb-6 ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
      <div className="grid grid-cols-2 gap-3 mb-3"><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name..." className={inputCls(isDark)} /><input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description..." className={inputCls(isDark)} /></div>
      <div className="flex gap-2"><input type="text" value={command} onChange={e => setCommand(e.target.value)} placeholder="Command..." className={`flex-1 font-mono ${inputCls(isDark)}`} /><button onClick={handleSave} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg">Save</button></div>
    </div>
    <div className="space-y-2">{snippets.map((s: CommandSnippet) => (<div key={s.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}><div className="flex-1"><p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{s.name}</p><code className="text-xs text-emerald-400 font-mono">{s.command}</code></div><button onClick={() => { navigator.clipboard.writeText(s.command); setCopied(s.id); setTimeout(() => setCopied(null), 2000); }} className="text-xs text-gray-400">{copied === s.id ? '✓' : 'Copy'}</button><button onClick={() => onDelete(s.id)} className="p-1 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button></div>))}{snippets.length === 0 && <p className="text-center text-gray-500 py-8">No snippets</p>}</div>
  </div></div>);
}

function SettingsView({ settings, isDark, onSave }: any) {
  const [form, setForm] = useState(settings);
  const update = (p: Partial<AppSettings>) => setForm((prev: AppSettings) => ({ ...prev, ...p }));
  return (<div className="flex-1 overflow-y-auto p-8"><div className="max-w-3xl mx-auto">
    <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h1>
    <div className="space-y-6">
      <SettingsSec title="Appearance" isDark={isDark}><div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-gray-400 mb-1 block">Theme</label><div className="flex gap-2"><button onClick={() => update({ theme: 'dark' })} className={`flex-1 px-3 py-2 rounded-lg text-sm ${form.theme === 'dark' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 border-gray-200'}`}>🌙 Dark</button><button onClick={() => update({ theme: 'light' })} className={`flex-1 px-3 py-2 rounded-lg text-sm ${form.theme === 'light' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 border-gray-200'}`}>☀️ Light</button></div></div></div></SettingsSec>
      <SettingsSec title="Zmodem Defaults" isDark={isDark}><div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-gray-400 mb-1 block">Default Download Path</label><input type="text" value={form.zmodemDefaultPath} onChange={e => update({ zmodemDefaultPath: e.target.value })} className={inputCls(isDark)} /></div><div><label className="text-xs text-gray-400 mb-1 block">Max Concurrent</label><input type="number" value={form.zmodemMaxConcurrent} onChange={e => update({ zmodemMaxConcurrent: parseInt(e.target.value) })} className={inputCls(isDark)} /></div></div><label className="flex items-center justify-between mt-3"><span className="text-sm text-gray-300">Auto-accept transfers</span><Toggle checked={form.zmodemAutoAccept} onChange={v => update({ zmodemAutoAccept: v })} isDark={isDark} /></label></SettingsSec>
      <SettingsSec title="GitHub Defaults" isDark={isDark}><div><label className="text-xs text-gray-400 mb-1 block">Default Organization</label><input type="text" value={form.githubDefaultOrg} onChange={e => update({ githubDefaultOrg: e.target.value })} className={inputCls(isDark)} /></div><label className="flex items-center justify-between mt-3"><span className="text-sm text-gray-300">Auto-sync repos</span><Toggle checked={form.githubAutoSync} onChange={v => update({ githubAutoSync: v })} isDark={isDark} /></label></SettingsSec>
      <SettingsSec title="Behavior" isDark={isDark}><div className="space-y-3"><label className="flex items-center justify-between"><span className="text-sm text-gray-300">Confirm delete</span><Toggle checked={form.confirmDelete} onChange={v => update({ confirmDelete: v })} isDark={isDark} /></label><label className="flex items-center justify-between"><span className="text-sm text-gray-300">Auto-save</span><Toggle checked={form.autoSave} onChange={v => update({ autoSave: v })} isDark={isDark} /></label></div></SettingsSec>
      <button onClick={() => onSave(form)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium">Save Settings</button>
    </div>
  </div></div>);
}

function SettingsSec({ title, children, isDark }: any) { return <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}><h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>{children}</div>; }

function KeyGenView({ isDark, addToast }: any) {
  const [keyType, setKeyType] = useState<'rsa' | 'ed25519' | 'ecdsa'>('ed25519');
  const [bits, setBits] = useState(4096);
  const [comment, setComment] = useState('');
  const [generated, setGenerated] = useState(false);
  return (<div className="flex-1 overflow-y-auto p-8"><div className="max-w-3xl mx-auto">
    <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>SSH Key Generator</h1>
    <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
      <div className="grid grid-cols-2 gap-4 mb-4"><div><label className="text-xs text-gray-400 mb-1 block">Key Type</label><div className="flex gap-2">{(['ed25519','rsa','ecdsa'] as const).map(t => <button key={t} onClick={() => setKeyType(t)} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium uppercase ${keyType === t ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{t}</button>)}</div></div>{keyType === 'rsa' && <div><label className="text-xs text-gray-400 mb-1 block">Bits</label><select value={bits} onChange={e => setBits(parseInt(e.target.value))} className={inputCls(isDark)}><option value={2048}>2048</option><option value={3072}>3072</option><option value={4096}>4096</option></select></div>}</div>
      <div className="mb-4"><label className="text-xs text-gray-400 mb-1 block">Comment</label><input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="user@example.com" className={inputCls(isDark)} /></div>
      <button onClick={() => { setGenerated(true); addToast('success', 'Generated', `${keyType.toUpperCase()} key pair ready`); }} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium flex items-center justify-center gap-2"><Key className="w-4 h-4" /> Generate</button>
      {generated && <div className="mt-4 space-y-3"><div className={`p-3 rounded-lg ${isDark ? 'bg-[#0d0e17]' : 'bg-gray-900'}`}><p className="text-[10px] text-gray-400 mb-1">Command:</p><code className="text-xs text-emerald-300 font-mono">ssh-keygen -t {keyType}{keyType === 'rsa' ? ` -b ${bits}` : ''} -C "{comment || 'email@example.com'}"</code><button onClick={() => { navigator.clipboard.writeText(`ssh-keygen -t ${keyType}${keyType === 'rsa' ? ` -b ${bits}` : ''} -C "${comment}"`); addToast('success', 'Copied', 'Command copied'); }} className="mt-1 text-[10px] text-emerald-400">Copy</button></div></div>}
    </div>
  </div></div>);
}

function ScannerView({ isDark, addToast, onImport }: any) {
  const [subnet, setSubnet] = useState('192.168.1'); const [port, setPort] = useState(22); const [scanning, setScanning] = useState(false); const [results, setResults] = useState<{ ip: string; open: boolean }[]>([]);
  const handleScan = () => { setScanning(true); setResults([]); const ips = Array.from({ length: 20 }, (_, i) => `${subnet}.${i + 1}`); let idx = 0; const interval = setInterval(() => { if (idx >= ips.length) { clearInterval(interval); setScanning(false); return; } setResults(prev => [...prev, { ip: ips[idx], open: Math.random() > 0.7 }]); idx++; }, 200); };
  return (<div className="flex-1 overflow-y-auto p-8"><div className="max-w-4xl mx-auto">
    <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Network Scanner</h1>
    <div className={`p-5 rounded-xl border mb-6 ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
      <div className="flex gap-3 items-end"><div className="flex-1"><label className="text-xs text-gray-400 mb-1 block">Subnet</label><input type="text" value={subnet} onChange={e => setSubnet(e.target.value)} className={inputCls(isDark)} /></div><div className="w-24"><label className="text-xs text-gray-400 mb-1 block">Port</label><input type="number" value={port} onChange={e => setPort(parseInt(e.target.value))} className={inputCls(isDark)} /></div><button onClick={handleScan} disabled={scanning} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-white text-sm flex items-center gap-2">{scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}{scanning ? 'Scanning...' : 'Scan'}</button></div>
    </div>
    {results.length > 0 && <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}><div className={`px-4 py-3 border-b ${isDark ? 'border-[#1e2030]' : 'border-gray-200'}`}><span className="text-sm text-gray-300">Results ({results.filter(r => r.open).length} open)</span></div><div className="max-h-96 overflow-y-auto">{results.map((r, i) => <div key={i} className={`flex items-center gap-3 px-4 py-2 border-b last:border-0 ${isDark ? 'border-[#1e2030]' : 'border-gray-100'}`}><div className={`w-2 h-2 rounded-full ${r.open ? 'bg-emerald-400' : 'bg-gray-600'}`} /><span className={`text-sm font-mono flex-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{r.ip}</span><span className="text-xs text-gray-500">{r.open ? `Port ${port} open` : 'Closed'}</span></div>)}</div></div>}
  </div></div>);
}

function ScriptsView({ connections, isDark, addToast }: any) {
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [scriptType, setScriptType] = useState<'bat' | 'ps1' | 'ssh'>('bat');
  const toggle = (id: string) => { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const generate = () => { const conns = connections.filter((c: SSHConnection) => selected.has(c.id)); if (conns.length === 0) { addToast('warning', 'Select', 'Choose connections'); return; } let script = ''; if (scriptType === 'bat') script = generateBatchScript(conns); else if (scriptType === 'ps1') script = generatePowerShellScript(conns); else script = conns.map((c: SSHConnection) => generateSSHCommand(c)).join('\n'); const blob = new Blob([script], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `ssh-connect.${scriptType === 'bat' ? 'bat' : scriptType === 'ps1' ? 'ps1' : 'sh'}`; a.click(); URL.revokeObjectURL(url); addToast('success', 'Generated', `Script with ${conns.length} connections`); };
  return (<div className="flex-1 overflow-y-auto p-8"><div className="max-w-4xl mx-auto">
    <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Script Generator</h1>
    <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-4 mb-4"><span className="text-sm text-gray-400">Type:</span>{(['bat','ps1','ssh'] as const).map(t => <button key={t} onClick={() => setScriptType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase ${scriptType === t ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : isDark ? 'bg-[#1e2030] text-gray-400 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{t === 'bat' ? '.BAT' : t === 'ps1' ? '.PS1' : '.SH'}</button>)}</div>
      <p className="text-xs text-gray-400 mb-3">Select connections ({selected.size}):</p>
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">{connections.map((c: SSHConnection) => <label key={c.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${selected.has(c.id) ? 'bg-emerald-600/10 border border-emerald-500/30' : isDark ? 'border border-transparent hover:bg-[#1e2030]' : 'hover:bg-gray-50'}`}><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="rounded" /><div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} /><span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{c.name}</span></label>)}</div>
      <button onClick={generate} className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium flex items-center justify-center gap-2"><FileCode className="w-4 h-4" /> Generate Script</button>
    </div>
  </div></div>);
}

function ShortcutsView({ isDark }: { isDark: boolean }) {
  return (<div className="flex-1 overflow-y-auto p-8"><div className="max-w-3xl mx-auto">
    <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Keyboard Shortcuts</h1>
    <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-[#161822] border-[#1e2030]' : 'bg-white border-gray-200'}`}>{KEYBOARD_SHORTCUTS.map((s, i) => <div key={i} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? `border-t ${isDark ? 'border-[#1e2030]' : 'border-gray-100'}` : ''}`}><span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{s.description}</span><kbd className={`px-2 py-1 rounded text-xs font-mono ${isDark ? 'bg-[#1e2030] text-gray-300 border border-[#2a2b3d]' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>{s.keys}</kbd></div>)}</div>
  </div></div>);
}

function TemplatesView({ isDark, onApply }: any) {
  return (<div className="flex-1 overflow-y-auto p-8"><div className="max-w-4xl mx-auto">
    <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Templates</h1><p className="text-sm text-gray-400 mb-6">Pre-configured connection templates</p>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{CONNECTION_TEMPLATES.map((t, i) => <button key={i} onClick={() => onApply(t)} className={`p-4 rounded-xl border text-left ${isDark ? 'bg-[#161822] border-[#1e2030] hover:border-emerald-500/30' : 'bg-white border-gray-200 hover:border-emerald-300'}`}><p className={`text-sm font-semibold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t.name}</p><p className="text-xs text-gray-500">{t.username}@{t.host || '<host>'}:{t.port}</p><div className="flex flex-wrap gap-1 mt-2">{t.tags?.map(tag => <span key={tag} className="px-1.5 py-0.5 bg-emerald-600/10 text-emerald-400 text-[10px] rounded">{tag}</span>)}</div><span className="text-[10px] text-gray-500 mt-2 block uppercase">{t.protocol}</span></button>)}</div>
  </div></div>);
}

function WelcomeScreen({ isDark, onNew, count }: any) {
  return (<div className="flex-1 flex items-center justify-center p-8"><div className="max-w-lg text-center">
    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/20"><Terminal className="w-10 h-10 text-emerald-400" /></div>
    <h2 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>SSH Manager Pro</h2>
    <p className="text-gray-400 mb-4">Multi-SSH connection manager for Windows with Zmodem, GitHub integration, and more.</p>
    <p className="text-xs text-gray-500 mb-8">SSH • SFTP • SCP • RDP • Telnet • Serial • Zmodem/ZSSH • GitHub</p>
    <button onClick={onNew} className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-medium"><Plus className="w-5 h-5" /> Add Connection</button>
    <p className="text-xs text-gray-600 mt-4">Ctrl+N • {count} connections saved</p>
  </div></div>);
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icons: Record<Toast['type'], React.ReactNode> = { success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, error: <XCircle className="w-4 h-4 text-red-400" />, warning: <AlertCircle className="w-4 h-4 text-amber-400" />, info: <Info className="w-4 h-4 text-blue-400" /> };
  const borders: Record<Toast['type'], string> = { success: 'border-emerald-500/30', error: 'border-red-500/30', warning: 'border-amber-500/30', info: 'border-blue-500/30' };
  return (<div className={`flex items-start gap-3 p-3 rounded-lg border shadow-xl bg-[#1a1b26] ${borders[toast.type]} min-w-[280px] max-w-[380px] animate-in slide-in-from-right`}>{icons[toast.type]}<div className="flex-1 min-w-0"><p className="text-sm font-medium text-white">{toast.title}</p><p className="text-xs text-gray-400 truncate">{toast.message}</p></div><button onClick={onDismiss} className="p-0.5 text-gray-500 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button></div>);
}
