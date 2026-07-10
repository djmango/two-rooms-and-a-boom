let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
  return ctx;
}

/**
 * A goofy "wah-wah-wah-waaaah" sad trombone, synthesized on the fly (no
 * audio file needed) to play when a round's timer runs out.
 */
export function playRoundEndAlarm(): void {
  try {
    const audio = getAudioContext();
    if (!audio) return;

    const notes = [392.0, 369.99, 349.23, 329.63]; // G4, F#4, F4, E4
    const noteDur = 0.32;
    const gap = 0.02;
    let t = audio.currentTime + 0.02;

    notes.forEach((freq, i) => {
      const isLast = i === notes.length - 1;
      const dur = isLast ? noteDur * 2 : noteDur;

      const osc = audio.createOscillator();
      osc.type = "sawtooth";

      const filter = audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1100;

      const gain = audio.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.03);
      gain.gain.linearRampToValueAtTime(0.13, t + dur * 0.7);
      gain.gain.linearRampToValueAtTime(0, t + dur);

      osc.frequency.setValueAtTime(freq, t);
      if (isLast) {
        // Droop the final note down for the classic comedic "letdown".
        osc.frequency.linearRampToValueAtTime(freq * 0.82, t + dur);
      }

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audio.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);

      t += dur + gap;
    });
  } catch {
    /* ignore: audio is a nice-to-have, never block the game on it */
  }
}
