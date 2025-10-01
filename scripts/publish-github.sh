#!/usr/bin/env bash
set -euo pipefail

# Publish this repo to GitHub using gh CLI.
# - Creates a private repo named after the current directory if none exists.
# - Sets main as default branch and pushes.

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is not installed. Install with: brew install gh" >&2
  exit 1
fi

repo_name="$(basename "$(pwd)")"

echo "Checking Git status..."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repo" >&2; exit 1; }

default_branch="main"
current_branch="$(git rev-parse --abbrev-ref HEAD)"

if [ "$current_branch" != "$default_branch" ]; then
  echo "Switching to $default_branch (or creating it)..."
  git checkout -B "$default_branch"
fi

echo "Verifying .env files are ignored..."
if git check-ignore -q .env .env.local; then
  echo "OK: .env files are ignored by Git."
else
  echo "Warning: .env files might not be ignored. Add '\n.env*' to .gitignore before proceeding." >&2
fi

echo "Checking GitHub authentication..."
if ! gh auth status >/dev/null 2>&1; then
  echo "You are not authenticated with gh. Run: gh auth login -h github.com" >&2
  exit 1
fi

origin_url="$(git remote get-url origin 2>/dev/null || true)"

if [ -z "$origin_url" ]; then
  echo "No origin remote. Creating GitHub repo '$repo_name' (private) and pushing..."
  gh repo create "$repo_name" --private --source=. --push
else
  echo "Origin remote exists: $origin_url"
  echo "Pushing to origin..."
  git push -u origin "$default_branch"
fi

echo "Done."

