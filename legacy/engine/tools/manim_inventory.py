"""Inventory of manim CE: code lines (no docstrings/comments/blank), classes, public functions per module."""
import ast, sys, json
from pathlib import Path
root = Path(sys.argv[1])
rows = []
for f in sorted(root.rglob("*.py")):
    rel = f.relative_to(root).as_posix()
    src = f.read_text()
    tree = ast.parse(src)
    doc_lines = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            b = getattr(node, "body", [])
            if b and isinstance(b[0], ast.Expr) and isinstance(getattr(b[0], "value", None), ast.Constant) and isinstance(b[0].value.value, str):
                doc_lines.update(range(b[0].lineno, b[0].end_lineno + 1))
    loc = sum(1 for i, l in enumerate(src.splitlines(), 1) if l.strip() and not l.strip().startswith("#") and i not in doc_lines)
    classes = [n.name for n in tree.body if isinstance(n, ast.ClassDef)]
    funcs = [n.name for n in tree.body if isinstance(n, ast.FunctionDef) and not n.name.startswith("_")]
    methods = sum(1 for n in ast.walk(tree) if isinstance(n, ast.FunctionDef))
    rows.append({"file": rel, "loc": loc, "classes": len(classes), "public_classes": len([c for c in classes if not c.startswith("_")]), "funcs": len(funcs), "defs": methods})
json.dump(rows, open("/tmp/claude-501/manim_inventory.json", "w"))
tot = sum(r["loc"] for r in rows)
print("files", len(rows), "code LOC", tot, "classes", sum(r["classes"] for r in rows), "public classes", sum(r["public_classes"] for r in rows))
