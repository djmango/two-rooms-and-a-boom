// Auto-generated from public/pnp-cards/manifest.json. Maps a card's
// catalog id to its cropped PnP graphic (served from /pnp-cards/).
// Cards without art here fall back to the text card layout.
export const CARD_IMAGE_FILES: Record<string, string> = {
  "b000": "/pnp-cards/pnp03_r0c1_blue-team-blue-7.png",
  "b001": "/pnp-cards/pnp10_r0c3_president-blue.png",
  "b030": "/pnp-cards/pnp13_r0c1_red-spy-blue.png",
  "g008": "/pnp-cards/pnp06_r1c1_gambler-grey.png",
  "g009": "/pnp-cards/pnp06_r1c2_hot-potato-grey.png",
  "g019": "/pnp-cards/pnp10_r1c1_private-eye-grey.png",
  "g026": "/pnp-cards/pnp13_r0c3_target-grey.png",
  "g028": "/pnp-cards/pnp13_r0c2_survivor-grey.png",
  "r000": "/pnp-cards/pnp11_r1c3_red-team-red-7.png",
  "r001": "/pnp-cards/pnp03_r0c3_bomber-red.png",
  "r004": "/pnp-cards/pnp02_r0c0_angel-red.png",
  "r014": "/pnp-cards/pnp06_r0c3_engineer-red.png",
  "r024": "/pnp-cards/pnp13_r1c2_tinkerer-red.png",
  "r025": "/pnp-cards/pnp10_r0c0_paparazzo-red.png",
  "r030": "/pnp-cards/pnp13_r0c0_blue-spy-red.png",
};

export function cardImageUrl(card: { id: string } | null | undefined): string | null {
  if (!card) return null;
  const base = card.id.replace(/-\d+$/, "");
  return CARD_IMAGE_FILES[base] ?? null;
}
