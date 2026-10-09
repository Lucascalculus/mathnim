// manim/animation/transform_matching_parts.py
//
// web: manim iterates Python sets of keys (hash order, random between runs);
// here keys keep the source's insertion order, which only affects z-order.
import { Group, Mobject } from '../mobject/mobject';
import { MathTexPart } from '../mobject/text/tex_mobject';
import { VGroup, VMobject } from '../mobject/types/vectorized_mobject';
import { pyargs, type Kwargs } from '../utils/pyargs';
import type { SceneLike } from './animation';
import { AnimationGroup } from './composition';
import { FadeIn, FadeOut } from './fading';
import { FadeTransformPieces, Transform } from './transform';

type ShapeMap = Map<string | number, VGroup>;

function shape_map_of(cls: any, mobject: Mobject): ShapeMap {
  const shape_map: ShapeMap = new Map();
  for (const sm of cls.get_mobject_parts(mobject)) {
    const key = cls.get_mobject_key(sm);
    if (!shape_map.has(key)) shape_map.set(key, new VGroup());
    shape_map.get(key)!.add(sm);
  }
  return shape_map;
}

/** Base for animations that transform matching parts of two mobjects and fade the rest. */
export class TransformMatchingAbstractBase extends AnimationGroup {
  declare to_remove: Mobject[];
  declare to_add: Mobject;

  constructor(mobject: Mobject, target_mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['transform_mismatches', 'fade_transform_mismatches', 'key_map'], { transform_mismatches: false, fade_transform_mismatches: false, key_map: null });
    const { transform_mismatches, fade_transform_mismatches, key_map, ...kwargs } = o as Kwargs;
    const group_type: any = mobject instanceof VMobject ? VGroup : Group;
    const source_map = shape_map_of(new.target, mobject);
    const target_map = shape_map_of(new.target, target_mobject);
    const km: [string | number, string | number][] = key_map === null ? [] : key_map instanceof Map ? [...key_map] : Object.entries(key_map);
    const transform_source = new group_type(), transform_target = new group_type();
    for (const key of source_map.keys()) {
      if (!target_map.has(key)) continue;
      transform_source.add(source_map.get(key)!);
      transform_target.add(target_map.get(key)!);
    }
    const anims: any[] = [new Transform(transform_source, transform_target, kwargs)];
    const key_mapped_source = new group_type(), key_mapped_target = new group_type();
    for (const [key1, key2] of km) {
      if (source_map.has(key1) && target_map.has(key2)) {
        key_mapped_source.add(source_map.get(key1)!);
        key_mapped_target.add(target_map.get(key2)!);
        source_map.delete(key1);
        target_map.delete(key2);
      }
    }
    if (key_mapped_source.submobjects.length > 0) anims.push(new FadeTransformPieces(key_mapped_source, key_mapped_target, kwargs));
    const fade_source = new group_type(), fade_target = new group_type();
    for (const [key, v] of source_map) if (!target_map.has(key)) fade_source.add(v);
    for (const [key, v] of target_map) if (!source_map.has(key)) fade_target.add(v);
    const fade_target_copy = fade_target.copy();
    if (transform_mismatches) {
      const kw = 'replace_mobject_with_target_in_scene' in kwargs ? kwargs : { ...kwargs, replace_mobject_with_target_in_scene: true };
      anims.push(new Transform(fade_source, fade_target, kw));
    } else if (fade_transform_mismatches) anims.push(new FadeTransformPieces(fade_source, fade_target, kwargs));
    else {
      anims.push(new FadeOut(fade_source, { target_position: fade_target, ...kwargs }));
      anims.push(new FadeIn(fade_target_copy, { target_position: fade_target, ...kwargs }));
    }
    super(...anims);
    this.to_remove = [mobject, fade_target_copy];
    this.to_add = target_mobject;
  }
  get_shape_map(mobject: Mobject): ShapeMap {
    return shape_map_of(this.constructor, mobject);
  }
  override clean_up_from_scene(scene: SceneLike): void {
    for (const anim of this.animations) anim.interpolate(0);
    scene.remove(this.mobject);
    scene.remove(...this.to_remove);
    scene.add(this.to_add);
  }
  static get_mobject_parts(_mobject: Mobject): Mobject[] {
    throw new Error('To be implemented in subclass.');
  }
  static get_mobject_key(_mobject: Mobject): string | number {
    throw new Error('To be implemented in subclass.');
  }
}

/** Transforms pieces of equal shape into each other and fades the rest. */
export class TransformMatchingShapes extends TransformMatchingAbstractBase {
  constructor(mobject: Mobject, target_mobject: Mobject, ...rest: unknown[]) {
    super(mobject, target_mobject, ...rest);
  }
  static override get_mobject_parts(mobject: Mobject): Mobject[] {
    return mobject.family_members_with_points();
  }
  /** web: a string of the normalised points rounded to 3 decimals (manim hashes their bytes). */
  static override get_mobject_key(mobject: Mobject): string {
    mobject.save_state();
    mobject.center();
    mobject.height = 1;
    const p = mobject.points;
    let key = '';
    for (let i = 0; i < p.length; i++) {
      const r = Math.round(p[i] * 1000) / 1000 + 0.0;
      key += (Object.is(r, -0) ? 0 : r) + ',';
    }
    mobject.restore();
    return key;
  }
}

/** Transforms parts of MathTex/Tex with equal TeX strings into each other and fades the rest. */
export class TransformMatchingTex extends TransformMatchingAbstractBase {
  constructor(mobject: Mobject, target_mobject: Mobject, ...rest: unknown[]) {
    super(mobject, target_mobject, ...rest);
  }
  static override get_mobject_parts(mobject: Mobject): Mobject[] {
    if (mobject instanceof Group || mobject instanceof VGroup) return mobject.submobjects.flatMap((s) => TransformMatchingTex.get_mobject_parts(s));
    if (!('tex_string' in mobject)) throw new Error('AssertionError: TransformMatchingTex needs mobjects with a tex_string');
    return mobject.submobjects;
  }
  static override get_mobject_key(mobject: Mobject): string {
    if (!(mobject instanceof MathTexPart)) throw new Error('AssertionError: TransformMatchingTex parts must be MathTexPart');
    return mobject.tex_string;
  }
}
