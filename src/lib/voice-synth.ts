/**
 * Mock voice-clone audio synthesis (browser-side, no API needed).
 * Generates a tiny WAV per ACX chapter so users can download "per-chapter audio"
 * matching the cleaned-for-TTS script length. Voice timbre is derived from a
 * hash of the cloned voice name so each voice sounds distinct.
 *
 * NOT a TTS engine — this produces a sub-vocal carrier tone whose envelope and
 * cadence track word boundaries from the script. Real TTS happens once
 * ElevenLabs is enabled.
 */

const SAMPLE_RATE = 22050;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function writeStr(view: DataView, off: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
}

function pcmToWav(samples: Float32Array, sr = SAMPLE_RATE): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeStr(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(view, 8, "WAVE");
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Build a mock narration WAV whose duration matches the spoken script
 * at the given WPM, with envelope dips on punctuation/pauses.
 */
export function synthMockNarration(
  spokenText: string,
  opts: { voiceName?: string; wpm?: number } = {},
): Blob {
  const wpm = opts.wpm ?? 155;
  const words = spokenText.split(/\s+/).filter(Boolean);
  const seconds = Math.max(2, (words.length / wpm) * 60);
  // Hard cap for the mock so we don't allocate hundreds of MB.
  const cappedSeconds = Math.min(seconds, 180);
  const total = Math.floor(cappedSeconds * SAMPLE_RATE);
  const out = new Float32Array(total);

  const h = hash(opts.voiceName || "default");
  const baseFreq = 110 + (h % 40); // 110–150 Hz (male vocal range mock)
  const formant = 1.5 + ((h >> 3) % 10) / 10; // 1.5–2.5x harmonic
  const wordRate = words.length / cappedSeconds; // words per second

  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    // word index drives envelope dip
    const wordIdx = Math.floor(t * wordRate);
    const wordPhase = (t * wordRate) % 1;
    const env = Math.sin(wordPhase * Math.PI) * 0.6 + 0.2;
    // tone with subtle vibrato + formant harmonic
    const vibrato = 1 + Math.sin(t * 6) * 0.01;
    const carrier = Math.sin(2 * Math.PI * baseFreq * vibrato * t);
    const harm = Math.sin(2 * Math.PI * baseFreq * formant * vibrato * t) * 0.35;
    out[i] = (carrier + harm) * env * 0.18;
    // soft silence on every ~8 words to simulate breath
    if (wordIdx > 0 && wordIdx % 8 === 0 && wordPhase < 0.15) out[i] *= 0.15;
  }
  return pcmToWav(out);
}
