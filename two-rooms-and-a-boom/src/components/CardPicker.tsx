import { useMemo, useState } from "react";
import {
  pickableCards,
  cardFromId,
  CORE_CARD_IDS,
  TEAM_FILLER_IDS,
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

const TEAM_MEMBER_IDS = TEAM_FILLER_IDS as readonly string[];

export default function CardPicker({
  selectedIds,
  onChange,
  disabled,
  playerCount,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  playerCount?: number;
}) {
  // Plain team members (b000/r000) may appear multiple times (the host adds
  // them via steppers); specials are single toggles.
  const specialIds = useMemo(
    () => selectedIds.filter((id) => !TEAM_MEMBER_IDS.includes(id)),
    [selectedIds]
  );
  const selected = useMemo(() => new Set(specialIds), [specialIds]);
  const blueCount = useMemo(
    () => selectedIds.filter((id) => id === "b000").length,
    [selectedIds]
  );
  const redCount = useMemo(
    () => selectedIds.filter((id) => id === "r000").length,
    [selectedIds]
  );

  // The most recently toggled special, so we can play a "pop back" animation
  // on the pool chip that re-enters its team group after being deselected.
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

  function setTeamCount(id: "b000" | "r000", count: number) {
    if (disabled) return;
    const others = selectedIds.filter((x) => x !== id);
    const next = [...others, ...Array.from({ length: count }, () => id)];
    onChange(next);
  }

  const core = CORE_CARD_IDS.map((id) => cardFromId(id));
  const teamMembers = TEAM_MEMBER_IDS.map((id) => cardFromId(id));

  const picked = TEAM_ORDER.flatMap((team) =>
    PICKABLE.filter((c) => c.team === team && selected.has(c.id)).sort(byName)
  );

  // Deck accounting: core (President + Bomber) + specials + plain team
  // members the host added. The builder pads any remainder automatically.
  const coreCount = CORE_CARD_IDS.length;
  const usedSlots = coreCount + specialIds.length + blueCount + redCount;
  const remaining = playerCount ? playerCount - usedSlots : null;
  const over = remaining != null && remaining < 0;

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

      <div className="card-picker-section">
        <p className="card-picker-section-label">Plain team members</p>
        <div className="card-picker-chips">
          {teamMembers.map((c) => {
            const count = c.id === "b000" ? blueCount : redCount;
            const canDec = count > 0 && !disabled;
            const canInc = !disabled && (remaining == null || remaining > 0);
            return (
              <div
                key={c.id}
                className={`card-chip team-${c.team} team-member${count > 0 ? " is-on" : ""}`}
                title={c.ability}
              >
                {cardImageUrl(c) && (
                  <img className="card-chip-thumb" src={cardImageUrl(c)!} alt="" aria-hidden="true" />
                )}
                <span className="card-chip-name">{c.name}</span>
                <div className="card-chip-stepper">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => setTeamCount(c.id as "b000" | "r000", count - 1)}
                    disabled={!canDec}
                    aria-label={`Remove a ${c.name} member`}
                  >
                    −
                  </button>
                  <span className="card-chip-count">{count}</span>
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => setTeamCount(c.id as "b000" | "r000", count + 1)}
                    disabled={!canInc}
                    aria-label={`Add a ${c.name} member`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
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

      <p className={`card-picker-summary${over ? " is-over" : ""}`}>
        {specialIds.length + blueCount + redCount} pick{specialIds.length + blueCount + redCount === 1 ? "" : "s"} so far
        {playerCount ? ` · deck ${usedSlots}/${playerCount}` : ""}. Mix any combination you want;
        any empty slots are filled automatically with plain Blue/Red team members.
        {over && <> (too many for {playerCount} players, remove some).</>}
      </p>
    </div>
  );
}
