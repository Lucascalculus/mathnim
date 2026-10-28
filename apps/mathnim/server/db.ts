// Storage for accounts and uploaded courses: a SQL database (Cloudflare D1 in
// production, Node's built-in SQLite in dev, the same SQL in both) and a blob
// store for the uploaded files (R2 in production, files in dev). Only the
// parts we use are typed here, so no Workers or Node type package is needed.

/** A prepared statement (D1's shape). */
export interface SqlStmt {
  bind(...values: unknown[]): SqlStmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface SqlDb {
  prepare(sql: string): SqlStmt;
  /** Several statements separated by semicolons (schema setup). */
  exec(sql: string): Promise<unknown>;
}
/** R2, the part we use. */
export interface BlobStore {
  put(key: string, value: ArrayBuffer | Uint8Array, o?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; size: number } | null>;
  delete(key: string): Promise<void>;
}

/** The bindings and variables the account and studio routes read. */
export interface DataEnv {
  DB?: SqlDb;
  FILES?: BlobStore;
  ALLOWED_ORIGINS?: string;
  RATE_LIMITS?: string;
}

// One line per statement: D1's exec() runs a statement per line.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_codes (email TEXT PRIMARY KEY, hash TEXT NOT NULL, expires INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL, sent_today INTEGER NOT NULL DEFAULT 0, day INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
CREATE TABLE IF NOT EXISTS user_state (user_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (user_id, key));
CREATE TABLE IF NOT EXISTS studio_courses (id TEXT PRIMARY KEY, owner TEXT NOT NULL, lang TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', named INTEGER NOT NULL DEFAULT 0, public INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS studio_courses_owner ON studio_courses (owner);
CREATE TABLE IF NOT EXISTS studio_files (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, blob TEXT NOT NULL, remote TEXT, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS studio_files_course ON studio_files (course_id);
CREATE TABLE IF NOT EXISTS studio_parts (course_id TEXT NOT NULL, key TEXT NOT NULL, json TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (course_id, key));
`;

/** Columns added after a table was first made: added where missing (an error means it is there already). */
const LATER = ['ALTER TABLE studio_courses ADD COLUMN named INTEGER NOT NULL DEFAULT 0'];

const ready = new WeakMap<SqlDb, Promise<unknown>>();
/** Create the tables once per database and isolate (CREATE ... IF NOT EXISTS, so it is safe to repeat). */
export function with_schema(db: SqlDb): Promise<SqlDb> {
  let p = ready.get(db);
  if (!p) {
    p = db.exec(SCHEMA.trim()).then(() => Promise.all(LATER.map((sql) => Promise.resolve().then(() => db.prepare(sql).run()).catch(() => undefined))));
    p.catch(() => ready.delete(db));
    ready.set(db, p);
  }
  return p.then(() => db);
}

/** A random id of `n` characters from a lower-case alphabet without look-alikes. */
export function new_id(n = 10): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}
