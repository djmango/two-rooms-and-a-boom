import { useMemo, useState } from "react";
import {
  pickableCards,
  cardFromId,
  CORE_CARD_IDS,
} from "@shared/game/deck";
import { cardImageUrl } from "@/lib/cardImages";
import type { CardDef, Team } from "@shared/game/types";

const PICKABLE = pickableCards();

const TEAM_ORDER: Team[] = ["blue", "red", "grey"];
const TEAM_LABEL: Record<Team, string> = {
  blue: "Blue team roles",
  red: "Red team roles",
  grey: "Grey roles",
  leader: "Leader",
};

const byName = (a: CardDef, b: CardDef) => a.name.localeCompare(b.name);

export default function CardPicker({
  selectedIds,
  onChange,
  disabled,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  // The most recently toggled card, so we can play a "pop back" animation
  // on the pool chip that re-enters its team group after being deselected.
  // (Selection already animates via the picked chip's mount animation.)
  const [lastDeselect, setLastDeselect] = useState<string | null>(null);

  function toggle(id: string) {
    if (disabled) return;
    if (selected.has(id)) {
      setLastDeselect(id);
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  const core = CORE_CARD_IDS.map((id) => cardFromId(id));

  const picked = TEAM_ORDER.flatMap((team) =>
    PICKABLE.filter((c) => c.team === team && selected.has(c.id)).sort(byName)
  );

  return (
    <div className="card-picker">
      <div className="card-picker-section">
        <p className="card-picker-section-label">Always in the deck</p>
        <div className="card-picker-chips">
          {core.map((c) => (
            <span key={c.id} className={`card-chip team-${c.team} locked`} title={c.ability}>
              {cardImageUrl(c) && (
                <img className="card-chip-thumb" src={cardImageUrl(c)!} alt="" aria-hidden="true" />
              )}
              <span className="card-chip-name">{c.name}</span>
              <span className="card-chip-tag">core</span>
            </span>
          ))}
        </div>
      </div>

      {picked.length > 0 && (
        <div className="card-picker-section card-picker-picked">
          <p className="card-picker-section-label">Picked for this deck</p>
          <div className="card-picker-chips">
            {picked.map((c, i) => (
              <button
                key={`${c.id}-picked`}
                type="button"
                className={`card-chip team-${c.team} is-on`}
                style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
                title={c.ability}
                aria-pressed={true}
                disabled={disabled}
                onClick={() => toggle(c.id)}
              >
                {cardImageUrl(c) && (
                  <img className="card-chip-thumb" src={cardImageUrl(c)!} alt="" aria-hidden="true" />
                )}
                <span className="card-chip-name">{c.name}</span>
                <span className="card-chip-tag">in · tap to remove</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {TEAM_ORDER.map((team) => {
        const pool = PICKABLE.filter((c) => c.team === team && !selected.has(c.id)).sort(byName);
        if (pool.length === 0) return null;
        return (
          <div key={team} className="card-picker-section">
            <p className="card-picker-section-label">{TEAM_LABEL[team]}</p>
            <div className="card-picker-chips">
              {pool.map((c) => (
                <button
                  key={`${c.id}-pool`}
                  type="button"
                  className={`card-chip team-${c.team}${
                    lastDeselect === c.id ? " is-returning" : ""
                  }`}
                  title={c.ability}
                  aria-pressed={false}
                  disabled={disabled}
                  onClick={() => toggle(c.id)}
                >
                  {cardImageUrl(c) && (
                    <img className="card-chip-thumb" src={cardImageUrl(c)!} alt="" aria-hidden="true" />
                  )}
                  <span className="card-chip-name">{c.name}</span>
                  <span className="card-chip-tag">{c.short}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <p className="card-picker-summary">
        {selectedIds.length} role{selectedIds.length === 1 ? "" : "s"} picked. Mix any combination
        you want; remaining slots are filled automatically with plain Blue/Red team members.
      </p>
    </div>
  );
}
