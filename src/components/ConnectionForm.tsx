import { useState, useEffect } from 'react';
import { SSHConnection, ConnectionGroup, CONNECTION_COLORS } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Save, X, Key, Lock, User, Globe, Hash, FileText, Tag, StickyNote } from 'lucide-react';

interface ConnectionFormProps {
  connection?: SSHConnection | null;
  groups: ConnectionGroup[];
  onSave: (connection: SSHConnection) => void;
  onCancel: () => void;
}

export default function ConnectionForm({ connection, groups, onSave, onCancel }: ConnectionFormProps) {
  const [form, setForm] = useState<Partial<SSHConnection>>({
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'key',
    keyPath: '',
    password: '',
    color: CONNECTION_COLORS[0],
    tags: [],
    notes: '',
    groupId: '',
    protocol: 'ssh',
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (connection) {
      setForm(connection);
    }
  }, [connection]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.host || !form.username) return;

    const saved: SSHConnection = {
      id: connection?.id || uuidv4(),
      name: form.name || '',
      host: form.host || '',
      port: form.port || 22,
      username: form.username || '',
      authType: form.authType || 'key',
      keyPath: form.keyPath || '',
      password: form.password || '',
      color: form.color || CONNECTION_COLORS[0],
      tags: form.tags || [],
      notes: form.notes || '',
      groupId: form.groupId || '',
      protocol: form.protocol || 'ssh',
      createdAt: connection?.createdAt || Date.now(),
      lastConnected: connection?.lastConnected,
    };
    onSave(saved);
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags?.includes(tagInput.trim())) {
      setForm({ ...form, tags: [...(form.tags || []), tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags?.filter(t => t !== tag) || [] });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1b26] border border-[#2a2b3d] rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2b3d]">
          <h2 className="text-lg font-semibold text-white">
            {connection ? 'Edit Connection' : 'New Connection'}
          </h2>
          <button onClick={onCancel} className="p-1.5 hover:bg-[#2a2b3d] rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-1.5">
              <FileText className="w-3.5 h-3.5" /> Connection Name
            </label>
            <input
              type="text"
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Production Server"
              className="w-full px-3 py-2 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              required
            />
          </div>

          {/* Host & Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-1.5">
                <Globe className="w-3.5 h-3.5" /> Host / IP
              </label>
              <input
                type="text"
                value={form.host || ''}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="192.168.1.100 or server.example.com"
                className="w-full px-3 py-2 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-1.5">
                <Hash className="w-3.5 h-3.5" /> Port
              </label>
              <input
                type="number"
                value={form.port || 22}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 22 })}
                className="w-full px-3 py-2 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-1.5">
              <User className="w-3.5 h-3.5" /> Username
            </label>
            <input
              type="text"
              value={form.username || ''}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="root"
              className="w-full px-3 py-2 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              required
            />
          </div>

          {/* Auth Type */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-1.5">
              <Lock className="w-3.5 h-3.5" /> Authentication
            </label>
            <div className="flex gap-2">
              {(['key', 'password', 'agent'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, authType: type })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.authType === type
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-[#24253a] text-gray-400 border border-[#2a2b3d] hover:border-gray-600'
                  }`}
                >
                  {type === 'key' ? '🔑 Key' : type === 'password' ? '🔒 Password' : '🤖 Agent'}
                </button>
              ))}
            </div>
          </div>

          {/* Key Path or Password */}
          {form.authType === 'key' && (
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-1.5">
                <Key className="w-3.5 h-3.5" /> Private Key Path
              </label>
              <input
                type="text"
                value={form.keyPath || ''}
                onChange={(e) => setForm({ ...form, keyPath: e.target.value })}
                placeholder="C:\Users\You\.ssh\id_rsa"
                className="w-full px-3 py-2 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          )}
          {form.authType === 'password' && (
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-1.5">
                <Lock className="w-3.5 h-3.5" /> Password
              </label>
              <input
                type="password"
                value={form.password || ''}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter password"
                className="w-full px-3 py-2 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          )}

          {/* Protocol */}
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Protocol</label>
            <div className="flex gap-2">
              {(['ssh', 'sftp', 'scp'] as const).map(proto => (
                <button
                  key={proto}
                  type="button"
                  onClick={() => setForm({ ...form, protocol: proto })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase transition-colors ${
                    form.protocol === proto
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-[#24253a] text-gray-400 border border-[#2a2b3d] hover:border-gray-600'
                  }`}
                >
                  {proto}
                </button>
              ))}
            </div>
          </div>

          {/* Group */}
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Group</label>
            <select
              value={form.groupId || ''}
              onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              className="w-full px-3 py-2 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">No Group</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.icon} {g.name}</option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Color Tag</label>
            <div className="flex gap-2">
              {CONNECTION_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    form.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1b26] scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-1.5">
              <Tag className="w-3.5 h-3.5" /> Tags
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add tag..."
                className="flex-1 px-3 py-2 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-300 hover:border-gray-600"
              >
                Add
              </button>
            </div>
            {form.tags && form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600/20 text-emerald-400 text-xs rounded-full"
                  >
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Notes
            </label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional notes about this connection..."
              rows={3}
              className="w-full px-3 py-2 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-300 hover:bg-[#2a2b3d] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {connection ? 'Update' : 'Save'} Connection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
