#!/usr/bin/env bash
# تركيب فيديو «طريق السيارة» من لقطات الهاتف الحقيقية + النصوص + المؤثرات (+ التعليق إن وُجد).
#
# 1) ضع اللقطات في: videos/03-tri9-sayyara/footage/
#      shot1.mp4  shot2.mp4  shot3.mp4  shot4a.mp4  shot4b.mp4  shot5.mp4
#    (أي صيغة يقرؤها ffmpeg: .mp4 / .mov — عمودي أو أفقي، يُقص تلقائيًا إلى 1080×1920)
#    كل لقطة تؤخذ من بدايتها بالمدة المحددة أسفله. لتبدأ من ثانية أخرى: أنشئ ملفًا
#    footage/shot3.start يحتوي رقمًا مثل 2.5
# 2) (اختياري) التعليق الصوتي: videos/03-tri9-sayyara/vo.wav (أو vo.m4a)
# 3) من مجلد kamari-kids-tiktok:   bash videos/03-tri9-sayyara/compose.sh
#    النتيجة: out/03-tri9-sayyara.mp4
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
FOOT="${FOOTAGE_DIR:-$HERE/footage}"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

# اسم اللقطة:المدة بالثواني — يطابق SHOTS في index.html
SHOTS=(shot1:3 shot2:5 shot3:8 shot4a:2.5 shot4b:2.5 shot5:4)

: > "$WORK/list.txt"
for entry in "${SHOTS[@]}"; do
  name="${entry%%:*}"; dur="${entry##*:}"
  src="$(ls "$FOOT/$name".* 2>/dev/null | grep -viE '\.start$' | head -n1 || true)"
  [ -n "$src" ] || { echo "ناقص: $FOOT/$name.mp4" >&2; exit 1; }
  start=0; [ -f "$FOOT/$name.start" ] && start="$(cat "$FOOT/$name.start")"
  have=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src" | cut -d. -f1)
  echo "• $name ← $(basename "$src") (من ${start}ث، ${dur}ث؛ مدة الملف ~${have}ث)"
  if ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$src" | grep -q .; then
    AIN=(-ss "$start" -t "$dur" -i "$src"); AMAP="[0:a]aresample=44100,aformat=channel_layouts=stereo,apad[a]"
  else
    AIN=(-ss "$start" -t "$dur" -i "$src" -f lavfi -i anullsrc=r=44100:cl=stereo); AMAP="[1:a]anull[a]"
  fi
  ffmpeg -v error -y "${AIN[@]}" -filter_complex \
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=$dur[v];$AMAP" \
    -map "[v]" -map "[a]" -t "$dur" -c:v libx264 -crf 16 -preset fast -c:a aac -b:a 160k "$WORK/$name.mp4"
  echo "file '$WORK/$name.mp4'" >> "$WORK/list.txt"
done
ffmpeg -v error -y -f concat -safe 0 -i "$WORK/list.txt" -c copy "$WORK/base.mp4"
cd "$ROOT"
node engine/render.mjs videos/03-tri9-sayyara --base "$WORK/base.mp4" --out "${OUT:-$ROOT/out/03-tri9-sayyara.mp4}"
