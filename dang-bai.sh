#!/usr/bin/env bash
# dang-bai.sh — Dong bo note da gan `publish: true` roi day len web.
#
# Dung: ./dang-bai.sh  (hoac: ./dang-bai.sh "mo ta thay doi")
set -euo pipefail

cd "$(dirname "$0")"

echo "→ Loc note co publish: true tu vault..."
node sync-publish.mjs

echo "→ Build thu de bat loi truoc khi day len..."
npx quartz build >/dev/null

if [[ -z "$(git status --porcelain content)" ]]; then
  echo "✓ Khong co thay doi nao. Web dang dung roi."
  exit 0
fi

echo ""
echo "→ Thay doi sap dua len web:"
git status --short content
echo ""

read -r -p "Dong y day len chieuthu.com? [y/N] " ok
[[ "$ok" == "y" || "$ok" == "Y" ]] || { echo "Da huy."; exit 0; }

git add content
git commit -m "${1:-cap nhat noi dung}"
git push

echo ""
echo "✓ Da day len. Web se cap nhat sau ~1-2 phut."
echo "  Xem tien trinh: tab Actions tren GitHub repo."
