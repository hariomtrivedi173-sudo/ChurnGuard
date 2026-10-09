import glob
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("=== AUDITING FRONTEND COMPONENTS FOR LIGHT MODE TEXT COLOR ISSUES ===")
for fpath in glob.glob("frontend/src/**/*.jsx", recursive=True):
    with open(fpath, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        # Match inline style color with light values
        m = re.search(r'color:\s*[\'"](#fff(?:fff)?|white|#f8fafc|#cbd5e1|#94a3b8|var\(--slate-100\)|var\(--slate-200\)|var\(--slate-300\)|var\(--slate-400\)|var\(--slate-50\))[\'"]', line, re.I)
        if m:
            print(f"{fpath}:{i+1}: inline color='{m.group(1)}' -> {line.strip()[:100]}")
