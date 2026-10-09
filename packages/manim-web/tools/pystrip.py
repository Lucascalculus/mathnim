# Print python source without docstrings/comments/type-only imports (for porting).
import ast, sys
for path in sys.argv[1:]:
    src = open(path).read()
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef, ast.Module)):
            b = node.body
            if b and isinstance(b[0], ast.Expr) and isinstance(getattr(b[0], 'value', None), ast.Constant) and isinstance(b[0].value.value, str):
                node.body = b[1:] or [ast.Pass()]
    tree.body = [n for n in tree.body if not (isinstance(n, ast.If) and 'TYPE_CHECKING' in ast.unparse(n.test))]
    print(f"# ===== {path.split('site-packages/')[-1]}")
    print(ast.unparse(tree))
