# zSSH — SSH Client Manager + Secure Bootstrap

React/Vite SSH management UI with an opt-in, local-first Python OpenSSH bootstrap for Windows, WSL2 Ubuntu, Linux and macOS.

## Quick start

From a trusted local checkout:

```bash
python3 scripts/zssh.py init --dry-run
python3 scripts/zssh.py init
python3 scripts/zssh.py add-host dev 192.168.1.10 ubuntu --port 22
python3 scripts/zssh.py doctor
ssh dev
```

On PowerShell:

```powershell
python scripts/zssh.py init --dry-run
./scripts/install.ps1
python scripts/zssh.py doctor
```

Use the separate `~/.ssh/zssh/id_ed25519.pub` **public** key for manual enrollment on authorized servers. Verify server host-key fingerprint before connecting; bootstrap never disables verification. Existing SSH config and private keys are retained.

## Build and verify

```bash
python3 -m unittest discover -s tests -v
python3 scripts/build.py
python3 dist/zssh.pyz doctor
npm ci && npm run typecheck && npm test && npm run build
```

`dist/zssh.pyz` is a portable zipapp and requires Python 3 + OpenSSH on each client. It is **not** a signed native installer. See [security model](docs/SECURITY.md).

UI supports SSH/SCP command generation, terminal preferences and connection profiles; real native SSH execution is not yet wired into the browser UI.

### Browser operation status

The web UI is **command-preview and clipboard-only**. Its Connection, Batch and
File Transfer actions do not open SSH sessions or transfer bytes; an operator
must run the generated command in an authorized native terminal. SFTP and
Zmodem need a native client and are not implemented in the browser.

The Network Scanner page has no active scan backend and reports no host status.
Fresh installations start with an empty profile list, without fictional
production hosts. Prior versions populated sample hosts and fabricated Session,
Transfer and Scan counts; **legacy counters must not be considered evidence**
of device health, access, transfer completion, or security posture. Integrate
real authenticated observations before feeding these values to zworkforce.


## zFleet — preview-first SSH operations

Run the fleet tool from a trusted checkout after enrolling hosts with `zssh`.
All remote commands are executed using OpenSSH and require verified host keys
and non-interactive authentication (for example, an unlocked SSH agent).

```bash
python3 scripts/zfleet.py 'uname -a' --host dev
python3 scripts/zfleet.py 'uname -a' --host dev --execute
python3 scripts/zfleet.py 'uptime' --match '^prod-' --execute
python3 scripts/zfleet.py 'uptime' --all --execute --confirm-all
```

Without `--execute`, the tool only prints a JSON preview. Select hosts
explicitly with `--host`, `--match`, or `--all`; global execution requires
`--confirm-all`. The default maximum concurrency is 10, capped at 16.
Both output streams are capped at 64 KiB per host, and all results are JSON.

**Security warning:** A remote command is still interpreted by the remote
user's shell. Do not pass untrusted AI-generated commands, secrets, or
credentials on the command line. zFleet has no production approval workflow;
integrations such as zworkforce must enforce independent policy, approval,
and audit controls before enabling execution. The `zfleet` entry point is included in the Python wheel, but this CLI is not
embedded in the browser UI or packaged into the `zssh.pyz` build.

## Hardening notes

zSSH now writes managed SSH config and hosts files atomically with owner-only
permissions on POSIX, preserves symlinked `~/.ssh/config` files, and keeps a
one-time backup before enabling the managed Include. The `doctor` command checks
SSH Includes and file permissions; on Windows, private key ACL validation uses
PowerShell and still needs validation on a real host.

The browser UI validates generated connection commands and rejects unsafe fields
with `# Refused:` markers rather than generating executable text. Imported JSON
cannot reintroduce stored credentials, startup commands, environment variables,
or unknown connection fields. Because SCP may fall back to a remote shell, and
rsync uses one, **remote transfer paths are limited to simple path characters**;
paths containing spaces or shell metacharacters are refused. For complex paths,
run native tools deliberately with platform-specific quoting after review.

Run CI on Python 3.9/3.12, plus TypeScript tests on Linux, Windows and macOS
before merging. Production acceptance still requires real SSH, Windows ACL,
and hostile-input tests; see [security acceptance gates](docs/SECURITY_ACCEPTANCE.md).
