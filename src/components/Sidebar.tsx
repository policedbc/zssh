import { useState } from 'react';
import { SSHConnection, ConnectionGroup, CONNECTION_COLORS } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { X, FolderPlus, Plus, Search, ChevronDown, ChevronRight, Trash2, Edit3, Server, Copy, Terminal, Download, Upload } from 'lucide-react';

interface SidebarProps {
  connections: SSHConnection[];
  groups: ConnectionGroup[];
  selectedConnectionId: string | null;
  selectedGroupId: string | null;
  searchQuery: string;
  onSelectConnection: (id: string) => void;
  onSelectGroup: (id: string | null) => void;
  onToggleGroup: (id: string) => void;
  onSearchChange: (query: string) => void;
  onAddGroup: (group: ConnectionGroup) => void;
  onDeleteGroup: (id: string) => void;
  onDeleteConnection: (id: string) => void;
  onDuplicateConnection: (id: string) => void;
  onImport: (data: { connections: SSHConnection[]; groups: ConnectionGroup[] }) => void;
  onExport: () => void;
}

export default function Sidebar({
  connections,
  groups,
  selectedConnectionId,
  selectedGroupId,
  searchQuery,
  onSelectConnection,
  onSelectGroup,
  onToggleGroup,
  onSearchChange,
  onAddGroup,
  onDeleteGroup,
  onDeleteConnection,
  onDuplicateConnection,
  onImport,
  onExport,
}: SidebarProps) {
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('🖥️');
  const [newGroupColor, setNewGroupColor] = useState(CONNECTION_COLORS[0]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connectionId: string } | null>(null);

  const filteredConnections = connections.filter(conn => {
    const matchesSearch = conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (selectedGroupId) {
      return matchesSearch && conn.groupId === selectedGroupId;
    }
    return matchesSearch;
  });

  const groupedConnections = groups.map(group => ({
    ...group,
    connections: filteredConnections.filter(c => c.groupId === group.id),
  }));

  const ungroupedConnections = filteredConnections.filter(c => !c.groupId || !groups.find(g => g.id === c.groupId));

  const handleAddGroup = () => {
    if (newGroupName.trim()) {
      onAddGroup({
        id: uuidv4(),
        name: newGroupName.trim(),
        icon: newGroupIcon,
        expanded: true,
        color: newGroupColor,
      });
      setNewGroupName('');
      setShowGroupForm(false);
    }
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
            if (data.connections && data.groups) {
              onImport(data);
            }
          } catch (err) {
            alert('Invalid file format');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="w-80 bg-[#1a1b26] border-r border-[#2a2b3d] flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2b3d]">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <h1 className="text-lg font-bold text-white">SSH Manager</h1>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search connections..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => setShowGroupForm(!showGroupForm)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#24253a] hover:bg-[#2a2b4d] text-gray-300 text-xs rounded-md transition-colors"
            title="New Group"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Group
          </button>
          <button
            onClick={onExport}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#24253a] hover:bg-[#2a2b4d] text-gray-300 text-xs rounded-md transition-colors"
            title="Export"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={handleImport}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#24253a] hover:bg-[#2a2b4d] text-gray-300 text-xs rounded-md transition-colors"
            title="Import"
          >
            <Upload className="w-3.5 h-3.5" />
            Import
          </button>
        </div>
      </div>

      {/* Group Form */}
      {showGroupForm && (
        <div className="p-3 border-b border-[#2a2b3d] bg-[#1e1f33]">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              placeholder="Group name..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
              className="flex-1 px-2 py-1.5 bg-[#24253a] border border-[#2a2b3d] rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
              autoFocus
            />
            <button onClick={handleAddGroup} className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => setShowGroupForm(false)} className="p-1.5 hover:bg-[#2a2b3d] rounded text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {['🖥️', '🌐', '🔒', '📦', '🗄️', '⚡', '🏢', '🔧', '🌍', '💻'].map(icon => (
              <button
                key={icon}
                onClick={() => setNewGroupIcon(icon)}
                className={`w-7 h-7 flex items-center justify-center rounded text-sm ${newGroupIcon === icon ? 'bg-emerald-600/30 ring-1 ring-emerald-500' : 'hover:bg-[#2a2b3d]'}`}
              >
                {icon}
              </button>
            ))}
          </div>
          <div className="flex gap-1 mt-2">
            {CONNECTION_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setNewGroupColor(color)}
                className={`w-5 h-5 rounded-full ${newGroupColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1e1f33]' : ''}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Connections button */}
      <div className="px-2 pt-2">
        <button
          onClick={() => onSelectGroup(null)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            selectedGroupId === null ? 'bg-emerald-600/20 text-emerald-400' : 'text-gray-300 hover:bg-[#24253a]'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>All Connections</span>
          <span className="ml-auto text-xs text-gray-500">{connections.length}</span>
        </button>
      </div>

      {/* Connection List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {/* Grouped connections */}
        {groupedConnections.map(group => (
          <div key={group.id} className="mb-1">
            <div
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer group"
              onClick={() => onToggleGroup(group.id)}
            >
              <span className="text-gray-400">
                {group.expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
              <span className="text-sm">{group.icon}</span>
              <span className="text-sm text-gray-300 flex-1">{group.name}</span>
              <span className="text-xs text-gray-500">{group.connections.length}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded text-red-400 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            {group.expanded && (
              <div className="ml-3 space-y-0.5">
                {group.connections.map(conn => (
                  <ConnectionItem
                    key={conn.id}
                    connection={conn}
                    isSelected={conn.id === selectedConnectionId}
                    onSelect={() => onSelectConnection(conn.id)}
                    onDelete={() => onDeleteConnection(conn.id)}
                    onDuplicate={() => onDuplicateConnection(conn.id)}
                    onContextMenu={(e) => setContextMenu({ x: e.clientX, y: e.clientY, connectionId: conn.id })}
                  />
                ))}
                {group.connections.length === 0 && (
                  <p className="text-xs text-gray-600 px-3 py-1 italic">No connections</p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Ungrouped connections */}
        {ungroupedConnections.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 px-3 py-1 uppercase tracking-wider">Ungrouped</p>
            {ungroupedConnections.map(conn => (
              <ConnectionItem
                key={conn.id}
                connection={conn}
                isSelected={conn.id === selectedConnectionId}
                onSelect={() => onSelectConnection(conn.id)}
                onDelete={() => onDeleteConnection(conn.id)}
                onDuplicate={() => onDuplicateConnection(conn.id)}
                onContextMenu={(e) => setContextMenu({ x: e.clientX, y: e.clientY, connectionId: conn.id })}
              />
            ))}
          </div>
        )}

        {filteredConnections.length === 0 && (
          <div className="text-center py-8">
            <Server className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No connections found</p>
            <p className="text-xs text-gray-600 mt-1">Add a new connection to get started</p>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-[#24253a] border border-[#2a2b3d] rounded-lg shadow-xl py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { onDuplicateConnection(contextMenu.connectionId); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-[#2a2b4d]"
            >
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </button>
            <button
              onClick={() => { onDeleteConnection(contextMenu.connectionId); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ConnectionItem({
  connection,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onContextMenu,
}: {
  connection: SSHConnection;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group transition-colors ${
        isSelected ? 'bg-emerald-600/20 border border-emerald-500/30' : 'hover:bg-[#24253a] border border-transparent'
      }`}
    >
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: connection.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">{connection.name}</p>
        <p className="text-xs text-gray-500 truncate">{connection.username}@{connection.host}</p>
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="p-1 hover:bg-[#2a2b4d] rounded text-gray-400"
          title="Duplicate"
        >
          <Copy className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 hover:bg-red-500/20 rounded text-red-400"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
