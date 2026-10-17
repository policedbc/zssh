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
