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
npm ci && npm run typecheck && npm run build
```

`dist/zssh.pyz` is a portable zipapp and requires Python 3 + OpenSSH on each client. It is **not** a signed native installer. See [security model](docs/SECURITY.md).

UI supports SSH/SCP command generation, terminal preferences and connection profiles; real native SSH execution is not yet wired into the browser UI.

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
and audit controls before enabling execution. This CLI is not embedded in
the browser UI and is not packaged into the `zssh.pyz` build.
