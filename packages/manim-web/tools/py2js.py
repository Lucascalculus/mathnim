"""Transpile manim scene code (Python) to JavaScript for manim-web.

    python tools/py2js.py scene.py > scene.js
    python tools/py2js.py --json examples.json out.json   (batch: adds "js" to each item)

The output is the body of a function `(M, $) => {...}` where M is the
manim-web namespace and $ the runtime in src/ext/py (see load() there). It
returns an object with every top-level class and function.

Python semantics are kept by routing operators, indexing, truthiness and
calls through small runtime helpers (`$.add`, `$.getitem`, `$.params`...).
Unsupported constructs raise Unsupported with the line number.
"""
from __future__ import annotations

import ast
import json
import sys

JS_RESERVED = {
    "arguments", "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do",
    "else", "enum", "eval", "export", "extends", "false", "finally", "for", "function", "if", "implements", "import",
    "in", "instanceof", "interface", "let", "new", "null", "package", "private", "protected", "public", "return",
    "static", "super", "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield",
    "undefined", "NaN", "Infinity", "Object", "Array", "Math", "Symbol", "Map", "Set", "String", "Number", "Boolean",
    "Function", "Promise", "Error", "JSON", "Date", "RegExp", "M", "$", "$g",
}
# Methods of Python built-in types; calls go through $.call so JS values behave.
PY_METHODS = {
    "append", "extend", "insert", "pop", "remove", "index", "count", "sort", "reverse", "copy", "clear", "join", "split",
    "strip", "lstrip", "rstrip", "upper", "lower", "title", "capitalize", "startswith", "endswith", "replace", "find",
    "rfind", "format", "splitlines", "isdigit", "isalpha", "isspace", "zfill", "center", "ljust", "rjust", "items",
    "keys", "values", "get", "update", "setdefault", "tolist", "flatten", "ravel", "reshape", "astype", "dot", "sum",
    "mean", "max", "min", "any", "all", "round", "conjugate", "add", "discard", "is_integer", "encode",
}
TRANSLATED_ATTRS = {"points", "T", "shape", "real", "imag", "size", "ndim", "__dict__", "__name__", "__class__", "__doc__"}
BINOPS = {
    ast.Add: "add", ast.Sub: "sub", ast.Mult: "mul", ast.Div: "div", ast.FloorDiv: "floordiv", ast.Mod: "mod",
    ast.Pow: "pow", ast.MatMult: "matmul", ast.BitAnd: "bitand", ast.BitOr: "bitor", ast.BitXor: "bitxor",
    ast.LShift: "lshift", ast.RShift: "rshift",
}
JS_NUM_OPS = {ast.Add: "+", ast.Sub: "-", ast.Mult: "*", ast.Div: "/"}
AUG = {ast.Add: "iadd", ast.Sub: "isub", ast.Mult: "imul", ast.Div: "itruediv", ast.FloorDiv: "ifloordiv", ast.Mod: "imod", ast.Pow: "ipow"}
CMPOPS = {ast.Eq: "eq", ast.NotEq: "ne", ast.Lt: "lt", ast.LtE: "le", ast.Gt: "gt", ast.GtE: "ge"}
MODULES = {"numpy": "numpy", "math": "math", "random": "random", "manim": "manim", "numpy.random": "numpy.random"}


class Unsupported(Exception):
    pass


def ident(name: str) -> str:
    return name + "_" if name in JS_RESERVED else name


