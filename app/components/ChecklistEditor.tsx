"use client";

import { useState } from "react";

export function ChecklistEditor({
  items,
  onAdd,
  onRemove,
}: {
  items: string[];
  onAdd: (text: string) => void;
  onRemove: (index: number) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="checklist">
      <ul>
        {items.map((item, idx) => (
          <li key={`${item}-${idx}`}>
            <span>{item}</span>
            <button onClick={() => onRemove(idx)} aria-label={`Remove ${item}`}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="inline-input">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Add checklist item"
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
