import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultConnection } from '../src/utils.ts';
import { DEFAULT_SETTINGS } from '../src/types.ts';
import { prepareConnectionCommand, prepareBatchCommand, prepareTransferCommand } from '../src/commandActions.ts';

const conn = (overrides = {}) =>
  createDefaultConnection({ name: 'dev', host: 'example.org', username: 'ubuntu', ...overrides }, 'linux');
const settings = { ...DEFAULT_SETTINGS, platform: 'linux' as const, preferredTerminal: 'gnome-terminal' as const };

test('SSH connection action prepares command, not connection state', () => {
  const result = prepareConnectionCommand(conn(), settings);
  assert.equal(result.ok, true);
  if (result.ok) assert.match(result.command, /ssh .*ubuntu@example\.org/);
});

test('command action rejects malformed host and unsupported protocol', () => {
  const unsafe = prepareConnectionCommand(conn({ host: 'a;id' }), settings);
  assert.equal(unsafe.ok, false);
  const serial = prepareConnectionCommand(conn({ protocol: 'serial' }), settings);
  assert.equal(serial.ok, false);
});

test('batch prepares one script without executing or discarding hosts', () => {
  const result = prepareBatchCommand([conn({ name: 'a' }), conn({ name: 'b', host: 'db.example.org' })], 'linux');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.command, /ubuntu@example\.org/);
    assert.match(result.command, /ubuntu@db\.example\.org/);
  }
});

test('batch fails entirely on unsupported profile or refused command', () => {
  assert.equal(prepareBatchCommand([], 'linux').ok, false);
  assert.equal(prepareBatchCommand([conn({ protocol: 'rdp' })], 'linux').ok, false);
  assert.equal(prepareBatchCommand([conn(), conn({ host: 'bad;host' })], 'linux').ok, false);
  assert.equal(prepareBatchCommand([conn({ keyPath: 'C:\\A B\\id' })], 'windows').ok, false);
});

test('SCP and rsync actions only prepare safe native commands', () => {
  const scp = prepareTransferCommand(conn(), 'scp', '/tmp/hello world', '/srv/a', 'upload', 'linux');
  assert.equal(scp.ok, true);
  if (scp.ok) assert.match(scp.command, /^scp /);
  const rsync = prepareTransferCommand(conn(), 'rsync', '/tmp/x', '/srv/b', 'download', 'linux');
  assert.equal(rsync.ok, true);
  if (rsync.ok) assert.match(rsync.command, /^rsync /);
});

test('transfer actions reject remote-shell syntax, missing paths and unsupported protocols', () => {
  for (const remote of ['/tmp/a;id', '/tmp/a b', '/tmp/$(id)']) {
    assert.equal(prepareTransferCommand(conn(), 'scp', '/tmp/a', remote, 'upload', 'linux').ok, false);
    assert.equal(prepareTransferCommand(conn(), 'rsync', '/tmp/a', remote, 'upload', 'linux').ok, false);
  }
  assert.equal(prepareTransferCommand(conn(), 'scp', '', '/srv/a', 'upload', 'linux').ok, false);
  assert.equal(prepareTransferCommand(conn(), 'sftp', '/tmp/a', '/srv/a', 'upload', 'linux').ok, false);
  assert.equal(prepareTransferCommand(conn(), 'zmodem', '/tmp/a', '/srv/a', 'upload', 'linux').ok, false);
  assert.equal(prepareTransferCommand(conn({ protocol: 'rdp' }), 'scp', '/tmp/a', '/srv/a', 'upload', 'linux').ok, false);
});

test('UI must not synthesize network success, random scan results or fake sample profiles', () => {
  const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  for (const forbidden of [
    'Math.random()', 'setTransfers(', "'Transfer done'", "'Connected'", "'Launched'",
    'Initialize sample data', "status: 'transferring'",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.match(source, /No live scanner is connected/);
  assert.match(source, /No file was transferred/);
  assert.match(source, /Clipboard access requires a secure browser context/);
});
