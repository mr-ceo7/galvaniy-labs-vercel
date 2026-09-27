#!/usr/bin/env bash
#
# Galvaniy Labs — Unified Development Launcher
# Starts both the FastAPI backend and Vite frontend concurrently.
#

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

# Configurable ports and hosts
BACKEND_PORT="${BACKEND_PORT:-8001}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# Color codes (ANSI)
BOLD="\033[1m"
DIM="\033[2m"
CYAN="\033[1;36m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
RESET="\033[0m"

log_sys()  { echo -e "${BOLD}${CYAN}[galvaniy:system]${RESET} $*"; }
log_api()  { echo -e "${BOLD}${GREEN}[galvaniy:api]${RESET}    $*"; }
log_web()  { echo -e "${BOLD}${YELLOW}[galvaniy:web]${RESET}    $*"; }
log_err()  { echo -e "${BOLD}${RED}[galvaniy:error]${RESET}  $*" >&2; }

# Track child PIDs
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  trap - INT TERM EXIT
  echo ""
  log_sys "Shutting down development servers..."

  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    log_web "Stopping frontend (PID ${FRONTEND_PID})..."
    kill -TERM "${FRONTEND_PID}" 2>/dev/null || true
  fi

  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    log_api "Stopping backend (PID ${BACKEND_PID})..."
    kill -TERM "${BACKEND_PID}" 2>/dev/null || true
  fi

  # Wait briefly for graceful shutdown, force kill if needed
  sleep 1
  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill -9 "${FRONTEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill -9 "${BACKEND_PID}" 2>/dev/null || true
  fi

  log_sys "Shutdown complete."
  exit 0
}

trap cleanup INT TERM EXIT

# Check if port is already bound
check_port() {
  local port="$1"
  local name="$2"

  if command -v lsof >/dev/null 2>&1; then
    local occupying_pid
    occupying_pid="$(lsof -sTCP:LISTEN -iTCP:"${port}" -t 2>/dev/null || true)"
    if [[ -n "${occupying_pid}" ]]; then
      log_err "Port ${port} (${name}) is already in use by PID ${occupying_pid}."
      log_err "Please terminate the process before starting or specify a different port."
      exit 1
    fi
  fi
}

# Resolve Python environment
resolve_python() {
  local python_exec=""

  if [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "${VIRTUAL_ENV}/bin/python" ]]; then
    python_exec="${VIRTUAL_ENV}/bin/python"
  elif [[ -x "${BACKEND_DIR}/venv/bin/python" ]]; then
    python_exec="${BACKEND_DIR}/venv/bin/python"
  elif [[ -x "${BACKEND_DIR}/.venv/bin/python" ]]; then
    python_exec="${BACKEND_DIR}/.venv/bin/python"
  elif [[ -x "${ROOT_DIR}/venv/bin/python" ]]; then
    python_exec="${ROOT_DIR}/venv/bin/python"
  elif [[ -x "${ROOT_DIR}/.venv/bin/python" ]]; then
    python_exec="${ROOT_DIR}/.venv/bin/python"
  elif command -v python3 >/dev/null 2>&1; then
    python_exec="$(command -v python3)"
  elif command -v python >/dev/null 2>&1; then
    python_exec="$(command -v python)"
  else
    log_err "No Python interpreter found. Please install Python 3.10+."
    exit 1
  fi

  echo "${python_exec}"
}

# Pre-flight checks
log_sys "Running pre-flight checks..."

# Check Node & npm
if ! command -v npm >/dev/null 2>&1; then
  log_err "npm is not installed or not in PATH."
  exit 1
fi

# Check frontend node_modules
if [[ ! -d "${ROOT_DIR}/node_modules" ]]; then
  log_sys "node_modules not found. Installing frontend dependencies..."
  (cd "${ROOT_DIR}" && npm install)
fi

# Ensure engine is compiled
if [[ ! -f "${ROOT_DIR}/public/engine.min.js" ]]; then
  log_sys "Physics engine bundle not found. Building engine..."
  (cd "${ROOT_DIR}" && npm run engine:build)
fi

# Resolve Python interpreter
PYTHON_BIN="$(resolve_python)"
log_sys "Using Python interpreter: ${PYTHON_BIN}"

# Check backend requirements in Python environment
if ! "${PYTHON_BIN}" -c "import fastapi, uvicorn, firebase_admin" >/dev/null 2>&1; then
  log_sys "Required packages (fastapi, uvicorn, firebase_admin) missing from ${PYTHON_BIN}."
  if [[ ! -d "${BACKEND_DIR}/venv" ]]; then
    log_sys "Creating virtual environment at ${BACKEND_DIR}/venv..."
    python3 -m venv --system-site-packages "${BACKEND_DIR}/venv"
    PYTHON_BIN="${BACKEND_DIR}/venv/bin/python"
  fi
  log_sys "Installing backend requirements..."
  "${PYTHON_BIN}" -m pip install -r "${BACKEND_DIR}/requirements.txt"
fi

# Check ports
check_port "${BACKEND_PORT}" "FastAPI Backend"
check_port "${FRONTEND_PORT}" "Vite Frontend"

# If dry-run / check only, exit cleanly here
if [[ "${1:-}" == "--check" ]] || [[ "${1:-}" == "--dry-run" ]]; then
  echo ""
  log_sys "Pre-flight checks passed successfully (--check mode)."
  log_api "Backend target: http://${BACKEND_HOST}:${BACKEND_PORT}"
  log_web "Frontend target: http://localhost:${FRONTEND_PORT}"
  trap - INT TERM EXIT
  exit 0
fi

echo ""
log_sys "=========================================================="
log_sys "Starting Galvaniy Labs Development Environment"
log_api "Backend API  : http://${BACKEND_HOST}:${BACKEND_PORT}"
log_api "API Docs     : http://${BACKEND_HOST}:${BACKEND_PORT}/docs"
log_web "Frontend App : http://localhost:${FRONTEND_PORT}"
log_sys "=========================================================="
echo ""

# Start FastAPI Backend
log_api "Launching uvicorn server on port ${BACKEND_PORT}..."
(
  cd "${BACKEND_DIR}"
  exec "${PYTHON_BIN}" -m uvicorn app.main:app \
    --host "${BACKEND_HOST}" \
    --port "${BACKEND_PORT}" \
    --reload
) &
BACKEND_PID=$!

# Start Vite Frontend
log_web "Launching Vite dev server on port ${FRONTEND_PORT}..."
(
  cd "${ROOT_DIR}"
  exec npm run dev
) &
FRONTEND_PID=$!

# Wait for both processes
wait -n "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
cleanup
