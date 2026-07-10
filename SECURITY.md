# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository. Include the affected surface, reproduction steps, impact, and any suggested mitigation. Do not open a public issue for an unpatched vulnerability.

Maintainers will acknowledge a complete report as soon as practical, validate the impact, and coordinate disclosure after a fix is available.

## Supported versions

Security fixes target the current `main` branch. The project does not currently maintain parallel release branches.

## Secrets and personal data

Keep credentials in local environment files or provider secret stores. The repository ignores operator deployment configuration, `.credentials/`, and `scratchpad/`. Revoke any credential immediately if it is committed or exposed in an issue, log, build artifact, or pull request.
