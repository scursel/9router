#!/usr/bin/env bash
# Coleta o estado do repo 9router-enhanced + métricas para conferência/revisão
# Uso: bash scripts/collect-review-package.sh
set -u
REPO=/home/scursel/9router-enhanced
OUT=/tmp/9router-review
mkdir -p "$OUT"
TS=$(date +%Y%m%d-%H%M%S)

{
echo "# Pacote de conferência — 9router-enhanced"
echo "Gerado em: $TS"
echo "Branch: $(cd $REPO && git branch --show-current)"
echo ""
echo "## Estado do serviço"
echo '```'
curl -s --max-time 10 http://127.0.0.1:20128/api/health
echo
curl -s --max-time 10 http://127.0.0.1:20128/api/version
echo
echo "startup status: $(cat ~/.9router/quota-tracker-startup.status 2>/dev/null)"
echo '```'
echo ""
echo "## Diff do repo (git diff --stat)"
cd "$REPO"
echo '```'
git diff --stat
echo '```'
echo ""
echo "## Arquivos novos (untracked)"
echo '```'
git status --short
echo '```'
echo ""
echo "## Verificação sintaxe dos scripts"
for f in scripts/start-9router.sh install.sh; do
  bash -n "$f" 2>/dev/null && echo "$f: OK" || echo "$f: FALHOU"
done
echo ""
echo "## Combos atuais (SQLite)"
sqlite3 ~/.9router/db/data.sqlite "SELECT name, models FROM combos;" 2>/dev/null | head -20
} > "$OUT/review-$TS.md"

echo "Pacote salvo: $OUT/review-$TS.md"