import { useState, type CSSProperties } from "react";
import {
  useGlow,
  updateGlow,
  resetGlow,
  getGlow,
  type GlowState,
} from "@/lib/candle-glow";

const STATE_LABELS: Record<GlowState, string> = {
  MENU: "首页 menu",
  SPREAD_SELECTION: "牌阵 spreads",
  SHUFFLE: "洗牌 wash",
  DRAWING: "抽牌 drawing",
  SUCCESS: "成功 success",
  REVERSAL: "揭示 reversal",
  END: "结果 end",
};

const panelStyle: CSSProperties = {
  position: "fixed",
  top: 16,
  left: 16,
  zIndex: 9999,
  width: 248,
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
  step = 0.5,
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
      <span style={{ width: 28, opacity: 0.8 }}>{label}</span>
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
 * Live candle-glow alignment tool. Lets you nudge the flickering halo position
 * for the CURRENT game state until it sits exactly on the painted flame. Values
 * persist to localStorage; "复制配置" copies the numbers to bake into source.
 */
export function CandleGlowDebugger({ gameState }: { gameState: GlowState }) {
  const [open, setOpen] = useState(false);
  const glow = useGlow();
  const spots = glow[gameState] ?? [];

  const copyConfig = () => {
    const text = JSON.stringify(getGlow(), null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
    // eslint-disable-next-line no-console
    console.log("[candle-glow]", text);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 14,
          left: 120,
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
        🕯 烛光校准
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={{ ...rowStyle, justifyContent: "space-between", marginBottom: 10 }}>
            <strong style={{ color: "#d4af37" }}>烛光位置 · {STATE_LABELS[gameState]}</strong>
          </div>

          {spots.length === 0 && (
            <div style={{ opacity: 0.7 }}>当前页面没有烛光。</div>
          )}

          {spots.map((spot, index) => (
            <div key={index} style={{ marginBottom: 10 }}>
              {spots.length > 1 && (
                <div style={{ color: "#ffc24d", marginBottom: 4 }}>烛光 #{index}</div>
              )}
              <NudgeField
                label="x%"
                value={spot.x}
                onChange={(v) => updateGlow(gameState, index, { x: v })}
              />
              <NudgeField
                label="y%"
                value={spot.y}
                onChange={(v) => updateGlow(gameState, index, { y: v })}
              />
            </div>
          ))}

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
              onClick={() => resetGlow(gameState)}
            >
              重置本页
            </button>
          </div>
        </div>
      )}
    </>
  );
}
