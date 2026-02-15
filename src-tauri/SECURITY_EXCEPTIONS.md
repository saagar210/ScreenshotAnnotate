# Rust Advisory Exceptions

This project runs `cargo audit` in strict mode and fails on warnings.

Current exceptions are limited to informational transitive advisories
(`unmaintained` / `unsound`) that are pulled in by upstream cross-platform
dependencies and are not presently actionable without major upstream changes.

The exception list is codified in `/Users/d/Projects/ScreenshotAnnotate/scripts/cargo_audit.sh`.

Review policy:
- Re-run `cargo audit --json` after every Tauri dependency upgrade.
- Remove exceptions immediately when patched/upgraded alternatives are available.
- Do not add exceptions for known vulnerability advisories without explicit review.