def assigned_names(body: list[ast.stmt]) -> tuple[set[str], set[str]]:
    """Names bound in a function/module body (not nested scopes), and globals/nonlocals."""
    bound: set[str] = set()
    declared: set[str] = set()

    def targets(t: ast.AST):
        if isinstance(t, ast.Name):
            bound.add(t.id)
        elif isinstance(t, (ast.Tuple, ast.List)):
            for e in t.elts:
                targets(e)
        elif isinstance(t, ast.Starred):
            targets(t.value)

    def visit(n: ast.AST):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            bound.add(n.name)
            return
        if isinstance(n, (ast.Lambda, ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
            return
        if isinstance(n, (ast.Global, ast.Nonlocal)):
            declared.update(n.names)
        elif isinstance(n, ast.Assign):
            for t in n.targets:
                targets(t)
        elif isinstance(n, (ast.AugAssign, ast.AnnAssign)):
            targets(n.target)
        elif isinstance(n, (ast.For, ast.AsyncFor)):
            targets(n.target)
        elif isinstance(n, ast.With):
            for it in n.items:
                if it.optional_vars is not None:
                    targets(it.optional_vars)
        elif isinstance(n, ast.NamedExpr):
            targets(n.target)
        elif isinstance(n, (ast.Import, ast.ImportFrom)):
            for a in n.names:
                if a.name != "*":
                    bound.add((a.asname or a.name).split(".")[0])
        elif isinstance(n, ast.ExceptHandler) and n.name:
            bound.add(n.name)
        for c in ast.iter_child_nodes(n):
            visit(c)

    for s in body:
        visit(s)
    return bound - declared, declared


class _ProtoRewriter(ast.NodeTransformer):
    def __init__(self, names: set[str], cls: str):
        self.names, self.cls = names, cls

    def visit_Name(self, n: ast.Name):
        if n.id in self.names and isinstance(n.ctx, ast.Load):
            return ast.copy_location(ast.Attribute(ast.Attribute(ast.Name(self.cls, ast.Load()), "prototype", ast.Load()), n.id, ast.Load()), n)
        return n


class Ctx:
    """Emission context for one function body."""

    def __init__(self, kind: str, self_name: str | None = None, in_ctor=False):
        self.kind = kind
        self.self_name = self_name
        self.in_ctor = in_ctor
        self.pre_super = False
        self.loop_flags: list[str | None] = []


class Transpiler:
    def __init__(self):
        self.lines: list[str] = []
        self.ind = 0
        self.n = 0
        self.ctx = Ctx("module")
        self.user_classes: set[str] = set()
        self.all_names: set[str] = set()
        self.bound_anywhere: set[str] = set()
        self.pending_decorators: list = []

    # ------------------------------------------------------------ helpers
    def tmp(self, p="t") -> str:
        self.n += 1
        return f"${p}{self.n}"

    def w(self, s: str, node: ast.AST | None = None):
        tag = f" // py:{node.lineno}" if node is not None and hasattr(node, "lineno") else ""
        self.lines.append("  " * self.ind + s + tag)

    def fail(self, node: ast.AST, what: str):
        raise Unsupported(f"line {getattr(node, 'lineno', '?')}: {what}")

    # ------------------------------------------------------------ module
    def module(self, tree: ast.Module) -> str:
        for n in ast.walk(tree):
            if isinstance(n, ast.Name):
                self.all_names.add(n.id)
            if isinstance(n, ast.ClassDef):
                self.user_classes.add(n.name)
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
                a = n.args
                for arg in a.posonlyargs + a.args + a.kwonlyargs + [x for x in (a.vararg, a.kwarg) if x]:
                    self.bound_anywhere.add(arg.arg)
            if isinstance(n, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
                for g in n.generators:
                    for t in ast.walk(g.target):
                        if isinstance(t, ast.Name):
                            self.bound_anywhere.add(t.id)
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Module)):
                b, _ = assigned_names(n.body)
                self.bound_anywhere |= b
            if isinstance(n, ast.ClassDef):
                self.bound_anywhere.add(n.name)
        mod_locals, _ = assigned_names(tree.body)
        externals = sorted(self.all_names - self.bound_anywhere - {"self", "super", "__name__"})
        self.w('"use strict";')
        for name in externals:
            self.w(f"const {ident(name)} = $g({json.dumps(name)});")
        if mod_locals:
            self.w("let " + ", ".join(sorted(ident(x) for x in mod_locals)) + ";")
        self.block(tree.body)
        exports = sorted(
            n.name for n in tree.body if isinstance(n, (ast.ClassDef, ast.FunctionDef))
        )
        self.w("return { " + ", ".join(ident(x) for x in exports) + " };")
        return "\n".join(self.lines) + "\n"

    def block(self, body: list[ast.stmt]):
        for s in body:
            self.stmt(s)

    # ------------------------------------------------------------ statements
    def stmt(self, s: ast.stmt):
        m = getattr(self, "s_" + type(s).__name__, None)
        if m is None:
            self.fail(s, f"statement {type(s).__name__}")
        m(s)

    def s_Expr(self, s: ast.Expr):
        if isinstance(s.value, ast.Constant) and isinstance(s.value.value, str):
            return
        if self._is_super_init(s.value):
            self.super_init(s.value, s)
            return
        self.w(self.expr(s.value) + ";", s)

    def s_Pass(self, s):
        pass

    def s_Break(self, s):
        flag = self.ctx.loop_flags[-1] if self.ctx.loop_flags else None
        self.w(f"{flag} = true; break;" if flag else "break;", s)

    def s_Continue(self, s):
        self.w("continue;", s)

    def s_Return(self, s: ast.Return):
        self.w(f"return {self.expr(s.value) if s.value else 'null'};", s)

    def s_Global(self, s):
        pass

    s_Nonlocal = s_Global

    def s_Assign(self, s: ast.Assign):
        value = self.expr(s.value, escapes=True)
        if len(s.targets) == 1:
            self.assign(s.targets[0], value, s)
            return
        t = self.tmp()
        self.w(f"const {t} = {value};", s)
        for tg in s.targets:
            self.assign(tg, t, s)

    def s_AnnAssign(self, s: ast.AnnAssign):
        if s.value is not None:
            self.assign(s.target, self.expr(s.value, escapes=True), s)

    def assign(self, t: ast.expr, value: str, node):
        if isinstance(t, ast.Name):
            self.w(f"{self.name(t.id)} = {value};", node)
        elif isinstance(t, ast.Attribute):
            obj = self.expr(t.value)
            if t.attr in TRANSLATED_ATTRS:
                self.w(f"$.setattr({obj}, {json.dumps(t.attr)}, {value});", node)
            else:
                self.w(f"{obj}.{t.attr} = {value};", node)
        elif isinstance(t, ast.Subscript):
            self.w(f"$.setitem({self.expr(t.value)}, {self.index(t.slice)}, {value});", node)
        elif isinstance(t, (ast.Tuple, ast.List)):
            if all(self._simple_target(e) for e in t.elts):
                self.w(f"{self.pattern(t)} = {value};", node)
            else:
                tmp = self.tmp()
                self.w(f"const {tmp} = [...$.iter({value})];", node)
                for i, e in enumerate(t.elts):
                    if isinstance(e, ast.Starred):
                        self.fail(node, "starred assignment to non-name")
                    self.assign(e, f"{tmp}[{i}]", node)
        else:
            self.fail(node, f"assignment target {type(t).__name__}")

    def _simple_target(self, e) -> bool:
        if isinstance(e, ast.Name):
            return True
        if isinstance(e, ast.Starred):
            return isinstance(e.value, ast.Name)
        if isinstance(e, (ast.Tuple, ast.List)):
            return all(self._simple_target(x) for x in e.elts)
        return False

    def pattern(self, t) -> str:
        if isinstance(t, ast.Name):
            return self.name(t.id)
        if isinstance(t, ast.Starred):
            return "..." + self.pattern(t.value)
        return "[" + ", ".join(self.pattern(e) for e in t.elts) + "]"

    def s_AugAssign(self, s: ast.AugAssign):
        op = AUG.get(type(s.op)) or BINOPS[type(s.op)]
        rhs = self.expr(s.value)
        t = s.target
        if isinstance(t, ast.Name):
            n = self.name(t.id)
            self.w(f"{n} = $.{op}({n}, {rhs});", s)
        elif isinstance(t, ast.Attribute):
            obj = self.expr(t.value)
            if t.attr in TRANSLATED_ATTRS:
                self.w(f"$.setattr({obj}, {json.dumps(t.attr)}, $.{op}($.getattr({obj}, {json.dumps(t.attr)}), {rhs}));", s)
            else:
                self.w(f"{obj}.{t.attr} = $.{op}({obj}.{t.attr}, {rhs});", s)
        elif isinstance(t, ast.Subscript):
            o, k = self.tmp(), self.tmp()
            self.w(f"{{ const {o} = {self.expr(t.value)}, {k} = {self.index(t.slice)}; $.setitem({o}, {k}, $.{op}($.getitem({o}, {k}), {rhs})); }}", s)
        else:
            self.fail(s, "augmented assignment target")

    def s_If(self, s: ast.If):
        self.w(f"if ({self.test(s.test)}) {{", s)
        self.ind += 1
        self.block(s.body)
        self.ind -= 1
        orelse = s.orelse
        while len(orelse) == 1 and isinstance(orelse[0], ast.If):
            e = orelse[0]
            self.w(f"}} else if ({self.test(e.test)}) {{", e)
            self.ind += 1
            self.block(e.body)
            self.ind -= 1
            orelse = e.orelse
        if orelse:
            self.w("} else {")
            self.ind += 1
            self.block(orelse)
            self.ind -= 1
        self.w("}")

    def _loop(self, head: str, body, orelse, node, pre: list[str] | None = None):
        flag = self.tmp("broke") if orelse else None
        if flag:
            self.w(f"let {flag} = false;")
        self.w(head + " {", node)
        self.ind += 1
        for p in pre or []:
            self.w(p)
        self.ctx.loop_flags.append(flag)
        self.block(body)
        self.ctx.loop_flags.pop()
        self.ind -= 1
        self.w("}")
        if orelse:
            self.w(f"if (!{flag}) {{")
            self.ind += 1
            self.block(orelse)
            self.ind -= 1
            self.w("}")

    def s_For(self, s: ast.For):
        it = f"$.iter({self.expr(s.iter)})"
        if self._simple_target(s.target):
            self._loop(f"for ({self.pattern(s.target)} of {it})", s.body, s.orelse, s)
        else:
            v = self.tmp("v")
            save = self.lines
            self.lines = []
            self.assign(s.target, v, s)
            pre = [x.strip() for x in self.lines]
            self.lines = save
            self._loop(f"for (const {v} of {it})", s.body, s.orelse, s, pre)

    def s_While(self, s: ast.While):
        self._loop(f"while ({self.test(s.test)})", s.body, s.orelse, s)

    def s_Import(self, s: ast.Import):
        for a in s.names:
            if a.asname:
                self.w(f"{self.name(a.asname)} = $.import_({json.dumps(a.name)});", s)
            else:
                top = a.name.split(".")[0]
                self.w(f"{self.name(top)} = $.import_({json.dumps(top)});", s)

    def s_ImportFrom(self, s: ast.ImportFrom):
        mod = s.module or ""
        for a in s.names:
            if a.name == "*":
                continue
            self.w(f"{self.name(a.asname or a.name)} = $.import_({json.dumps(mod)}, {json.dumps(a.name)});", s)

    def s_Assert(self, s: ast.Assert):
        msg = f", {self.expr(s.msg)}" if s.msg else ""
        self.w(f"$.assert_({self.expr(s.test)}{msg});", s)

    def s_Raise(self, s: ast.Raise):
        self.w(f"throw $.raise_({self.expr(s.exc) if s.exc else '$e'});", s)

    def s_Delete(self, s: ast.Delete):
        for t in s.targets:
            if isinstance(t, ast.Subscript):
                self.w(f"$.delitem({self.expr(t.value)}, {self.index(t.slice)});", s)
            elif isinstance(t, ast.Attribute):
                self.w(f"delete {self.expr(t.value)}.{t.attr};", s)
            elif isinstance(t, ast.Name):
                self.w(f"{self.name(t.id)} = undefined;", s)

    def s_Try(self, s: ast.Try):
        ok = self.tmp("ok") if s.orelse else None
        if ok:
            self.w(f"let {ok} = false;")
        self.w("try {", s)
        self.ind += 1
        self.block(s.body)
        if ok:
            self.w(f"{ok} = true;")
        self.ind -= 1
        if s.handlers:
            self.w("} catch ($e) {")
            self.ind += 1
            first = True
            for h in s.handlers:
                cond = "true" if h.type is None else f"$.isexc($e, {self.expr(h.type)})"
                self.w(f"{'if' if first else '} else if'} ({cond}) {{")
                first = False
                self.ind += 1
                if h.name:
                    self.w(f"{self.name(h.name)} = $e;")
                self.block(h.body)
                self.ind -= 1
            self.w("} else { throw $e; }")
            self.ind -= 1
        if s.finalbody:
            self.w("} finally {")
            self.ind += 1
            self.block(s.finalbody)
            self.ind -= 1
        self.w("}")
        if ok:
            self.w(f"if ({ok}) {{")
            self.ind += 1
            self.block(s.orelse)
            self.ind -= 1
            self.w("}")

    def s_With(self, s: ast.With):
        ctxs = []
        for it in s.items:
            c = self.tmp("ctx")
            ctxs.append(c)
            self.w(f"const {c} = {self.expr(it.context_expr)};", s)
            enter = f"$.enter({c})"
            if it.optional_vars is not None:
                self.assign(it.optional_vars, enter, s)
            else:
                self.w(enter + ";")
        self.w("try {")
        self.ind += 1
        self.block(s.body)
        self.ind -= 1
        self.w("} finally {")
        for c in reversed(ctxs):
            self.w(f"  $.exit({c});")
        self.w("}")

    # ------------------------------------------------------------ functions
    def arg_spec(self, a: ast.arguments, skip_first: bool) -> tuple[list[str], list[str], list[str]]:
        """(js param names, spec strings, default expressions)."""
        pos = a.posonlyargs + a.args
        if skip_first:
            pos = pos[1:]
        nd = len(a.defaults)
        defaults_for = [None] * (len(a.posonlyargs + a.args) - nd) + list(a.defaults)
        if skip_first:
            defaults_for = defaults_for[1:]
        names, spec, dflt = [], [], []
        for arg, d in zip(pos, defaults_for):
            names.append(ident(arg.arg))
            spec.append(arg.arg)
            dflt.append(self.expr(d) if d is not None else "$.REQ")
        if a.vararg:
            names.append(ident(a.vararg.arg))
            spec.append("*" + a.vararg.arg)
            dflt.append("undefined")
        for arg, d in zip(a.kwonlyargs, a.kw_defaults):
            names.append(ident(arg.arg))
            spec.append("!" + arg.arg)
            dflt.append(self.expr(d) if d is not None else "$.REQ")
        if a.kwarg:
            names.append(ident(a.kwarg.arg))
            spec.append("**" + a.kwarg.arg)
            dflt.append("undefined")
        return names, spec, dflt

    def declare_params(self, params, spec):
        """`let` for parameters that are not JS parameters (*args, keyword-only, **kwargs)."""
        extra = [p for p, sp in zip(params, spec) if sp.startswith(("*", "!"))]
        if extra:
            self.w("let " + ", ".join(extra) + ";")
        if params:
            self.w(f"[{', '.join(params)}] = $.params(arguments, {json.dumps(spec)}, {self._dc});")

    def function_body(self, node, params: list[str], spec, dflt_const: str | None, prologue: list[str] | None = None):
        local, _ = assigned_names(node.body)
        local -= {x.lstrip("*!") for x in spec}
        local.discard("self")
        for p in prologue or []:
            self.w(p)
        self._dc = dflt_const
        self.declare_params(params, spec)
        if local:
            self.w("let " + ", ".join(sorted(ident(x) for x in local)) + ";")
        self.block(node.body)

    def defaults_const(self, dflt: list[str], node) -> str:
        c = self.tmp("d")
        self.w(f"const {c} = [{', '.join(dflt)}];", node)
        return c

    def s_FunctionDef(self, s: ast.FunctionDef):
        for d in s.decorator_list:
            self.fail(s, "function decorators")
        params, spec, dflt = self.arg_spec(s.args, False)
        dc = self.defaults_const(dflt, s) if params else None
        self.w(f"{self.name(s.name)} = function {ident(s.name)}({', '.join(p for p, sp in zip(params, spec) if not sp.startswith(('*', '!')))}) {{", s)
        self.ind += 1
        saved = self.ctx
        self.ctx = Ctx("function", saved.self_name)
        self.function_body(s, params, spec, dc)
        self.ctx = saved
        self.ind -= 1
        self.w("};")

    def s_ClassDef(self, s: ast.ClassDef):
        if len(s.bases) > 1:
            pass  # web: only the first base is used
        base = self.expr(s.bases[0]) if s.bases else None
        attrs: list[str] = []
        methods: list[ast.FunctionDef] = []
        for b in s.body:
            if isinstance(b, ast.FunctionDef):
                methods.append(b)
            elif isinstance(b, (ast.Assign, ast.AnnAssign)):
                tg = b.targets[0] if isinstance(b, ast.Assign) else b.target
                if isinstance(tg, ast.Name) and getattr(b, "value", None) is not None:
                    attrs.append(f"{json.dumps(tg.id)}: {self.expr(b.value)}")
            elif isinstance(b, ast.Expr) and isinstance(b.value, ast.Constant):
                continue
            elif isinstance(b, ast.Pass):
                continue
            else:
                self.fail(b, "class body statement")
        # defaults for all methods, evaluated at class definition time
        dcs = {}
        for m in methods:
            static = any(isinstance(d, ast.Name) and d.id == "staticmethod" for d in m.decorator_list)
            params, spec, dflt = self.arg_spec(m.args, not static)
            dcs[id(m)] = (self.defaults_const(dflt, m) if params else None, params, spec, static)
        ext = f" extends {base}" if base else ""
        self.w(f"{self.name(s.name)} = $.pyclass(class {ident(s.name)}{ext} {{", s)
        self.ind += 1
        saved_decos = getattr(self, "pending_decorators", [])
        self.pending_decorators = []
        for m in methods:
            self.method(m, dcs[id(m)], has_base=base is not None)
        self.ind -= 1
        self.w(f"}}, {{ {', '.join(attrs)} }});")
        # names in decorator expressions that refer to this class's methods mean Cls.prototype.name
        own = {m.name for m in methods}
        for mname, d in self.pending_decorators:
            d = ast.fix_missing_locations(_ProtoRewriter(own, s.name).visit(d))
            self.w(f"$.decorate_method({self.name(s.name)}, {json.dumps(mname)}, {self.expr(d)});", d)
        self.pending_decorators = saved_decos

    def method(self, m: ast.FunctionDef, info, has_base: bool):
        dc, params, spec, static = info
        kind = ""
        for d in m.decorator_list:
            if isinstance(d, ast.Name) and d.id == "property":
                kind = "get "
            elif isinstance(d, ast.Attribute) and d.attr == "setter":
                kind = "set "
            elif isinstance(d, ast.Name) and d.id in ("staticmethod", "classmethod"):
                kind = "static "
            else:
                self.pending_decorators.append((m.name, d))
        self_name = None
        all_args = m.args.posonlyargs + m.args.args
        if not static and all_args:
            self_name = all_args[0].arg
        js_params = [p for p, sp in zip(params, spec) if not sp.startswith(("*", "!"))]
        saved = self.ctx
        is_ctor = m.name == "__init__"
        self.ctx = Ctx("method", self_name, in_ctor=is_ctor)
        if is_ctor:
            self.w(f"constructor({', '.join(js_params)}) {{", m)
        else:
            name = {"__str__": "toString", "__repr__": "toString"}.get(m.name, m.name)
            self.w(f"{kind}{name}({', '.join(js_params)}) {{", m)
        self.ind += 1
        if is_ctor:
            self.constructor_body(m, params, spec, dc, has_base)
        else:
            pro = []
            if self_name:
                pro.append(f"const {ident(self_name)} = this;")
            self.function_body(m, params, spec, dc, pro)
        self.ind -= 1
        self.w("}")
        self.ctx = saved

    def _is_super_init(self, e) -> bool:
        return (
            isinstance(e, ast.Call) and isinstance(e.func, ast.Attribute) and e.func.attr == "__init__"
            and isinstance(e.func.value, ast.Call) and isinstance(e.func.value.func, ast.Name) and e.func.value.func.id == "super"
        ) or (
            isinstance(e, ast.Call) and isinstance(e.func, ast.Attribute) and e.func.attr == "__init__"
            and isinstance(e.func.value, ast.Name) and e.func.value.id not in ("self",)
            and e.args and isinstance(e.args[0], ast.Name) and e.args[0].id == self.ctx.self_name
        )

    def constructor_body(self, m, params, spec, dc, has_base):
        body = m.body
        idx = next((i for i, s in enumerate(body) if isinstance(s, ast.Expr) and self._is_super_init(s.value)), None)
        local, _ = assigned_names(body)
        local -= {x.lstrip("*!") for x in spec}
        local.discard("self")
        self._dc = dc
        self.declare_params(params, spec)
        if local:
            self.w("let " + ", ".join(sorted(ident(x) for x in local)) + ";")
        sn = ident(self.ctx.self_name or "self")
        if not has_base:
            self.w(f"const {sn} = this;")
            self.block(body)
            return
        if idx is None:
            self.w("super();")
            self.w(f"const {sn} = this;")
            self.block(body)
            return
        pre = body[:idx]
        uses_self = any(isinstance(n, ast.Name) and n.id == self.ctx.self_name for s in pre for n in ast.walk(s))
        if uses_self:
            self.w("const $pre = {};")
        self.ctx.pre_super = uses_self
        self.block(pre)
        self.ctx.pre_super = False
        self.super_init(body[idx].value, body[idx], uses_self)
        self.w(f"const {sn} = this;")
        self.block(body[idx + 1:])

    def super_init(self, call: ast.Call, node, pre=False):
        args = call.args
        if not (isinstance(call.func.value, ast.Call)):
            args = args[1:]  # Base.__init__(self, ...)
        if self.ctx.in_ctor:
            self.w(f"super({self.call_args(args, call.keywords, extra_kw='__pre__: $pre' if pre else None)});", node)
        else:
            self.w(f"/* super().__init__ outside constructor */", node)

    # ------------------------------------------------------------ expressions
    def name(self, n: str) -> str:
        if n == self.ctx.self_name and self.ctx.pre_super:
            return "$pre"
        if n == "__name__":
            return '"__main__"'
        return ident(n)

    def test(self, e: ast.expr) -> str:
        if isinstance(e, ast.Compare) and all(type(o) in (ast.Is, ast.IsNot, ast.In, ast.NotIn) for o in e.ops):
            return self.expr(e)
        if isinstance(e, ast.BoolOp):
            op = " && " if isinstance(e.op, ast.And) else " || "
            return "(" + op.join(self.test(v) for v in e.values) + ")"
        if isinstance(e, ast.UnaryOp) and isinstance(e.op, ast.Not):
            return f"!({self.test(e.operand)})"
        if isinstance(e, ast.Constant) and isinstance(e.value, bool):
            return "true" if e.value else "false"
        return f"$.truthy({self.expr(e)})"

    def expr(self, e: ast.expr | None, escapes=False) -> str:
        if e is None:
            return "null"
        if isinstance(e, ast.Attribute) and escapes:
            return self.attribute(e, bound=True)
        m = getattr(self, "e_" + type(e).__name__, None)
        if m is None:
            self.fail(e, f"expression {type(e).__name__}")
        return m(e)

    def e_Constant(self, e: ast.Constant) -> str:
        v = e.value
        if v is None or v is Ellipsis:
            return "null"
        if v is True:
            return "true"
        if v is False:
            return "false"
        if isinstance(v, complex):
            return f"$.complex({v.real!r}, {v.imag!r})"
        if isinstance(v, (int, float)):
            r = repr(v)
            if r in ("inf", "-inf"):
                return "Infinity" if v > 0 else "-Infinity"
            return r
        if isinstance(v, str):
            return json.dumps(v)
        self.fail(e, f"constant {type(v).__name__}")

    def e_Name(self, e: ast.Name) -> str:
        return self.name(e.id)

    def attribute(self, e: ast.Attribute, bound=False) -> str:
        if isinstance(e.value, ast.Call) and isinstance(e.value.func, ast.Name) and e.value.func.id == "super":
            return f"super.{e.attr}"
        obj = self.expr(e.value)
        if e.attr in TRANSLATED_ATTRS:
            return f"$.getattr({obj}, {json.dumps(e.attr)})"
        if bound:
            return f"$.bound({obj}, {json.dumps(e.attr)})"
        return f"{obj}.{e.attr}"

    def e_Attribute(self, e: ast.Attribute) -> str:
        return self.attribute(e)

    def index(self, s: ast.expr) -> str:
        if isinstance(s, ast.Slice):
            return f"$.slice({self.expr(s.lower)}, {self.expr(s.upper)}, {self.expr(s.step)})"
        if isinstance(s, ast.Tuple):
            return "$.T(" + ", ".join(self.index(x) for x in s.elts) + ")"
        return self.expr(s)

    def e_Subscript(self, e: ast.Subscript) -> str:
        return f"$.getitem({self.expr(e.value)}, {self.index(e.slice)})"

    def e_Slice(self, e: ast.Slice) -> str:
        return self.index(e)

    def _is_num(self, e) -> bool:
        return (isinstance(e, ast.Constant) and isinstance(e.value, (int, float)) and not isinstance(e.value, bool)) or (
            isinstance(e, ast.UnaryOp) and isinstance(e.op, ast.USub) and self._is_num(e.operand)
        )

    def e_BinOp(self, e: ast.BinOp) -> str:
        l, r = self.expr(e.left), self.expr(e.right)
        if self._is_num(e.left) and self._is_num(e.right) and type(e.op) in JS_NUM_OPS:
            return f"({l} {JS_NUM_OPS[type(e.op)]} {r})"
        return f"$.{BINOPS[type(e.op)]}({l}, {r})"

    def e_UnaryOp(self, e: ast.UnaryOp) -> str:
        if isinstance(e.op, ast.Not):
            return f"!{self.test(e.operand)}" if not isinstance(e.operand, ast.BoolOp) else f"!({self.test(e.operand)})"
        if isinstance(e.op, ast.USub):
            if self._is_num(e.operand):
                return f"(-{self.expr(e.operand)})"
            return f"$.neg({self.expr(e.operand)})"
        if isinstance(e.op, ast.UAdd):
            return self.expr(e.operand)
        return f"$.invert({self.expr(e.operand)})"

    def e_BoolOp(self, e: ast.BoolOp) -> str:
        fn = "and" if isinstance(e.op, ast.And) else "or"
        out = self.expr(e.values[-1])
        for v in reversed(e.values[:-1]):
            out = f"$.{fn}({self.expr(v)}, () => {out})"
        return out

    def e_Compare(self, e: ast.Compare) -> str:
        parts = []
        left = self.expr(e.left)
        for op, comp in zip(e.ops, e.comparators):
            right = self.expr(comp)
            if isinstance(op, ast.Is):
                parts.append(f"({left} == null)" if right == "null" else f"({left} === {right})")
            elif isinstance(op, ast.IsNot):
                parts.append(f"({left} != null)" if right == "null" else f"({left} !== {right})")
            elif isinstance(op, ast.In):
                parts.append(f"$.contains({right}, {left})")
            elif isinstance(op, ast.NotIn):
                parts.append(f"!$.contains({right}, {left})")
            else:
                parts.append(f"$.{CMPOPS[type(op)]}({left}, {right})")
            left = right
        return parts[0] if len(parts) == 1 else "(" + " && ".join(parts) + ")"

    def e_IfExp(self, e: ast.IfExp) -> str:
        return f"({self.test(e.test)} ? {self.expr(e.body)} : {self.expr(e.orelse)})"

    def call_args(self, args, keywords, extra_kw: str | None = None) -> str:
        out = []
        for a in args:
            if isinstance(a, ast.Starred):
                out.append(f"...$.iter({self.expr(a.value)})")
            else:
                out.append(self.expr(a, escapes=True))
        kws = []
        for k in keywords:
            if k.arg is None:
                kws.append(f"...{self.expr(k.value)}")
            else:
                kws.append(f"{json.dumps(k.arg)}: {self.expr(k.value, escapes=True)}")
        if extra_kw:
            kws.append(extra_kw)
        if kws:
            out.append("$.kw({" + ", ".join(kws) + "})")
        return ", ".join(out)

    def e_Call(self, e: ast.Call) -> str:
        f = e.func
        if isinstance(f, ast.Name) and f.id == "super" and not e.args:
            self.fail(e, "bare super()")
        if isinstance(f, ast.Attribute) and f.attr in PY_METHODS and not (
            isinstance(f.value, ast.Call) and isinstance(f.value.func, ast.Name) and f.value.func.id == "super"
        ):
            obj = self.expr(f.value)
            args = self.call_args(e.args, e.keywords)
            return f"$.call({obj}, {json.dumps(f.attr)}{', ' + args if args else ''})"
        if isinstance(f, ast.Attribute):
            fn = self.attribute(f)
            if fn.startswith("$.getattr("):
                fn = f"({fn})"
        else:
            fn = self.expr(f)
        return f"{fn}({self.call_args(e.args, e.keywords)})"

    def e_Lambda(self, e: ast.Lambda) -> str:
        a = e.args
        params, spec, dflt = self.arg_spec(a, False)
        saved = self.ctx
        self.ctx = Ctx("lambda", saved.self_name)
        self.ctx.pre_super = saved.pre_super
        body = self.expr(e.body)
        self.ctx = saved
        plain = []
        outer_names, outer_vals = [], []
        for p, sp, d in zip(params, spec, dflt):
            if sp.startswith("**"):
                plain.append(f"{p} = {{}}")
            elif sp.startswith("*"):
                plain.append(f"...{p}")
            elif d == "$.REQ":
                plain.append(p)
            else:
                dn = f"$d_{p}"
                outer_names.append(dn)
                outer_vals.append(d)
                plain.append(f"{p} = {dn}")
        fn = f"(({', '.join(plain)}) => {body})"
        if outer_names:
            return f"(({', '.join(outer_names)}) => {fn})({', '.join(outer_vals)})"
        return fn

    def seq(self, elts) -> str:
        if any(isinstance(x, ast.Starred) for x in elts):
            parts = [f"...$.iter({self.expr(x.value)})" if isinstance(x, ast.Starred) else self.expr(x, escapes=True) for x in elts]
            return f"$.toPyList([{', '.join(parts)}])"
        return f"$.L({', '.join(self.expr(x, escapes=True) for x in elts)})"

    def e_List(self, e: ast.List) -> str:
        return self.seq(e.elts)

    def e_Tuple(self, e: ast.Tuple) -> str:
        return self.seq(e.elts)

    def e_Set(self, e: ast.Set) -> str:
        return f"new Set([{', '.join(self.expr(x) for x in e.elts)}])"

    def e_Dict(self, e: ast.Dict) -> str:
        items = []
        for k, v in zip(e.keys, e.values):
            if k is None:
                items.append(f"...{self.expr(v)}")
            elif isinstance(k, ast.Constant) and isinstance(k.value, str):
                items.append(f"{json.dumps(k.value)}: {self.expr(v, escapes=True)}")
            else:
                items.append(f"[{self.expr(k)}]: {self.expr(v, escapes=True)}")
        return "{" + ", ".join(items) + "}"

    def comprehension(self, generators, emit: str, init: str, ret: str) -> str:
        saved = self.ctx
        self.ctx = Ctx("comp", saved.self_name)
        self.ctx.pre_super = saved.pre_super
        names: set[str] = set()
        for g in generators:
            for t in ast.walk(g.target):
                if isinstance(t, ast.Name):
                    names.add(t.id)
        head = []
        for g in generators:
            head.append(f"for (const {self.pattern(g.target)} of $.iter({self.expr(g.iter)})) {{")
            for c in g.ifs:
                head.append(f"if (!({self.test(c)})) continue;")
        body = emit()
        self.ctx = saved
        return f"(() => {{ const $r = {init}; {' '.join(head)} {body} {'}' * len(generators)} return {ret}; }})()"

    def e_ListComp(self, e: ast.ListComp) -> str:
        return self.comprehension(e.generators, lambda: f"$r.push({self.expr(e.elt, escapes=True)});", "$.L()", "$r")

    e_GeneratorExp = e_ListComp

    def e_SetComp(self, e: ast.SetComp) -> str:
        return self.comprehension(e.generators, lambda: f"$r.add({self.expr(e.elt)});", "new Set()", "$r")

    def e_DictComp(self, e: ast.DictComp) -> str:
        return self.comprehension(e.generators, lambda: f"$r[{self.expr(e.key)}] = {self.expr(e.value, escapes=True)};", "{}", "$r")

    def e_JoinedStr(self, e: ast.JoinedStr) -> str:
        parts = []
        for v in e.values:
            if isinstance(v, ast.Constant):
                parts.append(v.value.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${"))
            else:
                spec = ""
                if v.format_spec is not None:
                    spec_parts = []
                    for sp in v.format_spec.values:
                        if isinstance(sp, ast.Constant):
                            spec_parts.append(json.dumps(sp.value))
                        else:
                            spec_parts.append(f"$.format({self.expr(sp.value)})")
                    spec = " + ".join(spec_parts) if spec_parts else '""'
                val = self.expr(v.value)
                if v.conversion == ord("r"):
                    val = f"$.repr({val})"
                parts.append("${" + (f"$.format({val}, {spec})" if spec else f"$.str({val})") + "}")
        return "`" + "".join(parts) + "`"

    def e_Starred(self, e: ast.Starred) -> str:
        return f"...$.iter({self.expr(e.value)})"

    def e_NamedExpr(self, e: ast.NamedExpr) -> str:
        return f"({self.name(e.target.id)} = {self.expr(e.value)})"


def transpile(src: str) -> str:
    return Transpiler().module(ast.parse(src))


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--json":
        items = json.load(open(sys.argv[2]))
        ok = 0
        for it in items:
            try:
                it["js"] = transpile(it["code"])
                it.pop("js_error", None)
                ok += 1
            except (Unsupported, SyntaxError) as ex:
                it["js"] = None
                it["js_error"] = str(ex)
        json.dump(items, open(sys.argv[3], "w"), indent=1)
        print(f"transpiled {ok}/{len(items)}", file=sys.stderr)
    else:
        src = open(sys.argv[1]).read() if len(sys.argv) > 1 else sys.stdin.read()
        sys.stdout.write(transpile(src))
