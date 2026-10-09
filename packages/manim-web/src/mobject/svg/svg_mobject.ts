// manim/mobject/svg/svg_mobject.py
//
// web: svgelements is replaced by the pure-TS parser in utils/svgelements.ts
// (no DOM). Besides `file_name`, an SVGMobject can be built from SVG text
// with the `svg_string` keyword; files are read from `SVGMobject.files`
// (register_svg_file) or, in node, from disk.
import { config } from '../../_config';
import { RIGHT } from '../../constants';
import { ManimColor, type ParsableManimColor } from '../../utils/color/core';
import { pyargs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import {
  approximate_arcs_with_quads, IDENTITY_MATRIX, parse_path, parse_svg, parse_xml,
  type SVGGroupNode, type SVGNode, type SVGSegment, type SVGShapeNode, type XMLElement,
} from '../../utils/svgelements';
import type { Point3D } from '../../utils/vector';
import { VGroup, VMobject } from '../types/vectorized_mobject';

const SVG_HASH_TO_MOB_MAP = new Map<string, SVGMobject>();
const SVG_FILES = new Map<string, string>();

/** web: make an SVG file available to SVGMobject(file_name) without a file system. */
export function register_svg_file(file_name: string, svg_text: string): void {
  SVG_FILES.set(file_name, svg_text);
}

type PolyNode = Extract<SVGShapeNode, { kind: 'polygon' | 'polyline' }>;
const _convert_point_to_3d = (x: number, y: number): Point3D => [x, y, 0.0];

function read_file(name: string): string | null {
  for (const n of [name, name + '.svg']) if (SVG_FILES.has(n)) return SVG_FILES.get(n)!;
  const p: any = (globalThis as any).process ?? null;
  const fs = p?.getBuiltinModule?.('fs');
  if (!fs) return null;
  for (const n of [name, name + '.svg', name + '.xdv']) if (fs.existsSync(n)) return fs.readFileSync(n, 'utf8');
  return null;
}

/** A vectorized mobject created from an SVG file (or, web, SVG text). */
export class SVGMobject extends VMobject {
  declare file_name: string | null;
  declare svg_string: string | null;
  declare should_center: boolean;
  declare svg_height: number | null;
  declare svg_width: number | null;
  declare opacity: number | null;
  declare id_to_vgroup_dict: Record<string, VGroup>;
  declare svg_default: Kwargs;
  declare path_string_config: Kwargs;

  constructor(...args: unknown[]) {
    const o = pyargs(args, [
      'file_name', 'should_center', 'height', 'width', 'color', 'opacity', 'fill_color', 'fill_opacity', 'stroke_color',
      'stroke_opacity', 'stroke_width', 'svg_default', 'path_string_config', 'use_svg_cache',
    ], {
      file_name: null, should_center: true, height: 2, width: null, color: null, opacity: null, fill_color: null, fill_opacity: null,
      stroke_color: null, stroke_opacity: null, stroke_width: null, svg_default: null, path_string_config: null, use_svg_cache: true,
    });
    const {
      file_name, should_center, height, width, color, opacity, fill_color, fill_opacity, stroke_color, stroke_opacity, stroke_width,
      svg_default, path_string_config, use_svg_cache, svg_string = null, ...kwargs
    } = o;
    super({ ...kwargs, color: null, stroke_color: null, fill_color: null });
    this.file_name = file_name;
    this.svg_string = svg_string;
    this.should_center = should_center;
    this.svg_height = height;
    this.svg_width = width;
    this.color = new ManimColor(color);
    this.opacity = opacity;
    this.fill_color = fill_color;
    // Python keeps None here (then init_colors leaves opacities alone)
    (this as any).fill_opacity = fill_opacity;
    this.stroke_color = stroke_color;
    (this as any).stroke_opacity = stroke_opacity;
    this.stroke_width = stroke_width ?? 0;
    this.id_to_vgroup_dict = {};
    this.svg_default = svg_default ?? { color: null, opacity: null, fill_color: null, fill_opacity: null, stroke_width: 0, stroke_color: null, stroke_opacity: null };
    this.path_string_config = path_string_config ?? {};
    this.init_svg_mobject(use_svg_cache);
    this.set_style({ fill_color, fill_opacity, stroke_color, stroke_opacity, stroke_width });
    this.move_into_position();
  }

  init_svg_mobject(use_svg_cache: boolean): this {
    const hash_val = use_svg_cache ? this.hash_seed : '';
    if (use_svg_cache) {
      const cached = SVG_HASH_TO_MOB_MAP.get(hash_val);
      if (cached) {
        const mob = cached.copy();
        this.add(...mob.submobjects);
        this.id_to_vgroup_dict = mob.id_to_vgroup_dict;
        return this;
      }
    }
    this.generate_mobject();
    if (use_svg_cache) SVG_HASH_TO_MOB_MAP.set(hash_val, this.copy());
    return this;
  }
  /** Cache key (manim hashes class name, svg_default, path_string_config, file name, renderer). */
  get hash_seed(): string {
    return JSON.stringify([this.constructor.name, this.svg_default, this.path_string_config, this.file_name, this.svg_string, config.renderer]);
  }
  generate_mobject(): this {
    const text = this.get_svg_text();
    const doc = parse_xml(text);
    const root = doc.children.find((c) => c.tag === 'svg' || c.tag.endsWith(':svg')) ?? doc;
    const new_tree = this.modify_xml_tree(root);
    const svg = parse_svg(new_tree, { viewport: false });
    const [mobjects, mobject_dict] = this.get_mobjects_from(svg);
    this.add(...mobjects);
    this.id_to_vgroup_dict = mobject_dict;
    this.flip(RIGHT);
    return this;
  }
  /** web: the SVG source text (`svg_string`, a registered file, or a file read in node). */
  get_svg_text(): string {
    if (this.svg_string !== null && this.svg_string !== undefined) return this.svg_string;
    if (this.file_name === null || this.file_name === undefined) throw new Error('Must specify file for SVGMobject');
    const text = read_file(String(this.file_name));
    if (text === null) throw new Error(`could not find ${this.file_name}. (web: register it with register_svg_file(name, text) or pass svg_string)`);
    return text;
  }
  get_file_path(): string {
    if (this.file_name === null || this.file_name === undefined) throw new Error('Must specify file for SVGMobject');
    return String(this.file_name);
  }
  /** Wrap the root's children in <g config style><g root style>, dropping the root's size and viewBox. */
  modify_xml_tree(root: XMLElement): XMLElement {
    const config_style_dict = this.generate_config_style_dict();
    const style_keys = ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'style'];
    const root_style_dict: Record<string, string> = {};
    for (const [k, v] of Object.entries(root.attrs)) if (style_keys.includes(k)) root_style_dict[k] = v;
    const root_style_node: XMLElement = { tag: 'g', attrs: root_style_dict, children: root.children, text: '' };
    const config_style_node: XMLElement = { tag: 'g', attrs: config_style_dict, children: [root_style_node], text: '' };
    return { tag: 'svg', attrs: {}, children: [config_style_node], text: '' };
  }
  generate_config_style_dict(): Record<string, string> {
    const keys_converting_dict: Record<string, string[]> = {
      fill: ['color', 'fill_color'], 'fill-opacity': ['opacity', 'fill_opacity'], stroke: ['color', 'stroke_color'],
      'stroke-opacity': ['opacity', 'stroke_opacity'], 'stroke-width': ['stroke_width'],
    };
    const result: Record<string, string> = {};
    for (const [svg_key, style_keys] of Object.entries(keys_converting_dict)) {
      for (const style_key of style_keys) {
        const v = this.svg_default[style_key];
        if (v === null || v === undefined) continue;
        result[svg_key] = v instanceof ManimColor ? v.to_hex() : String(v);
      }
    }
    return result;
  }
  get_mobjects_from(svg: SVGGroupNode): [VMobject[], Record<string, VGroup>] {
    const result: VMobject[] = [];
    const stack: [SVGNode, number][] = [[svg, 1]];
    let group_id_number = 0;
    let vgroup_stack: string[] = ['root'];
    const vgroups: Record<string, VGroup> = { root: new VGroup() };
    while (stack.length > 0) {
      const [element, depth] = stack.pop()!;
      vgroup_stack = vgroup_stack.slice(0, depth);
      let group_name: string;
      if (element.id !== null && element.id !== undefined) group_name = element.id;
      else group_name = `numbered_group_${group_id_number++}`;
      vgroup_stack.push(group_name);
      vgroups[group_name] = new VGroup();
      if (element.kind === 'group' || element.kind === 'use') {
        for (let i = element.children.length - 1; i >= 0; i--) stack.push([element.children[i], depth + 1]);
        continue;
      }
      try {
        const mob = this.get_mob_from_shape_element(element as SVGShapeNode);
        if (mob !== null) {
          result.push(mob);
          for (const parent_name of vgroup_stack.slice(0, -1)) vgroups[parent_name].add(mob);
        }
      } catch (e: any) {
        console.error(`Exception occurred in 'get_mobjects_from'. Details: ${e?.message ?? e}`);
      }
    }
    return [result, vgroups];
  }
  get_mob_from_shape_element(shape: SVGShapeNode): VMobject | null {
    let mob: VMobject | null;
    switch (shape.kind) {
      case 'path':
        mob = this.path_to_mobject(shape.segments);
        break;
      case 'line':
        mob = SVGMobject.line_to_mobject(shape);
        break;
      case 'rect':
        mob = SVGMobject.rect_to_mobject(shape);
        break;
      case 'ellipse':
        mob = SVGMobject.ellipse_to_mobject(shape);
        break;
      case 'polygon':
        mob = SVGMobject.polygon_to_mobject(shape);
        break;
      case 'polyline':
        mob = this.polyline_to_mobject(shape);
        break;
      case 'text':
        mob = SVGMobject.text_to_mobject(shape);
        break;
      default:
        mob = null;
    }
    if (mob === null || !mob.has_points()) return null;
    SVGMobject.apply_style_to_mobject(mob, shape);
    if (shape.transform !== IDENTITY_MATRIX) SVGMobject.handle_transform(mob, shape.transform);
    return mob;
  }
  static handle_transform(mob: VMobject, matrix: readonly number[]): VMobject {
    mob.apply_matrix([[matrix[0], matrix[2]], [matrix[1], matrix[3]]]);
    mob.shift([matrix[4], matrix[5], 0.0]);
    return mob;
  }
  static apply_style_to_mobject(mob: VMobject, shape: SVGShapeNode): VMobject {
    const st = shape.style;
    mob.set_style({
      stroke_width: st.stroke_width, stroke_color: st.stroke.hex, stroke_opacity: st.stroke.opacity,
      fill_color: st.fill.hex, fill_opacity: st.fill.opacity,
    });
    return mob;
  }
  path_to_mobject(path: SVGSegment[]): VMobjectFromSVGPath {
    return new VMobjectFromSVGPath(path, this.path_string_config);
  }
  static line_to_mobject(line: Extract<SVGShapeNode, { kind: 'line' }>): VMobject {
    return new registry.Line({ start: _convert_point_to_3d(line.x1, line.y1), end: _convert_point_to_3d(line.x2, line.y2) });
  }
  static rect_to_mobject(rect: Extract<SVGShapeNode, { kind: 'rect' }>): VMobject {
    let mob: VMobject;
    if (rect.rx === 0 || rect.ry === 0) mob = new registry.Rectangle({ width: rect.width, height: rect.height });
    else {
      mob = new registry.RoundedRectangle({ width: rect.width, height: (rect.height * rect.rx) / rect.ry, corner_radius: rect.rx });
      mob.stretch_to_fit_height(rect.height);
    }
    mob.shift(_convert_point_to_3d(rect.x + rect.width / 2, rect.y + rect.height / 2));
    return mob;
  }
  static ellipse_to_mobject(ellipse: Extract<SVGShapeNode, { kind: 'ellipse' }>): VMobject {
    const mob = new registry.Circle({ radius: ellipse.rx });
    if (ellipse.rx !== ellipse.ry) mob.stretch_to_fit_height(2 * ellipse.ry);
    mob.shift(_convert_point_to_3d(ellipse.cx, ellipse.cy));
    return mob;
  }
  static polygon_to_mobject(polygon: PolyNode): VMobject {
    return new registry.Polygon(...polygon.points.map(([x, y]) => _convert_point_to_3d(x, y)));
  }
  polyline_to_mobject(polyline: PolyNode): VMobject {
    const vmobject_class = (this.constructor as any).get_mobject_type_class();
    return new vmobject_class().set_points_as_corners(polyline.points.map(([x, y]) => _convert_point_to_3d(x, y)));
  }
  static text_to_mobject(_text: SVGShapeNode): VMobject | null {
    console.warn('Unsupported element type: Text');
    return null;
  }
  move_into_position(): this {
    if (this.should_center) this.center();
    if (this.svg_height !== null && this.svg_height !== undefined) this.height = this.svg_height;
    if (this.svg_width !== null && this.svg_width !== undefined) this.width = this.svg_width;
    return this;
  }
}

