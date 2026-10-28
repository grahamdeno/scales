#!/bin/bash
# scripts/ship.sh BRANCH ISSUE "PR title" — commit staged work (message in msg.txt), push, PR closing the issue, merge, wait for CI.
set -e
cd "$(dirname "$0")/.."
B="$1"; N="$2"; T="$3"; S="${SCRATCH:?set SCRATCH to the folder holding msg.txt}"
node --test 2>&1 | grep -E "^# fail 0" >/dev/null || { echo "TESTS FAIL"; node --test 2>&1 | grep -E "^not ok"; exit 1; }
git add -A
printf '%s\n\nCloses #%s\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n' "$(cat $S/msg.txt)" "$N" > $S/msg-full.txt
git -c user.name=grahamdeno -c user.email=grahamdeno@users.noreply.github.com commit -q -F $S/msg-full.txt
git push -q origin "$B" 2>&1 | grep -v "^remote:" || true
BODY="$(tail -n +3 $S/msg.txt)

Closes #$N

🤖 Generated with [Claude Code](https://claude.com/claude-code)

PR=$(gh api repos/grahamdeno/scales/pulls -f title="$T" -f head="$B" -f base=main -f body="$BODY" -q .number)
sleep 6
gh api -X PUT repos/grahamdeno/scales/pulls/$PR/merge -f merge_method=merge -f commit_title="Merge pull request #$PR: $T" -q .merged >/dev/null
git checkout -q main && git fetch -q origin main && git reset -q --hard origin/main
H=$(git rev-parse --short HEAD)
for i in $(seq 1 15); do
  r=$(gh run list -R grahamdeno/scales -L 4 --json name,status,conclusion,headSha -q '.[] | "\(.name) \(.status) \(.conclusion) \(.headSha[0:7])"' 2>&1)
  if echo "$r" | grep "$H" | grep -q "in_progress\|queued" || ! echo "$r" | grep -q "pages.*$H"; then sleep 20; else break; fi
done
echo "PR #$PR merged; issue #$N: $(gh api repos/grahamdeno/scales/issues/$N -q .state)"
echo "$r" | grep "$H"
