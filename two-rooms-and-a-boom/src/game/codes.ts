import WORDS from "../words.json";

const WORD_LIST = WORDS as string[];

/** Normalize user-typed codes: spaces/underscores → hyphens, lowercase. */
export function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidCode(code: string): boolean {
  const parts = normalizeCode(code).split("-");
  if (parts.length !== 3) return false;
  return parts.every((p) => WORD_LIST.includes(p));
}

function randomWord(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return WORD_LIST[buf[0]! % WORD_LIST.length]!;
}

/** Three easy-to-say words. ~1500³ ≈ 3.4e9 combos — fine for dozens/hundreds of concurrent rooms. */
export function generateCode(): string {
  return `${randomWord()}-${randomWord()}-${randomWord()}`;
}

export function codeParts(code: string): string[] {
  return normalizeCode(code).split("-");
}
