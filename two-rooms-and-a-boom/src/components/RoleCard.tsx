import type { CardDef } from "@shared/game/types";

export default function RoleCard({
  card,
  revealed,
  onReveal,
}: {
  card: CardDef | null;
  revealed: boolean;
  onReveal: () => void;
}) {
  if (!card) return null;

  if (!revealed) {
    return (
      <div className="you-card-wrap">
        <button type="button" className="card-reveal" onClick={onReveal}>
          <span className="card-reveal-ring" aria-hidden="true" />
          <span className="card-reveal-inner">
            <span className="peek">Tap to reveal your role</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="you-card-wrap">
      <article className={`role-card team-${card.team}`}>
        <div className="team">{card.team}</div>
        <h3>{card.name}</h3>
        <p className="short">{card.short}</p>
        <p className="ability">{card.ability}</p>
      </article>
    </div>
  );
}
