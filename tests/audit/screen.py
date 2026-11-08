# Prints what the iOS accessibility tree holds right now (via `maestro hierarchy`), so a failed flow can be read
# from the log: every node whose text mentions the words given, with its position and whether it is enabled,
# any keyboard, and the first texts on screen.  Usage: python3 screen.py <udid> <label> [word ...]
import json, re, subprocess, sys
udid, label = sys.argv[1], sys.argv[2]
words = sys.argv[3:] or ["Keep", "Patience", "Kept", "mind"]
out = subprocess.run(["maestro", "--device", udid, "hierarchy"], capture_output=True, text=True).stdout
i = out.find("{")
print("== screen:", label)
try:
    tree = json.loads(out[i:])
except Exception as e:
    print("no hierarchy:", e, out[:200]); sys.exit(0)
pat = re.compile("|".join(map(re.escape, words)) + "|Keyboard|keyboard", re.I)
texts, hits, n = [], [], 0
def walk(node):
    global n
    n += 1
    a = node.get("attributes", {})
    vals = [a.get(k) for k in ("text", "accessibilityText", "hintText", "title", "value") if a.get(k)]
    for v in vals:
        v = v.strip()
        if v and v not in texts: texts.append(v)
    if any(pat.search(v) for v in vals) or pat.search(str(a.get("class", ""))):
        hits.append({k: a[k] for k in a if k in ("text", "accessibilityText", "bounds", "enabled", "focused", "class", "resource-id") and a[k] != ""})
    for c in node.get("children", []): walk(c)
walk(tree)
print("nodes:", n)
for h in hits[:25]: print("hit:", json.dumps(h)[:260])
for t in texts[:40]: print("text:", t[:140])
