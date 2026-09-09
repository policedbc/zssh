import { SSHConnection, ConnectionGroup } from '../types';
import { Terminal, Copy, Edit3, Clock, Server, User, Globe, Key, Hash, Tag, StickyNote, Play, ExternalLink, Shield, Wifi } from 'lucide-react';
import { useState } from 'react';

interface ConnectionDetailProps {
  connection: SSHConnection;
  groups: ConnectionGroup[];
  onEdit: () => void;
  onQuickConnect: (command: string) => void;
}

export default function ConnectionDetail({ connection, groups, onEdit, onQuickConnect }: ConnectionDetailProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showCommand, setShowCommand] = useState(false);

  const group = groups.find(g => g.id === connection.groupId);

  const generateSSHCommand = () => {
    let cmd = `ssh`;
    if (connection.port !== 22) cmd += ` -p ${connection.port}`;
    if (connection.authType === 'key' && connection.keyPath) {
      cmd += ` -i "${connection.keyPath}"`;
    }
    cmd += ` ${connection.username}@${connection.host}`;
    return cmd;
  };

  const generateSFTPCommand = () => {
    let cmd = `sftp`;
    if (connection.port !== 22) cmd += ` -P ${connection.port}`;
    if (connection.authType === 'key' && connection.keyPath) {
      cmd += ` -i "${connection.keyPath}"`;
    }
    cmd += ` ${connection.username}@${connection.host}`;
    return cmd;
  };

  const generatePuTTYCommand = () => {
    let cmd = `putty`;
    if (connection.port !== 22) cmd += ` -P ${connection.port}`;
    if (connection.authType === 'key' && connection.keyPath) {
      cmd += ` -i "${connection.keyPath}"`;
    }
    cmd += ` ${connection.username}@${connection.host}`;
    return cmd;
  };

  const generateWindowsTerminalCommand = () => {
    return `wt ssh ${connection.username}@${connection.host}${connection.port !== 22 ? ` -p ${connection.port}` : ''}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const sshCommand = generateSSHCommand();
  const sftpCommand = generateSFTPCommand();
  const puttyCommand = generatePuTTYCommand();
  const wtCommand = generateWindowsTerminalCommand();

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#13141f]">
      {/* Header */}
      <div className="border-b border-[#2a2b3d] bg-[#1a1b26]">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: connection.color }} />
              <div>
                <h2 className="text-2xl font-bold text-white">{connection.name}</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {connection.username}@{connection.host}:{connection.port}
                </p>
              </div>
            </div>
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-3 py-2 bg-[#24253a] hover:bg-[#2a2b4d] border border-[#2a2b3d] rounded-lg text-sm text-gray-300 transition-colors"
            >
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => onQuickConnect(sshCommand)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white font-medium transition-colors"
            >
              <Play className="w-4 h-4" /> Quick Connect (SSH)
            </button>
            <button
              onClick={() => setShowCommand(!showCommand)}
              className="flex items-center gap-2 px-4 py-2 bg-[#24253a] hover:bg-[#2a2b4d] border border-[#2a2b3d] rounded-lg text-sm text-gray-300 transition-colors"
            >
              <Terminal className="w-4 h-4" /> {showCommand ? 'Hide' : 'Show'} Commands
            </button>
            <button
              onClick={() => copyToClipboard(sshCommand, 'ssh')}
              className="flex items-center gap-2 px-3 py-2 bg-[#24253a] hover:bg-[#2a2b4d] border border-[#2a2b3d] rounded-lg text-sm text-gray-300 transition-colors"
            >
              <Copy className="w-4 h-4" /> {copied === 'ssh' ? 'Copied!' : 'Copy SSH'}
            </button>
          </div>
        </div>
      </div>

      {/* Commands Panel */}
      {showCommand && (
        <div className="max-w-4xl mx-auto p-6 border-b border-[#2a2b3d]">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" /> Connection Commands
          </h3>
          <div className="space-y-3">
            <CommandBlock
              label="OpenSSH (CMD/PowerShell)"
              command={sshCommand}
              copied={copied === 'openssh'}
              onCopy={() => copyToClipboard(sshCommand, 'openssh')}
            />
            <CommandBlock
              label="SFTP"
              command={sftpCommand}
              copied={copied === 'sftp'}
              onCopy={() => copyToClipboard(sftpCommand, 'sftp')}
            />
            <CommandBlock
              label="PuTTY"
              command={puttyCommand}
              copied={copied === 'putty'}
              onCopy={() => copyToClipboard(puttyCommand, 'putty')}
            />
            <CommandBlock
              label="Windows Terminal"
              command={wtCommand}
              copied={copied === 'wt'}
              onCopy={() => copyToClipboard(wtCommand, 'wt')}
            />
          </div>
        </div>
      )}

      {/* Connection Details */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailCard
            icon={<Globe className="w-4 h-4 text-blue-400" />}
            label="Host"
            value={connection.host}
            onCopy={() => copyToClipboard(connection.host, 'host')}
            copied={copied === 'host'}
          />
          <DetailCard
            icon={<Hash className="w-4 h-4 text-purple-400" />}
            label="Port"
            value={String(connection.port)}
            onCopy={() => copyToClipboard(String(connection.port), 'port')}
            copied={copied === 'port'}
          />
          <DetailCard
            icon={<User className="w-4 h-4 text-emerald-400" />}
            label="Username"
            value={connection.username}
            onCopy={() => copyToClipboard(connection.username, 'user')}
            copied={copied === 'user'}
          />
          <DetailCard
            icon={<Shield className="w-4 h-4 text-amber-400" />}
            label="Authentication"
            value={connection.authType === 'key' ? `Key (${connection.keyPath || 'not set'})` : connection.authType === 'password' ? 'Password' : 'SSH Agent'}
          />
          <DetailCard
            icon={<Wifi className="w-4 h-4 text-cyan-400" />}
            label="Protocol"
            value={connection.protocol.toUpperCase()}
          />
          <DetailCard
            icon={<Server className="w-4 h-4 text-pink-400" />}
            label="Group"
            value={group ? `${group.icon} ${group.name}` : 'None'}
          />
        </div>

        {/* Tags */}
        {connection.tags.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4" /> Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {connection.tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-[#24253a] border border-[#2a2b3d] rounded-full text-sm text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {connection.notes && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
              <StickyNote className="w-4 h-4" /> Notes
            </h3>
            <div className="p-3 bg-[#24253a] border border-[#2a2b3d] rounded-lg text-sm text-gray-300 whitespace-pre-wrap">
              {connection.notes}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="mt-6 pt-4 border-t border-[#2a2b3d]">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Created: {new Date(connection.createdAt).toLocaleDateString()}
            </span>
            {connection.lastConnected && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Last connected: {new Date(connection.lastConnected).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CommandBlock({ label, command, copied, onCopy }: { label: string; command: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="bg-[#0d0e17] border border-[#2a2b3d] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1b26] border-b border-[#2a2b3d]">
        <span className="text-xs text-gray-400">{label}</span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-400 transition-colors"
        >
          <Copy className="w-3 h-3" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <code className="block px-3 py-2 text-sm text-emerald-300 font-mono overflow-x-auto">
        {command}
      </code>
    </div>
  );
}

function DetailCard({ icon, label, value, onCopy, copied }: { icon: React.ReactNode; label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[#1a1b26] border border-[#2a2b3d] rounded-lg">
      <div className="p-2 bg-[#24253a] rounded-lg">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-200 truncate">{value}</p>
      </div>
      {onCopy && (
        <button
          onClick={onCopy}
          className="p-1.5 hover:bg-[#24253a] rounded text-gray-400 hover:text-emerald-400 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          {copied && <span className="sr-only">Copied</span>}
        </button>
      )}
    </div>
  );
}
