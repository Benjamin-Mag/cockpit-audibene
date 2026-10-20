#!/usr/bin/env bash
# Publie UN correctif (un commit déjà fait sur une branche partie de main) dans les trois versions :
#   1. main = nouveau design (Fusion, 1.1.x) : PR fusionnée en merge, tag, copie dans « Extensions installees/Cockpit Audibene » ;
#   2. classique (1.0.x) : cherry-pick du correctif, tag classique-vX ;
#   3. Cockpit Benjamin (2.x, dépôt voisin) : merge de upstream/main (nouveau design depuis le 2026-10-20 ; avant : upstream/classique) ;
#   puis release publique `cockpit-audibene-install` avec les deux zips (Fusion + classique), marquée latest.
#
# Usage : scripts/publier-trois-versions.sh <commit> <version-fusion> <version-classique> <version-perso> <dossier-textes>
#   <dossier-textes> contient : titre.txt (titre de la PR, une ligne), pr.md (description de la PR),
#   notes.md (notes de la release publique) et, facultatif, doc.mjs (mise à jour de CLAUDE.md et du journal,
#   lancé à la racine du worktree main avant le commit de version).
# Variables facultatives : PW_PORT_FUSION (5610), PW_PORT_CLASSIQUE (5611), CHROMIUM_PATH (Chrome du poste).
#
# Le correctif ne doit toucher que ce qui est commun aux deux dispositions s'il doit aller sur classique ;
# un changement propre au nouveau design se publie à la main (étapes 1 et release seulement).
# Rien ne se publie dans la version de Benjamin sans son feu vert explicite (voir CLAUDE.md).
set -euo pipefail