/** A VMobject from an SVG path (a parsed segment list, or web: path data text). */
export class VMobjectFromSVGPath extends VMobject {
  declare path_obj: SVGSegment[];
  declare long_lines: boolean;
  declare should_subdivide_sharp_curves: boolean;
  declare should_remove_null_curves: boolean;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['path_obj', 'long_lines', 'should_subdivide_sharp_curves', 'should_remove_null_curves'], {
      long_lines: false, should_subdivide_sharp_curves: false, should_remove_null_curves: false,
    });
    super(o);
  }
  protected override _init_attrs(kw: Kwargs): void {
    const p = typeof kw.path_obj === 'string' ? parse_path(kw.path_obj) : (kw.path_obj as SVGSegment[]);
    this.path_obj = approximate_arcs_with_quads(p ?? []);
    this.long_lines = kw.long_lines ?? false;
    this.should_subdivide_sharp_curves = kw.should_subdivide_sharp_curves ?? false;
    this.should_remove_null_curves = kw.should_remove_null_curves ?? false;
    super._init_attrs(kw);
  }
  override generate_points(): this {
    this.handle_commands();
    return this;
  }
  init_points(): this {
    this.generate_points();
    return this;
  }
  handle_commands(): this {
    // cubic mode (n_points_per_curve == 4), exactly like manim's Cairo branch
    const all: number[] = [];
    let last_move: number[] | null = null;
    let last_true_move: number[] | null = null;
    const move_pen = (x: number, y: number, true_move = false) => {
      last_move = [x, y];
      if (true_move) last_true_move = last_move;
    };
    const add_cubic = (s: number[], c1: number[], c2: number[], e: number[]) => {
      all.push(s[0], s[1], 0, c1[0], c1[1], 0, c2[0], c2[1], 0, e[0], e[1], 0);
      move_pen(e[0], e[1]);
    };
    const add_quad = (s: number[], c: number[], e: number[]) => {
      add_cubic(s, [(s[0] + c[0] + c[0]) / 3, (s[1] + c[1] + c[1]) / 3], [(c[0] + c[0] + e[0]) / 3, (c[1] + c[1] + e[1]) / 3], e);
    };
    const add_line = (s: number[], e: number[]) => {
      add_cubic(s, [(s[0] + s[0] + e[0]) / 3, (s[1] + s[1] + e[1]) / 3], [(s[0] + e[0] + e[0]) / 3, (s[1] + e[1] + e[1]) / 3], e);
    };
    for (const seg of this.path_obj) {
      switch (seg.type) {
        case 'M':
          move_pen(seg.end[0], seg.end[1], true);
          break;
        case 'L':
          add_line(last_move!, seg.end);
          break;
        case 'Q':
          add_quad(last_move!, seg.control, seg.end);
          break;
        case 'C':
          add_cubic(last_move!, seg.control1, seg.control2, seg.end);
          break;
        case 'Z': {
          const a = last_move!, b = last_true_move!;
          if (a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.0001) add_line(a, b);
          break;
        }
        default:
          throw new Error(`Not implemented: ${seg.type}`);
      }
    }
    this.points = new Float64Array(all);
    return this;
  }
}

register({ SVGMobject, VMobjectFromSVGPath });
