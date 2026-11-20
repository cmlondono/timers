#!/usr/bin/env bash
# Genera las imágenes de la app a partir de los emoji animados de Microsoft
# (https://github.com/microsoft/fluentui-emoji-animated, licencia MIT).
# Requiere: curl y ffmpeg (con libwebp).
# Uso: bash scripts/build-assets.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
BASE="https://media.githubusercontent.com/media/microsoft/fluentui-emoji-animated/main/assets"

# nombre de archivo final -> carpeta en el repositorio de Microsoft
declare -A SRC=(
  [pig_face]="Pig face"
  [pig]="Pig"
  [pig_nose]="Pig nose"
  [pink_heart]="Pink heart"
  [sparkling_heart]="Sparkling heart"
  [two_hearts]="Two hearts"
  [zzz]="Zzz"
  [alarm_clock]="Alarm clock"
  [party_popper]="Party popper"
  [stopwatch]="Stopwatch"
)

for name in "${!SRC[@]}"; do
  folder="${SRC[$name]}"
  curl -sfL "$BASE/${folder// /%20}/animated/${name}_animated.png" -o "$TMP/$name.png"
done

# Emoji animados -> WebP animado de 128 px (mucho más liviano que el APNG original).
mkdir -p "$ROOT/img"
for name in pig_face pig pig_nose pink_heart sparkling_heart two_hearts zzz alarm_clock party_popper; do
  ffmpeg -hide_banner -loglevel error -y -f apng -i "$TMP/$name.png" \
    -vf "fps=20,scale=128:128:flags=lanczos" -c:v libwebp_anim -lossless 0 -quality 72 \
    -compression_level 4 -loop 0 -pix_fmt yuva420p "$ROOT/img/$name.webp"
done

# Iconos: cara de cerdito + cronómetro sobre degradado rosa.
ffmpeg -hide_banner -loglevel error -y -f apng -i "$TMP/pig_face.png" -frames:v 1 "$TMP/face.png"
ffmpeg -hide_banner -loglevel error -y -f apng -i "$TMP/stopwatch.png" -frames:v 1 "$TMP/watch.png"

icon() { # tamaño, tamaño cerdito, x, y, tamaño cronómetro, x, y, salida
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "color=c=white:s=$1x$1,format=rgb24,geq=r='255-11*Y/H':g='224-61*Y/H':b='236-40*Y/H'" \
    -i "$TMP/face.png" -i "$TMP/watch.png" \
    -filter_complex "[1]scale=$2:$2:flags=lanczos[p];[2]scale=$5:$5:flags=lanczos[s];[0][p]overlay=$3:$4[a];[a][s]overlay=$6:$7,format=rgba" \
    -frames:v 1 "$8"
}
mkdir -p "$ROOT/icons"
icon 512 380 40 38 210 282 282 "$ROOT/icons/icon-512.png"
icon 512 300 76 80 170 268 268 "$ROOT/icons/icon-maskable-512.png"
icon 192 142 15 14 79 106 106 "$ROOT/icons/icon-192.png"
icon 180 134 14 13 74 99 99 "$ROOT/icons/apple-touch-icon.png"

rm -rf "$TMP"
echo "Listo: img/ e icons/ actualizados"