[ $# -eq 5 ] || { sed -n '2,15p' "$0"; exit 2; }
FIX=$1; VF=$2; VC=$3; VP=$4; TXT=$(cd "$5" && pwd)
for f in titre.txt pr.md notes.md; do [ -f "$TXT/$f" ] || { echo "manque $TXT/$f"; exit 2; }; done

DEPOT=$(cd "$(dirname "$0")/.." && pwd)
PROJETS=$(dirname "$DEPOT")
PERSO="$PROJETS/Cockpit Benjamin"
EXT="$PROJETS/Extensions installees"
GH=${GH:-"/c/Program Files/GitHub CLI/gh.exe"}
R=Benjamin-Mag/cockpit-audibene
RI=Benjamin-Mag/cockpit-audibene-install
CH=${CHROMIUM_PATH:-"C:/Program Files/Google/Chrome/Application/chrome.exe"}
TMP=$(mktemp -d)
W="$TMP/fusion"; WC="$TMP/classique"; Z="$TMP/zips"; mkdir -p "$Z"

version() { # $1 = version : package.json, package-lock.json et manifest
  npm version "$1" --no-git-tag-version --allow-same-version >/dev/null
  node -e 'const fs=require("fs");const f="public/manifest.json";fs.writeFileSync(f,fs.readFileSync(f,"utf8").replace(/"version": "[^"]*"/,()=>`"version": "${process.argv[1]}"`))' "$1"
}
banc() { # $1 = port, $2 = journal
  set +e
  CHROMIUM_PATH="$CH" PW_PORT="$1" npx playwright test --reporter=line > "$2" 2>&1
  local c=$?
  set -e
  tail -1 "$2"
  if [ "$c" != 0 ]; then grep -E "✘|failed|Error" "$2" | head -12; exit 1; fi
}

# ---------------------------------------------------------------- 1. nouveau design (main)
cd "$DEPOT"
git fetch -q origin
git worktree add -q --detach "$W" "$FIX"
cd "$W"
git merge-base --is-ancestor origin/main HEAD || { echo "le correctif ne part pas du main actuel : rebase d'abord"; exit 1; }
version "$VF"
[ -f "$TXT/doc.mjs" ] && node "$TXT/doc.mjs"
npm ci --silent 2>&1 | tail -1 || true
npx tsc --noEmit
banc "${PW_PORT_FUSION:-5610}" "$TMP/banc-fusion.log"
npm run build 2>&1 | grep -E "^build "
git add -A
git -c core.autocrlf=false commit -q -m "v$VF : $(cat "$TXT/titre.txt")

Co-Authored-By: Claude <noreply@anthropic.com>"
BR="pub/v$VF"
timeout 90 git push -q origin "HEAD:refs/heads/$BR"
PR=$("$GH" pr create --repo "$R" --base main --head "$BR" --title "v$VF : $(cat "$TXT/titre.txt")" --body-file "$TXT/pr.md")
"$GH" pr merge --repo "$R" "$PR" --merge --delete-branch
cd "$DEPOT"
git worktree remove --force "$W"
git fetch -q origin
git merge -q --ff-only origin/main
git tag "v$VF"
timeout 90 git push -q origin "v$VF"
npm run build 2>&1 | grep -E "^build "
rm -rf "$EXT/Cockpit Audibene"/*
cp -r dist/. "$EXT/Cockpit Audibene/"
npm run zip 2>&1 | tail -1
cp release/cockpit-audibene.zip "release/cockpit-audibene-$VF.zip" "$Z/"
rm -rf release

# ---------------------------------------------------------------- 2. classique
git worktree add -q --detach "$WC" origin/classique
cd "$WC"
git -c core.autocrlf=false cherry-pick -x "$FIX" >/dev/null || { git status --short; echo "conflit au report sur classique : à résoudre à la main dans $WC"; exit 1; }
version "$VC"
npm ci --silent 2>&1 | tail -1 || true
npx tsc --noEmit
banc "${PW_PORT_CLASSIQUE:-5611}" "$TMP/banc-classique.log"
git add -A
git -c core.autocrlf=false commit -q -m "classique v$VC : $(cat "$TXT/titre.txt") (report depuis main v$VF)

Co-Authored-By: Claude <noreply@anthropic.com>"
timeout 90 git push -q origin HEAD:classique
git tag "classique-v$VC"
timeout 90 git push -q origin "classique-v$VC"
npm run build 2>&1 | grep -E "^build "
npm run zip 2>&1 | tail -1
cp release/cockpit-audibene.zip "$Z/cockpit-audibene-classique.zip"
cp "release/cockpit-audibene-$VC.zip" "$Z/cockpit-audibene-classique-$VC.zip"
cd "$DEPOT"
git worktree remove --force "$WC"
git fetch -q origin
git branch -f classique origin/classique >/dev/null 2>&1 || true

# ---------------------------------------------------------------- release publique (les deux zips)
"$GH" release create "v$VF" --repo "$RI" --latest --title "Cockpit Audibene v$VF" --notes-file "$TXT/notes.md" \
  "$Z/cockpit-audibene.zip" "$Z/cockpit-audibene-$VF.zip" "$Z/cockpit-audibene-classique.zip" "$Z/cockpit-audibene-classique-$VC.zip" >/dev/null
vf=$(curl -sL "https://github.com/$RI/releases/latest/download/cockpit-audibene.zip" -o "$TMP/f.zip" -w '%{http_code}')
vc=$(curl -sL "https://github.com/$RI/releases/latest/download/cockpit-audibene-classique.zip" -o "$TMP/c.zip" -w '%{http_code}')
echo "zip nouveau design : HTTP $vf $(unzip -p "$TMP/f.zip" manifest.json | grep -o '"version": "[^"]*"' | head -1)"
echo "zip classique : HTTP $vc $(unzip -p "$TMP/c.zip" manifest.json | grep -o '"version": "[^"]*"' | head -1)"

# ---------------------------------------------------------------- 3. Cockpit Benjamin (depuis classique)
cd "$PERSO"
git fetch -q upstream
git merge upstream/main --no-edit >/dev/null 2>&1 || true
node "$DEPOT/scripts/conflits-perso.mjs" "$VP" "v$VF ($(cat "$TXT/titre.txt")) reportée depuis upstream/main le $(date +%F) → v$VP."
git add -A
if [ -n "$(git diff --name-only --diff-filter=U)" ]; then echo "conflits restants dans Cockpit Benjamin :"; git diff --name-only --diff-filter=U; exit 1; fi
if git grep -q "^<<<<<<< " -- . ':!node_modules'; then echo "marqueurs restants :"; git grep -l "^<<<<<<< " -- . ':!node_modules'; exit 1; fi
npm ci --silent 2>&1 | tail -1 || true
npx tsc --noEmit
npm run build 2>&1 | grep -E "^build "
git add -A
git -c core.autocrlf=false commit -q -m "v$VP : report de v$VF ($(cat "$TXT/titre.txt"))

Co-Authored-By: Claude <noreply@anthropic.com>"
timeout 90 git push -q origin main
git tag "v$VP"
timeout 90 git push -q origin "v$VP"
rm -rf "$EXT/Cockpit Benjamin"/*
cp -r dist/. "$EXT/Cockpit Benjamin/"
echo "Cockpit Benjamin : $(grep -o '"version": "[^"]*"' "$EXT/Cockpit Benjamin/manifest.json" | head -1)"
rm -rf "$TMP"
echo "TOUT_PUBLIE"
