// Export a scene as MP4 video (with its sounds) or PNG frames, in the
// browser (web extension). Frames are rendered as fast as the encoder
// accepts them - faster than real time - using WebCodecs via mediabunny.
//
//   const blob = await export_video(player, { fps: 30, on_progress: (p) => ... });
import type { ScenePlayer } from './player';

export interface ExportOptions {
  /** Output frame rate (default: the player's). Frames are resampled from scene time. */
  fps?: number;
  /** 'high' | 'medium' | 'low' or bits per second. */
  quality?: 'high' | 'medium' | 'low' | number;
  /** Include add_sound() audio (default true). */
  audio?: boolean;
  /** Time range in seconds (default: whole scene). */
  from?: number;
  to?: number;
  on_progress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Render the player's timeline to an MP4 Blob (H.264/AAC, or VP9/Opus in WebM if unavailable). */
export async function export_video(player: ScenePlayer, o: ExportOptions = {}): Promise<Blob> {
  const mb = await import('mediabunny');
  const fps = o.fps ?? player.fps;
  const t0 = o.from ?? 0, t1 = Math.min(o.to ?? player.duration, player.duration);
  const n = Math.max(1, Math.round((t1 - t0) * fps));
  const canvas = player.canvas;
  const quality = typeof o.quality === 'number' ? o.quality : { high: mb.QUALITY_HIGH, medium: mb.QUALITY_MEDIUM, low: mb.QUALITY_LOW }[o.quality ?? 'high'];
  const w = canvas.width, h = canvas.height;
  let codec = await mb.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1', 'vp8'], { width: w, height: h });
  if (!codec) throw new Error('This browser cannot encode video (WebCodecs unavailable).');
  const mp4 = codec === 'avc' || codec === 'av1';
  const output = new mb.Output({ format: mp4 ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(), target: new mb.BufferTarget() });
  const video = new mb.CanvasSource(canvas as HTMLCanvasElement, { codec, bitrate: quality as any });
  output.addVideoTrack(video, { frameRate: fps });
  let audio: any = null, audioBuffer: AudioBuffer | null = null;
  if (o.audio !== false && player.scene.sounds.length && typeof OfflineAudioContext !== 'undefined') {
    audioBuffer = await mix_sounds(player, t0, t1);
    const acodec = await mb.getFirstEncodableAudioCodec(mp4 ? ['aac', 'opus'] : ['opus', 'vorbis']);
    if (audioBuffer && acodec) {
      audio = new mb.AudioBufferSource({ codec: acodec, bitrate: 128000 });
      output.addAudioTrack(audio);
    }
  }
  await output.start();
  const was_playing = player.playing;
  player.pause();
  for (let i = 0; i < n; i++) {
    if (o.signal?.aborted) {
      await output.cancel();
      throw new DOMException('Export aborted', 'AbortError');
    }
    player.compute_frame(Math.floor((t0 + i / fps) * player.fps + 1e-6));
    player.draw();
    await video.add(i / fps, 1 / fps);
    o.on_progress?.((i + 1) / n);
  }
  if (audio && audioBuffer) await audio.add(audioBuffer);
  await output.finalize();
  if (was_playing) player.play();
  const buf = (output.target as InstanceType<typeof mb.BufferTarget>).buffer!;
  return new Blob([buf], { type: mp4 ? 'video/mp4' : 'video/webm' });
}

/** Mix the scene's sounds into one buffer for [t0, t1]. */
async function mix_sounds(player: ScenePlayer, t0: number, t1: number): Promise<AudioBuffer | null> {
  const rate = 48000;
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil((t1 - t0) * rate)), rate);
  let any = false;
  for (const s of player.scene.sounds) {
    try {
      const data = await fetch(s.src).then((r) => r.arrayBuffer());
      const buf = await ctx.decodeAudioData(data);
      if (s.time + buf.duration <= t0 || s.time >= t1) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = s.gain === null ? 1 : Math.pow(10, s.gain / 20);
      src.connect(g).connect(ctx.destination);
      src.start(Math.max(0, s.time - t0), Math.max(0, t0 - s.time));
      any = true;
    } catch {
      /* skip sounds that cannot be loaded */
    }
  }
  return any ? ctx.startRendering() : null;
}

/** PNG of the frame at time t (seconds). */
export async function export_png(player: ScenePlayer, t: number): Promise<Blob> {
  player.seek_time(t);
  const c = player.canvas as HTMLCanvasElement | OffscreenCanvas;
  if ('convertToBlob' in c) return c.convertToBlob({ type: 'image/png' });
  return new Promise((res, rej) => (c as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
}
