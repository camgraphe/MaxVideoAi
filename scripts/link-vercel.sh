#!/usr/bin/env bash
set -euo pipefail

# Link this project to Vercel using Vercel CLI.

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI is not installed. Install with: npm i -g vercel" >&2
  exit 1
fi

echo "Linking project to Vercel..."
vercel link

echo "To add environment variables, run:"
echo "  vercel env add"
echo "Then deploy preview:"
echo "  vercel"
echo "Deploy production:"
echo "  vercel --prod"

