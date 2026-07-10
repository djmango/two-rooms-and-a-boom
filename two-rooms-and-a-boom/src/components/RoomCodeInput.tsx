import { useEffect, useRef, useState } from "react";
import WORDS from "@shared/game/words.json";

const WORD_LIST = WORDS as string[];
const WORD_SET = new Set(WORD_LIST);

function cleanWord(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, "");
}

interface Props {
  value: string[];
  onChange: (parts: string[]) => void;
  onComplete?: () => void;
}

export default function RoomCodeInput({ value, onChange, onComplete }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [focused, setFocused] = useState(-1);

  useEffect(() => {
    if (!value.length || value.every((p) => !p)) {
      refs.current[0]?.focus();
    }
  }, [value]);

  function setPart(index: number, raw: string) {
    const cleaned = cleanWord(raw);
    const next = [...value];
    while (next.length < 3) next.push("");
    next[index] = cleaned;
    onChange(next);

    if (cleaned && WORD_SET.has(cleaned) && index < 2) {
      const el = refs.current[index + 1];
      if (el) {
        el.focus();
        el.select();
      }
    }

    if (
      cleaned &&
      WORD_SET.has(cleaned) &&
      index === 2 &&
      next.slice(0, 2).every((p) => WORD_SET.has(p))
    ) {
      onComplete?.();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    const part = value[index] ?? "";
    if (e.key === "Backspace" && !part && index > 0) {
      const prev = refs.current[index - 1];
      if (prev) {
        prev.focus();
        const len = value[index - 1]?.length ?? 0;
        prev.setSelectionRange(len, len);
      }
    }
    if (e.key === "Enter") {
      const allValid = value.every((p) => WORD_SET.has(cleanWord(p)));
      if (allValid) onComplete?.();
    }
    if (e.key === "ArrowLeft" && (part.length === 0 || (e.currentTarget.selectionStart ?? 0) === 0) && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && (e.currentTarget.selectionStart ?? 0) === part.length && index < 2) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    const parts = text.toLowerCase().split(/[\s_-]+/).map(cleanWord).filter(Boolean);
    if (parts.length === 1) return;
    e.preventDefault();
    const next = [...value];
    while (next.length < 3) next.push("");
    for (let i = 0; i < 3; i += 1) {
      if (parts[i]) next[index + i > 2 ? 2 : index + i] = parts[i]!;
    }
    onChange(next);
    const lastFilled = Math.min(2, index + parts.length - 1);
    const target = refs.current[Math.min(2, lastFilled + 1)] ?? refs.current[2];
    if (target) {
      target.focus();
      target.select();
    }
    if (next.every((p) => WORD_SET.has(p))) onComplete?.();
  }

  return (
    <div className="code-input" role="group" aria-label="Room code">
      {[0, 1, 2].map((i) => {
        const part = value[i] ?? "";
        const isValid = part.length > 0 && WORD_SET.has(part);
        const isActive = focused === i;
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            value={part}
            onChange={(e) => setPart(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={(e) => handlePaste(i, e)}
            onFocus={(e) => {
              setFocused(i);
              e.target.select();
            }}
            onBlur={() => setFocused(-1)}
            maxLength={12}
            placeholder={i === 0 ? "coral" : i === 1 ? "lantern" : "swift"}
            aria-label={`Word ${i + 1}`}
            className={`code-input-field ${isValid ? "is-valid" : ""} ${isActive ? "is-active" : ""}`}
            data-separator={i < 2 ? "-" : undefined}
          />
        );
      })}
    </div>
  );
}
