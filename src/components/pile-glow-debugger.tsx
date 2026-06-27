import { useEffect, useState, type CSSProperties } from "react";
import {
  usePileGlow,
  updatePileGlow,
  resetPileGlow,
  getPileGlow,
  setPileGlowPreview,
} from "@/lib/pile-glow";

const panelStyle: CSSProperties = {
  position: "fixed",
  top: 16,
  right: 16,
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
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
}) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const clamp = (n: number) => {
    let v = n;
    if (typeof min === "number") v = Math.max(min, v);
    if (typeof max === "number") v = Math.min(max, v);
    return round(v);
  };
  return (
    <div style={rowStyle}>
      <span style={{ width: 42, opacity: 0.8 }}>{label}</span>
      <button type="button" style={numBtn} onClick={() => onChange(clamp(value - step))}>
        −
      </button>
      <input
        style={inputStyle}
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(clamp(v));
        }}
      />
      <button type="button" style={numBtn} onClick={() => onChange(clamp(value + step))}>
        +
      </button>
    </div>
  );
}

/**
 * Live calibration tool for the "shuffle complete" gold flare. While open it
 * forces the glow to render statically so position / size / colour depth can be
 * dialed in; values persist to localStorage. "复制配置" copies the numbers so
 * they can be baked into DEFAULT_PILE_GLOW.
 */
export function PileGlowDebugger() {
  const [open, setOpen] = useState(false);
  const cfg = usePileGlow();

  // Keep the static preview glow visible only while the panel is open.
  useEffect(() => {
    setPileGlowPreview(open);
    return () => setPileGlowPreview(false);
  }, [open]);

  const copyConfig = () => {
    const text = JSON.stringify(getPileGlow(), null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
    // eslint-disable-next-line no-console
    console.log("[pile-glow]", text);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 14,
          right: 120,
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
        ✨ 金光校准
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={{ ...rowStyle, justifyContent: "space-between", marginBottom: 10 }}>
            <strong style={{ color: "#d4af37" }}>洗牌金光特效</strong>
          </div>
          <div style={{ opacity: 0.7, marginBottom: 10 }}>
            面板打开时会常驻显示金光，便于对位。
          </div>

          <NudgeField
            label="左右 x%"
            value={cfg.x}
            step={0.5}
            min={0}
            max={100}
            onChange={(v) => updatePileGlow({ x: v })}
          />
          <NudgeField
            label="上下 y%"
            value={cfg.y}
            step={0.5}
            min={0}
            max={100}
            onChange={(v) => updatePileGlow({ y: v })}
          />
          <NudgeField
            label="大小 %"
            value={cfg.size}
            step={1}
            min={2}
            max={120}
            onChange={(v) => updatePileGlow({ size: v })}
          />
          <NudgeField
            label="深浅"
            value={cfg.intensity}
            step={0.05}
            min={0}
            max={1}
            onChange={(v) => updatePileGlow({ intensity: v })}
          />

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
              onClick={() => resetPileGlow()}
            >
              重置
            </button>
          </div>
        </div>
      )}
    </>
  );
}
