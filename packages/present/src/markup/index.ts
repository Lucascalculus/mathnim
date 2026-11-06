// The text tools (docs/design/ENGINE-ARCH.md): their entries, the guides written from them, and the check of a text's
// markup. Importing this registers the built-in tools; a tool added later is a file imported here.
import './builtin';
export * from './registry';
export * from './guide';
export * from './check';
