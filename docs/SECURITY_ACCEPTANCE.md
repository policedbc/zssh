# Security acceptance gates
- Review generated SSH/SCP/rsync commands as untrusted shell text; validation rejects shell metacharacters, but native argv execution must replace all copy/paste surfaces before claiming production-grade safety.
- Existing secrets previously stored in localStorage must be rotated; new imports strip known secret fields.
- Validate Windows private key ACL on actual Windows runners and user systems.
- Independently verify each server host fingerprint before initial connection.
- Enroll unique public keys per device, retain allowlists and revoke them on every authorized target when decommissioning.
- Run live negative and positive SSH authentication integration tests against disposable sshd infrastructure.
- Ensure release wheel/sdist SHA-256 manifests, sign-off, and controlled PyPI environment approvals.
- This PR is not proof of native installer, device enrollment, secret vault or production readiness.
