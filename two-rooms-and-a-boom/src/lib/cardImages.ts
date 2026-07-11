// Derives the client-side card id -> image URL map from the shared art
// manifest (single source of truth in shared/game/cardArt.ts). The PNGs
// live in public/pnp-cards/ and are served at /pnp-cards/.
import { CARD_ART_FILES } from "@shared/game/cardArt";

export const CARD_IMAGE_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(CARD_ART_FILES).map(([id, file]) => [id, `/pnp-cards/${file}`])
);

export function cardImageUrl(card: { id: string } | null | undefined): string | null {
  if (!card) return null;
  const base = card.id.replace(/-\d+$/, "");
  return CARD_IMAGE_FILES[base] ?? null;
}
