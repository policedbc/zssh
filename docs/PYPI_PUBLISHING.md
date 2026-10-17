# Trusted Publishing for zSSH

This repository builds the `zeaz-zssh` distribution and installs the `zssh` CLI.

## Local packaging checks

```shell
python -m pip install build twine
python -m build
python -m twine check dist/*.whl dist/*.tar.gz --strict
python -m pip install dist/*.whl
zssh --help
```

No publishing credentials are stored in the repository.

## Configure PyPI (manual, before release)

1. Verify the project name `zeaz-zssh` is appropriate and available on PyPI. Project names cannot be reserved simply by adding metadata.
2. Create a GitHub repository environment named `pypi`. Require approval from an independent reviewer, restrict deployments to protected release tags, and configure repository permissions.
3. In PyPI, create a pending Trusted Publisher for the new project, or add a Trusted Publisher to the existing project:
   - GitHub owner: `policedbc`
   - Repository: `zssh`
   - Workflow filename: `publish-pypi.yml`
   - Environment: `pypi`
4. Review and merge the packaging PR after all required checks pass.
5. Create and publish a reviewed GitHub Release with a tag matching `v<version>` from `pyproject.toml` (starting with `v0.1.0`). Only that event attempts to publish.

The workflow never requires a static PyPI API token and grants `id-token: write` only to the publish job. Releases with pre-release flag do not build or publish. The distribution is not a standalone binary; Python and OpenSSH are required on each client.

## Release checklist

- Complete independent review and confirm tests on intended operating systems.
- Confirm package metadata and version, and verify no name collision on PyPI.
- Verify the `pypi` environment requires approval and restricts allowed ref patterns.
- Verify the matching Trusted Publisher is configured on PyPI.
- Publish a reviewed GitHub Release tag matching package version.
- Verify installed CLI from the published wheel and inspect PyPI provenance/attestation where supported.

Do not create a release if any prerequisite fails. PyPI artifacts are immutable at the same name/version; increment the version for subsequent publishing.
