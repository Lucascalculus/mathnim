// The model that writes courses. This is the one place a provider plugs in:
// it receives a step's instructions and the PDFs it should read, and returns
// the reply text. Which provider production uses is not decided yet, so the
// deployed site answers "not configured"; the dev server can hand each step
// to a person or another agent through files (ReplayModel).

/** A file the step reads (an uploaded PDF or text). */
export interface StudioDoc {
  id: string;
  name: string;
  /** application/pdf or text/plain */
  type: string;
  bytes(): Promise<ArrayBuffer>;
  /** Where the file is on disk (dev only), for a model that reads files itself. */
  path?: string;
}
export interface StudioRequest {
  course: string;
  /** e.g. "map.f3k2", "lesson.l2", "lesson.l2.r2", "plan.fix" */
  step: string;
  /** Shared by every step (prompts.ts SYSTEM): a provider may cache it with the documents. */
  system: string;
  docs: StudioDoc[];
  prompt: string;
  /** How much thought the step deserves. */
  effort: 'medium' | 'high';
  max_tokens: number;
}
export interface StudioModel {
  name: string;
  /** The reply text; on_progress is told the characters written so far, when the provider streams. */
  run(req: StudioRequest, o?: { signal?: AbortSignal; on_progress?: (chars: number) => void }): Promise<string>;
}

/** No model is configured: generation is refused with a clear message. */
export class ModelMissing extends Error {}
/** The reply is not there yet (ReplayModel): the prompt was written to `prompt`. */
export class ReplyPending extends Error {
  constructor(readonly prompt: string) {
    super(`waiting for a reply to ${prompt}`);
  }
}

export const NO_MODEL: StudioModel = {
  name: 'none',
  run: () => Promise.reject(new ModelMissing('Course generation has no model configured yet.')),
};

/** The Node file functions ReplayModel uses (structural, like server/dev.ts). */
export interface ReplayFs {
  readFile(p: string, enc: 'utf8'): Promise<string>;
  writeFile(p: string, data: string): Promise<void>;
  mkdir(p: string, o: { recursive: true }): Promise<unknown>;
}

/**
 * Dev: each step is written to <dir>/<course>/<step>.prompt.md (system, the
 * paths of its PDFs, the instructions); the reply is read from
 * <step>.reply.md next to it. Until the reply exists the step is pending.
 * Used to try the prompts with any model, a person, or Claude Code agents.
 */
export class ReplayModel implements StudioModel {
  name = 'replay';
  constructor(private fs: ReplayFs, private dir: string) {}
  async run(req: StudioRequest): Promise<string> {
    const base = `${this.dir}/${req.course}/${req.step}`;
    try {
      const reply = await this.fs.readFile(`${base}.reply.md`, 'utf8');
      if (reply.trim()) return reply;
    } catch {
      /* not written yet */
    }
    await this.fs.mkdir(`${this.dir}/${req.course}`, { recursive: true });
    const docs = req.docs.map((d) => `- ${d.name}: ${d.path ?? '(not on disk)'}`).join('\n') || '(none)';
    await this.fs.writeFile(
      `${base}.prompt.md`,
      `<!-- step ${req.step} · effort ${req.effort} · max ${req.max_tokens} tokens · write the reply to ${req.step}.reply.md -->\n\n# System\n\n${req.system}\n\n# Documents (read each one in full)\n\n${docs}\n\n# Instructions\n\n${req.prompt}\n`,
    );
    throw new ReplyPending(`${base}.prompt.md`);
  }
}
