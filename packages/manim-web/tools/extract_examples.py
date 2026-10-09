"""Extract the `.. manim:: Name` examples from manim's docstrings.

    python tools/extract_examples.py <site-packages/manim> examples/manim_examples.json
"""
import ast, json, re, sys, textwrap
from pathlib import Path

root = Path(sys.argv[1])
out = []
for f in sorted(root.rglob("*.py")):
    rel = f.relative_to(root.parent).as_posix()
    try:
        tree = ast.parse(f.read_text())
    except SyntaxError:
        continue
    for node in ast.walk(tree):
        if not isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef)):
            continue
        doc = ast.get_docstring(node, clean=True)
        if not doc or ".. manim::" not in doc:
            continue
        lines = doc.splitlines()
        i = 0
        while i < len(lines):
            m = re.match(r"^(\s*)\.\. manim:: (\w+)", lines[i])
            if not m:
                i += 1
                continue
            indent, name = len(m.group(1)), m.group(2)
            i += 1
            opts = {}
            while i < len(lines) and re.match(r"^\s*:(\w+):\s*(.*)$", lines[i]):
                k, v = re.match(r"^\s*:(\w+):\s*(.*)$", lines[i]).groups()
                opts[k] = v or True
                i += 1
            body = []
            while i < len(lines) and (not lines[i].strip() or len(lines[i]) - len(lines[i].lstrip()) > indent):
                body.append(lines[i])
                i += 1
            code = textwrap.dedent("\n".join(body)).strip("\n")
            owner = getattr(node, "name", "<module>")
            out.append({"name": name, "module": rel, "owner": owner, "options": opts, "code": code})
json.dump(out, open(sys.argv[2], "w"), indent=1)
print(len(out), "examples")
