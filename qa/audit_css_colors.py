import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('frontend/src/index.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Let's find rules with color properties that are NOT inside [data-theme="dark"]
# Split by rules
lines = css.split('\n')
in_dark = False
for i, line in enumerate(lines):
    if '[data-theme="dark"]' in line:
        in_dark = True
    elif in_dark and line.strip().startswith('}'):
        # rough check
        pass
    
    # Check for color: var(--slate-...) or color: #... or color: hsl(...)
    m = re.search(r'^\s*color:\s*([^;]+);', line)
    if m:
        val = m.group(1).strip()
        # Look back up to 5 lines for selector
        selector = ""
        for j in range(max(0, i-5), i):
            if '{' in lines[j] or ',' in lines[j]:
                selector += " " + lines[j].strip()
        print(f"Line {i+1} [{selector.strip()}]: color = {val}")
