import { useState, type CSSProperties } from "react";
import { SPREADS, type SpreadId } from "@/lib/tarot";
import {
  useSlotLayout,
  updateSlot,
  updateCardWidth,
  resetLayout,
  getLayout,
} from "@/lib/slot-layout";

const CARD_ASPECT = 1086 / 1448;

const panelStyle: CSSProperties = {
  position: "fixed",
  top: 16,
  right: 16,
  zIndex: 9999,
  width: 264,
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
  padding: 14,
  borderRadius: 12,
  background: "rgba(12, 8, 20, 0.92)",
  border: "1px solid rgba(212, 175, 55, 0.5)",
  color: "#f3e7c9",
  font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
  boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
  backdropFilter: "blur(6px)",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 6,
};

const numBtn: CSSProperties = {
  width: 22,
  height: 22,
  lineHeight: "20px",
  textAlign: "center",
  borderRadius: 6,
  border: "1px solid rgba(212,175,55,0.5)",
  background: "rgba(212,175,55,0.12)",
  color: "#f3e7c9",
  cursor: "pointer",
  flex: "0 0 auto",
};

const inputStyle: CSSProperties = {
  width: 58,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(212,175,55,0.4)",
  borderRadius: 6,
  color: "#fff",
  padding: "2px 6px",
  font: "inherit",
};

function NudgeField({
  label,
  value,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (next: number) => void;
}) {
  const round = (n: number) => Math.round(n * 100) / 100;
  return (
    <div style={rowStyle}>
      <span style={{ width: 40, opacity: 0.8 }}>{label}</span>
      <button type="button" style={numBtn} onClick={() => onChange(round(value - step))}>
        −
      </button>
      <input
        style={inputStyle}
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
      <button type="button" style={numBtn} onClick={() => onChange(round(value + step))}>
        +
      </button>
    </div>
  );
}

/**
 * Live slot-alignment tool for the DRAWING stage. Lets you nudge each spread's
 * slot positions and the drawn-card width until they sit exactly on the painted
 * gold frames. Values persist to localStorage and "复制配置" copies the numbers
 * so they can be baked into the source.
 */
export function SlotLayoutDebugger({ spreadId }: { spreadId: SpreadId }) {
  const [open, setOpen] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const layout = useSlotLayout();
  const spread = layout[spreadId];

  const copyConfig = () => {
    const text = JSON.stringify(getLayout(), null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
    // Always log so the values can be copied from the console too.
    // eslint-disable-next-line no-console
    console.log("[slot-layout]", text);
  };

  return (
    <>
      {/* Visual slot guides — outline boxes at the current slot rects. */}
      {open && showGuides &&
        spread.slots.map((slot, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              left: `${slot.left}%`,
              top: `${slot.top}%`,
              width: `${spread.cardWidth}%`,
              aspectRatio: `${CARD_ASPECT}`,
              transform: "translate(-50%, -50%)",
              border: "1.5px dashed rgba(0, 229, 255, 0.9)",
              borderRadius: 6,
              boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
              pointerEvents: "none",
              zIndex: 50,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: 4,
                font: "11px/1 ui-monospace, monospace",
                color: "#00e5ff",
                textShadow: "0 1px 2px #000",
              }}
            >
              #{index}
            </span>
          </div>
        ))}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 14,
          left: 14,
          zIndex: 9999,
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px solid rgba(212,175,55,0.5)",
          background: open ? "rgba(212,175,55,0.85)" : "rgba(12,8,20,0.8)",
          color: open ? "#1a1206" : "#f3e7c9",
          font: "12px/1 ui-monospace, monospace",
          cursor: "pointer",
        }}
      >
        ⚙ 布局调试
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={{ ...rowStyle, justifyContent: "space-between", marginBottom: 10 }}>
            <strong style={{ color: "#d4af37" }}>卡槽对齐 · {SPREADS[spreadId].title}</strong>
          </div>

          <NudgeField
            label="牌宽%"
            value={spread.cardWidth}
            step={0.2}
            onChange={(v) => updateCardWidth(spreadId, v)}
          />

          <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "8px 0" }} />

          {spread.slots.map((slot, index) => (
            <div key={index} style={{ marginBottom: 10 }}>
              <div style={{ color: "#00e5ff", marginBottom: 4 }}>
                卡槽 #{index} · {SPREADS[spreadId].positions[index] ?? ""}
              </div>
              <NudgeField
                label="left"
                value={slot.left}
                onChange={(v) => updateSlot(spreadId, index, { left: v })}
              />
              <NudgeField
                label="top"
                value={slot.top}
                onChange={(v) => updateSlot(spreadId, index, { top: v })}
              />
            </div>
          ))}

          <label style={{ ...rowStyle, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showGuides}
              onChange={(e) => setShowGuides(e.target.checked)}
            />
            显示卡槽参考框
          </label>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              style={{ ...numBtn, width: "auto", padding: "0 10px", flex: 1 }}
              onClick={copyConfig}
            >
              复制配置
            </button>
            <button
              type="button"
              style={{ ...numBtn, width: "auto", padding: "0 10px", flex: 1 }}
              onClick={() => resetLayout(spreadId)}
            >
              重置本页
            </button>
          </div>
        </div>
      )}
    </>
  );
}
