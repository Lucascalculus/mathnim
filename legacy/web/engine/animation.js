// Animations, ported from manim CE (animation/*.py) including lag_ratio
// sub-alphas, Transform point alignment and the fade/indicate targets.
import { VMobject, VGroup, vmul } from './core.js';

// ------------------------------------------------------------------ rate functions
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export const linear = (t) => t;
export function smooth(t, inflection = 10) {
  const err = sigmoid(-inflection / 2);
  return Math.min(Math.max((sigmoid(inflection * (t - 0.5)) - err) / (1 - 2 * err), 0), 1);
}
export const rushInto = (t) => 2 * smooth(t / 2);
export const rushFrom = (t) => 2 * smooth(t / 2 + 0.5) - 1;
export const doubleSmooth = (t) => (t < 0.5 ? 0.5 * smooth(2 * t) : 0.5 * (1 + smooth(2 * t - 1)));
export const thereAndBack = (t) => smooth(t < 0.5 ? 2 * t : 2 * (1 - t));
export const wiggle = (t, w = 2) => thereAndBack(t) * Math.sin(w * Math.PI * t);

function zip(lists, strict = false) {
  const n = Math.min(...lists.map((l) => l.length));
  if (strict && lists.some((l) => l.length !== n)) throw new Error('zip length mismatch');
  return Array.from({ length: n }, (_, i) => lists.map((l) => l[i]));
}

// ------------------------------------------------------------------ base
export class Animation {
  constructor(mobject, o = {}) {
    this.mobject = mobject;
    this.runTime = o.runTime ?? 1;
    this.rateFunc = o.rateFunc ?? smooth;
    this.lagRatio = o.lagRatio ?? 0;
    this.introducer = o.introducer ?? false;
    this.remover = o.remover ?? false;
  }
  begin() {
    this.startingMobject = this.createStartingMobject();
    this.interpolate(0);
  }
  finish() {
    this.interpolate(1);
  }
  createStartingMobject() {
    return this.mobject.copy();
  }
  familiesZipped() {
    return zip([this.mobject, this.startingMobject].map((m) => m.familyWithPoints()));
  }
  interpolate(alpha) {
    this.interpolateMobject(alpha);
  }
  interpolateMobject(alpha) {
    const fams = this.familiesZipped();
    fams.forEach((mobs, i) => this.interpolateSubmobject(...mobs, this.subAlpha(alpha, i, fams.length)));
  }
  interpolateSubmobject() {}
  subAlpha(alpha, index, n) {
    const full = (n - 1) * this.lagRatio + 1;
    return this.rateFunc(alpha * full - index * this.lagRatio);
  }
  setupScene(scene) {
    if (this.introducer && !scene.familyMembers().includes(this.mobject)) scene.add(this.mobject);
  }
  cleanUpFromScene(scene) {
    if (this.remover) scene.remove(this.mobject);
  }
}

export class Wait extends Animation {
  constructor(runTime = 1) {
    super(null, { runTime });
    this.isWait = true;
  }
  begin() {}
  finish() {}
  interpolate() {}
  setupScene() {}
  cleanUpFromScene() {}
}

// ------------------------------------------------------------------ transforms
export class Transform extends Animation {
  constructor(mobject, target = null, o = {}) {
    super(mobject, o);
    this.targetMobject = target;
  }
  begin() {
    this.targetMobject = this.createTarget();
    this.targetCopy = this.targetMobject.copy();
    this.mobject.alignData(this.targetCopy);
    super.begin();
  }
  createTarget() {
    return this.targetMobject;
  }
  familiesZipped() {
    return zip([this.mobject, this.startingMobject, this.targetCopy].map((m) => m.familyWithPoints()), true);
  }
  interpolateSubmobject(sub, start, target, alpha) {
    sub.interpolate(start, target, alpha);
  }
}

export class TransformFromCopy extends Transform {
  constructor(mobject, target, o = {}) {
    super(target, mobject, o);
  }
  interpolate(alpha) {
    super.interpolate(1 - alpha);
  }
}

export class MoveToTarget extends Transform {
  constructor(mobject, o = {}) {
    super(mobject, mobject.target, o);
  }
}

class MethodAnimation extends MoveToTarget {
  constructor(mobject, methods, o) {
    super(mobject, o);
    this.methods = methods;
  }
  finish() {
    for (const [name, args] of this.methods) this.mobject[name](...args);
    super.finish();
  }
}

// `animate(mob).setOpacity(0.2).shift(UP)` -> an animation builder (manim's .animate)
export function animate(mob) {
  mob.target = mob.copy();
  const methods = [];
  const builder = {
    __builder: true,
    build(o = {}) {
      return new MethodAnimation(mob, methods, o);
    },
  };
  const proxy = new Proxy(builder, {
    get(t, k) {
      if (k in t) return t[k];
      return (...args) => {
        mob.target[k](...args);
        methods.push([k, args]);
        return proxy;
      };
    },
  });
  return proxy;
}

class Fade extends Transform {
  constructor(mobjects, o = {}) {
    const list = Array.isArray(mobjects) ? mobjects : [mobjects];
    const mob = list.length === 1 ? list[0] : new VGroup(...list);
    super(mob, null, o);
    this.shiftVector = o.shift ?? [0, 0];
    this.scaleFactor = o.scale ?? 1;
    this.pointTarget = false;
  }
  faded(fadeIn) {
    const f = this.mobject.copy();
    f.fade(1);
    const dir = fadeIn && !this.pointTarget ? -1 : 1;
    f.shift(vmul(this.shiftVector, dir));
    f.scale(this.scaleFactor);
    return f;
  }
}

export class FadeIn extends Fade {
  constructor(mobjects, o = {}) {
    super(mobjects, { ...o, introducer: true });
  }
  createTarget() {
    return this.mobject;
  }
  createStartingMobject() {
    return this.faded(true);
  }
}

export class FadeOut extends Fade {
  constructor(mobjects, o = {}) {
    super(mobjects, { ...o, remover: true });
  }
  createTarget() {
    return this.faded(false);
  }
  cleanUpFromScene(scene) {
    super.cleanUpFromScene(scene);
    this.interpolate(0);
  }
}

export class Indicate extends Transform {
  constructor(mobject, o = {}) {
    super(mobject, null, { rateFunc: thereAndBack, ...o });
    this.scaleFactor = o.scaleFactor ?? 1.2;
    this.color = o.color ?? '#FFFF00';
  }
  createTarget() {
    return this.mobject.copy().scale(this.scaleFactor).setColor(this.color);
  }
}

export class GrowFromCenter extends Transform {
  constructor(mobject, o = {}) {
    super(mobject, null, { introducer: true, ...o });
  }
  createTarget() {
    return this.mobject;
  }
  createStartingMobject() {
    const s = this.mobject.copy();
    const c = this.mobject.getCenter();
    s.scale(0).moveTo(c);
    return s;
  }
}

// ------------------------------------------------------------------ partial drawing
export class Create extends Animation {
  constructor(mobject, o = {}) {
    super(mobject, { lagRatio: 1.0, introducer: true, ...o });
  }
  interpolateSubmobject(sub, start, alpha) {
    sub.pointwiseBecomePartial(start, 0, alpha);
  }
}
