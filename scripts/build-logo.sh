#!/usr/bin/env bash
# Gera o logo (pxl) e os ícones do site a partir de art/logo.px.js.
# Uso: PXL=/caminho/para/pxl.js bash scripts/build-logo.sh   (precisa de ffmpeg)
set -euo pipefail
cd "$(dirname "$0")/.."
node "${PXL:-$HOME/.claude/skills/pxl-pixel-art/bin/pxl.js}" build art/logo.px.js
SRC=art/out/logo.png
BG=0x1b1f3a
# Ampliação sem suavizar (pixel art nítido). O logo tem 34×34.
up() { ffmpeg -loglevel error -y -i "$SRC" -vf "scale=$1:$1:flags=neighbor" "$2"; }
# Ícone com fundo e margem (Apple e Android exigem ícone opaco).
padded() { ffmpeg -loglevel error -y -i "$SRC" -vf "scale=$2:$2:flags=neighbor,pad=$1:$1:(ow-iw)/2:(oh-ih)/2:color=$BG" "$3"; }
mkdir -p public/icons
cp "$SRC" public/logo.png                          # 34×34: a página amplia com image-rendering: pixelated
up 136 src/app/icon.png                            # ícone do navegador (Next.js gera o <link rel="icon">)
ffmpeg -loglevel error -y -i "$SRC" -vf "scale=32:32:flags=neighbor" src/app/favicon.ico   # /favicon.ico clássico
padded 180 136 src/app/apple-icon.png              # iPhone/iPad
padded 192 136 public/icons/icon-192.png           # Android / PWA
padded 512 408 public/icons/icon-512.png
echo "✓ logo e ícones gerados"
