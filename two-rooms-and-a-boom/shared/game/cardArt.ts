// Catalog card ids that have PnP artwork extracted from the PDFs, mapped
// to the cropped PNG filename (the client serves these from /pnp-cards/).
// This is the single source of truth for "does this card have art?" so the
// custom-mix card picker and the server's pickable-card validation stay in
// sync -- a card only appears in the custom mix if we can show its picture.
export const CARD_ART_FILES: Record<string, string> = {
  b000: "pnp03_r0c1_blue-team-blue-7.png",
  b001: "pnp10_r0c3_president-blue.png",
  b030: "pnp13_r0c1_red-spy-blue.png",
  g008: "pnp06_r1c1_gambler-grey.png",
  g009: "pnp06_r1c2_hot-potato-grey.png",
  g019: "pnp10_r1c1_private-eye-grey.png",
  g028: "pnp13_r0c2_survivor-grey.png",
  r000: "pnp11_r1c3_red-team-red-7.png",
  r001: "pnp03_r0c3_bomber-red.png",
  r004: "pnp02_r0c0_angel-red.png",
  r014: "pnp06_r1c3_engineer-red.png",
  r024: "pnp13_r1c2_tinkerer-red.png",
  r025: "pnp10_r0c0_paparazzo-red.png",
  r030: "pnp13_r0c0_blue-spy-red.png",
};

export const CARD_ART_ID_SET: ReadonlySet<string> = new Set(
  Object.keys(CARD_ART_FILES)
);

export function hasCardArt(cardId: string): boolean {
  const base = cardId.replace(/-\d+$/, "");
  return CARD_ART_ID_SET.has(base);
}
