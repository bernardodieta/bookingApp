#!/bin/bash
# GitHub Actions Runner Entrypoint
# Persistent registration: token only needed on first run

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================
RUNNER_NAME="${RUNNER_NAME:-$(hostname)}"
RUNNER_WORKDIR="${RUNNER_WORKDIR:-_work}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,Linux,X64,docker}"
RUNNER_GROUP="${RUNNER_GROUP:-Default}"

# =============================================================================
# Validation
# =============================================================================
validate_env() {
    if [[ -z "${GITHUB_URL:-}" ]]; then
        echo "ERROR: GITHUB_URL is required" >&2
        exit 1
    fi

    if [[ ! -f ".runner" && -z "${GITHUB_TOKEN:-}" ]]; then
        echo "ERROR: GITHUB_TOKEN is required for first-time registration" >&2
        exit 1
    fi
}

# =============================================================================
# Setup
# =============================================================================
setup_runner_files() {
    if [[ ! -f "./config.sh" ]]; then
        echo "First-time setup: Copying runner binaries to persistent volume..."
        cp -r /opt/actions-runner/* .
        echo "Runner binaries copied."
    fi

    mkdir -p "${RUNNER_WORKDIR}" "${RUNNER_WORKDIR}/_tool" "${RUNNER_WORKDIR}/_temp" 2>/dev/null || true

    if [[ ! -w "${RUNNER_WORKDIR}" ]]; then
        sudo chown -R runner:runner "${RUNNER_WORKDIR}" 2>/dev/null || true
    fi
    sudo chown -R runner:runner "${RUNNER_WORKDIR}" 2>/dev/null || true
}

configure_runner() {
    if [[ -f ".runner" ]]; then
        echo "Persistent runner configuration found. Reconnecting..."
        return 0
    fi

    echo "=============================================="
    echo "First-time Registration"
    echo "  URL:    ${GITHUB_URL}"
    echo "  Name:   ${RUNNER_NAME}"
    echo "  Labels: ${RUNNER_LABELS}"
    echo "=============================================="

    ./config.sh \
        --url "${GITHUB_URL}" \
        --token "${GITHUB_TOKEN}" \
        --name "${RUNNER_NAME}" \
        --work "${RUNNER_WORKDIR}" \
        --labels "${RUNNER_LABELS}" \
        --runnergroup "${RUNNER_GROUP}" \
        --unattended \
        --replace \
        --disableupdate

    echo "Runner registered. You can now remove GITHUB_TOKEN."
}

# =============================================================================
# Cleanup & Signal Handling
# =============================================================================
cleanup() {
    echo "Received shutdown signal. Runner will reconnect on next start."
    exit 0
}

trap cleanup SIGTERM SIGINT SIGQUIT

# =============================================================================
# Main
# =============================================================================
main() {
    echo "Apoint GitHub Actions Runner (Persistent Mode)"
    validate_env
    setup_runner_files
    configure_runner

    echo "Starting runner listener..."
    ./run.sh &
    RUNNER_PID=$!
    wait ${RUNNER_PID}
}

main "$@"
