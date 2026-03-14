#!/bin/sh

set -eu

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi

  if [ -n "${CLIENT_PID:-}" ]; then
    kill "$CLIENT_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

npm --prefix server start &
SERVER_PID=$!

npm --prefix client run dev &
CLIENT_PID=$!

wait "$SERVER_PID" "$CLIENT_PID"
