# zSSH security model

- Generate **one Ed25519 key per device**, with an interactive passphrase. Never copy a master private key to multiple clients.
- Master policy is the allowlist of enrolled public keys, not a globally shared private key.
- Do not commit, sync, export or log private keys, passwords, SSH-agent material or GitHub credentials.
- Bootstrap never overwrites existing private keys; no silent passphrase bypass.
- Host key verification remains enabled. Enroll each host by validating its SSH host-key fingerprint out of band before first connection.
- Auto-heal is limited to safe local filesystem permissions and required directories; it does not regenerate lost private keys, add remote authorization, disable host-key checking, or reconfigure sshd.
- The Python zipapp runs on Windows/WSL2/Ubuntu/macOS with Python 3 and installed OpenSSH client; it is not a standalone native executable.
- Browser UI has no OS-level SSH permissions. Do not treat copied commands, simulated statuses, or generated scripts as completed SSH sessions.
- Existing browser-local legacy credentials must be considered exposed and rotated before use. Avoid importing credential-bearing JSON backups.
- Windows OpenSSH key ACLs are not yet remediated automatically; audit them before production use.
