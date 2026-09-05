#!/usr/bin/env bash
set -euo pipefail

RELEASE_TAG="local-runtime-2026.09.05"
RELEASE_BASE="https://github.com/Yaxin9Luo/AutoDesign/releases/download/${RELEASE_TAG}"
BUNDLE_NAME="designanything-local.tar.gz"
TEMP_ROOT="$(mktemp -d)"

cleanup() {
  rm -rf "${TEMP_ROOT}"
}
trap cleanup EXIT

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

die() {
  echo "error: $*" >&2
  exit 1
}

have_cmd curl || die "curl is required"
have_cmd tar || die "tar is required"

echo "Downloading AutoDesign local runtime..." >&2
curl -fL --retry 4 --connect-timeout 20 \
  "${RELEASE_BASE}/${BUNDLE_NAME}" \
  -o "${TEMP_ROOT}/${BUNDLE_NAME}"
curl -fsSL --retry 4 --connect-timeout 20 \
  "${RELEASE_BASE}/${BUNDLE_NAME}.sha256" \
  -o "${TEMP_ROOT}/${BUNDLE_NAME}.sha256"

expected="$(awk 'match($0, /[0-9a-fA-F]{64}/) { print substr($0, RSTART, RLENGTH); exit }' "${TEMP_ROOT}/${BUNDLE_NAME}.sha256")"
if have_cmd sha256sum; then
  actual="$(sha256sum "${TEMP_ROOT}/${BUNDLE_NAME}" | awk '{print $1}')"
elif have_cmd shasum; then
  actual="$(shasum -a 256 "${TEMP_ROOT}/${BUNDLE_NAME}" | awk '{print $1}')"
else
  die "sha256sum or shasum is required"
fi

[ -n "${expected}" ] && [ "${actual}" = "${expected}" ] || die "AutoDesign bundle checksum mismatch"

mkdir -p "${TEMP_ROOT}/unpack"
tar -xzf "${TEMP_ROOT}/${BUNDLE_NAME}" -C "${TEMP_ROOT}/unpack"
[ -x "${TEMP_ROOT}/unpack/AutoDesign/install.sh" ] || chmod +x "${TEMP_ROOT}/unpack/AutoDesign/install.sh"
"${TEMP_ROOT}/unpack/AutoDesign/install.sh"
