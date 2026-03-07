#!/usr/bin/env bash

SESSION="anglish"
PROJECT_ROOT="$(pwd)"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux attach -t "$SESSION"
  exit 0
fi

tmux new-session -d -s "$SESSION" -c "$PROJECT_ROOT"

# Window: CLI
tmux rename-window -t "$SESSION:3" "cli"

# Window: Editor
tmux new-window -t "$SESSION" -n "editor" -c "$PROJECT_ROOT" "nvim"

# Window: Services
tmux new-window -t "$SESSION" -n "services"
tmux split-window -v -t "$SESSION:3"
tmux split-window -v -t "$SESSION:3"
tmux split-window -v -t "$SESSION:3"
tmux select-layout -t "$SESSION:3" tiled
tmux send-keys -t "$SESSION:3.1" "clear; pnpm run build:watch" C-m
tmux send-keys -t "$SESSION:3.2" "clear; pnpm -F @anglish/api run dev" C-m
tmux send-keys -t "$SESSION:3.3" "clear; pnpm -F @anglish/www run dev" C-m
tmux send-keys -t "$SESSION:3.4" "clear; pnpm -F @anglish/editor run dev" C-m

tmux select-window -t "$SESSION:1"
tmux attach -t "$SESSION"
