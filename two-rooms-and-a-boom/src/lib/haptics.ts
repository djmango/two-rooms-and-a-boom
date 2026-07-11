type VibratePattern = number | number[];

/**
 * Vibrate the device when a round's timer runs out, mirroring the
 * sad-trombone alarm's "wah-wah-wah-waaaah" rhythm. Silently no-ops on
 * browsers without the Vibration API (iOS Safari, desktop) or when the
 * device doesn't allow it, so it's always safe to call.
 */
export function vibrateRoundEnd(): void {
  try {
    const nav = navigator as Navigator & { vibrate?: (pattern: VibratePattern) => boolean };
    if (typeof nav.vibrate !== "function") return;
    // vibrate 300ms, pause 80ms, vibrate 300, pause 80, vibrate 300, pause 80, vibrate 600
    nav.vibrate([300, 80, 300, 80, 300, 80, 600]);
  } catch {
    /* ignore: haptics are a nice-to-have, never block the game on it */
  }
}
