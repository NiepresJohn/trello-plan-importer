"use client";

import { useState } from "react";
import type { LabelInput } from "../lib/plan";

export function LabelEditor({
  labels,
  onAdd,
  onRemove,
}: {
  labels: LabelInput[];
  onAdd: (label: string) => void;
  onRemove: (index: number) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="label-editor">
      <div className="chips">
        {labels.map((label, idx) => {
          const displayName = typeof label === "string" ? label : label.name;
          return (
            <span key={`${displayName}-${idx}`}>
              {displayName}
              <button onClick={() => onRemove(idx)} aria-label={`Remove ${displayName}`}>
                x
              </button>
            </span>
          );
        })}
      </div>
      <div className="inline-input">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Add label"
        />
        <button
          type="button"
          onClick={() => {
            onAdd(value);
            setValue("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
