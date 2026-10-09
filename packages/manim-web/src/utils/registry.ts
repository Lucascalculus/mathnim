// Late binding for classes that would otherwise create import cycles
// (e.g. Mobject.arrange_in_grid needs Line; Line's module imports Mobject).
export const registry: Record<string, any> = {};
export function register(classes: Record<string, any>): void {
  Object.assign(registry, classes);
}
