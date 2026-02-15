#!/usr/bin/env bash
set -euo pipefail

# Advisory exceptions reviewed for this macOS-only Tauri release.
# These are informational "unmaintained/unsound" transitive advisories
# currently pulled by upstream cross-platform stacks.
IGNORED_IDS=(
  RUSTSEC-2024-0370
  RUSTSEC-2024-0411
  RUSTSEC-2024-0412
  RUSTSEC-2024-0413
  RUSTSEC-2024-0414
  RUSTSEC-2024-0415
  RUSTSEC-2024-0416
  RUSTSEC-2024-0417
  RUSTSEC-2024-0418
  RUSTSEC-2024-0419
  RUSTSEC-2024-0420
  RUSTSEC-2024-0429
  RUSTSEC-2024-0436
  RUSTSEC-2025-0057
  RUSTSEC-2025-0075
  RUSTSEC-2025-0080
  RUSTSEC-2025-0081
  RUSTSEC-2025-0098
  RUSTSEC-2025-0100
)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pushd "${ROOT_DIR}/src-tauri" > /dev/null

CMD=(cargo audit --deny warnings)
for id in "${IGNORED_IDS[@]}"; do
  CMD+=(--ignore "$id")
done

"${CMD[@]}"

popd > /dev/null
