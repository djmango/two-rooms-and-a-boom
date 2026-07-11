import { useMemo } from "react";
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

function byTeam(team: Team): CardDef[] {
  return PICKABLE.filter((c) => c.team === team).sort((a, b) => a.name.localeCompare(b.name));
}

const GROUPS = TEAM_ORDER.map((team) => ({ team, cards: byTeam(team) }));

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

  function toggle(id: string) {
    if (disabled) return;
    onChange(selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  const core = CORE_CARD_IDS.map((id) => cardFromId(id));

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

      {GROUPS.map((group) => (
        <div key={group.team} className="card-picker-section">
          <p className="card-picker-section-label">{TEAM_LABEL[group.team]}</p>
          <div className="card-picker-chips">
            {group.cards.map((c) => {
              const on = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`card-chip team-${c.team}${on ? " is-on" : ""}`}
                  title={c.ability}
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => toggle(c.id)}
                >
                  {cardImageUrl(c) && (
                    <img className="card-chip-thumb" src={cardImageUrl(c)!} alt="" aria-hidden="true" />
                  )}
                  <span className="card-chip-name">{c.name}</span>
                  <span className="card-chip-tag">{on ? "in" : c.short}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p className="card-picker-summary">
        {selectedIds.length} role{selectedIds.length === 1 ? "" : "s"} picked. Blue/Red team
        filler cards are added automatically to balance the deck to the player count.
        {selectedIds.length === 0 && (
          <> For an odd player count, pick a grey role (like the Gambler) so teams balance.</>
        )}
      </p>
    </div>
  );
}
