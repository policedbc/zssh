# Release Security, Enrollment and Rollback

## Release gates

- Verify all CI jobs on the exact SHA intended for release.
- Review git diff, dependency inventory, Python wheel/sdist, and no embedded secret material.
- Confirm no browser exports or legacy localStorage entries contain reusable credentials. Any historically stored passwords and GitHub access tokens must be revoked/rotated; never migrate secrets into another unencrypted store.
- Verify SSH host fingerprints through a trusted out-of-band channel before adding hosts to known_hosts. Never enable StrictHostKeyChecking=no.
- Enroll each device with its own public Ed25519 key through an authorized server operator. Keep a reviewed inventory of device ID, public key fingerprint, authorized principals and expiration.
- To revoke a device, remove its public key from the authorized_keys or CA allowlist for **every** affected host, then verify denied authentication. Removing a UI profile does not revoke a key.
- On Windows run `python scripts/zssh.py doctor` and ensure private key ACL is limited to the current user, Administrators and SYSTEM. Bootstrap must fail closed if it cannot verify this.
- Verify Linux/macOS key file 0600 and .ssh directories 0700.
- Verify GitHub `pypi` environment required reviewers / protected tag rules and PyPI matching Trusted Publisher before publishing.
- Verify package SHA-256 from downloaded release artifacts and verify wheel/sdist contents before publishing.
- Do not publish from a draft PR or an unreviewed tag.

## Rollback

1. Stop rollout and disable publishing triggers and releases if compromise is suspected.
2. Revert a faulty source change using a new reviewed PR; never rewrite protected git history.
3. Reinstall the last known-good package version from a trusted artifact digest; do not assume PyPI package deletion restores previous installs.
4. Revoke compromised public keys and tokens, rotate credentials and reissue unique device keys as required.
5. Re-test connectivity, host identity and negative authentication before reopening rollout.

## Known limitations

- Windows ACL verification checks existing permissions but does not yet perform ACL repair.
- Native packaged .exe/.msi/.deb/.pkg installers remain out of scope.
- GitHub and PyPI environment configuration require platform administrator action; publishing to PyPI is not automatic until Trusted Publisher approval.
- Full device enrollment, central revocation and live SSH session orchestration need a separately reviewed native control-plane implementation.
