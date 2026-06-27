import { useState, type CSSProperties } from "react";
import {
  useHotspotLayout,
  updateHotspot,
  resetHotspotLayout,
  getHotspotLayout,
  type ScreenId,
  type HotspotRect,
} from "@/lib/hotspot-layout";

const panelStyle: CSSProperties = {
  position: "fixed",
  top: 16,
  right: 16,
  zIndex: 9999,
  width: 280,
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
      <span style={{ width: 44, opacity: 0.8 }}>{label}</span>
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

function HotspotGuide({ hotspot }: { hotspot: HotspotRect }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${hotspot.left}%`,
        top: `${hotspot.top}%`,
        width: `${hotspot.width}%`,
        height: `${hotspot.height}%`,
        transform: `translate(-50%, -50%) rotate(${hotspot.rotate ?? 0}deg)`,
        border: "1.5px dashed rgba(0, 229, 255, 0.9)",
        borderRadius: 6,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
        pointerEvents: "none",
        zIndex: 50,
        background: "rgba(0, 229, 255, 0.06)",
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
        {hotspot.id}
      </span>
    </div>
  );
}

/**
 * Live hotspot debugger for transparent button overlays.
 * Lets you nudge the clickable areas on the menu / spread-selection / shuffle
 * screens until they sit exactly on the painted buttons. Values persist to
 * localStorage and "复制配置" copies the JSON so it can be baked into source.
 */
export function HotspotDebugger({ screenId }: { screenId: ScreenId }) {
  const [open, setOpen] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const layout = useHotspotLayout();
  const screen = layout[screenId];

  const copyConfig = () => {
    const text = JSON.stringify(getHotspotLayout(), null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
    // eslint-disable-next-line no-console
    console.log("[hotspot-layout]", text);
  };

  return (
    <>
      {open && showGuides &&
        screen.hotspots.map((hotspot) => <HotspotGuide key={hotspot.id} hotspot={hotspot} />)}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 14,
          right: 14,
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
        ⚙ 按钮区域
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={{ ...rowStyle, justifyContent: "space-between", marginBottom: 10 }}>
            <strong style={{ color: "#d4af37" }}>按钮区域 · {screenId}</strong>
          </div>

          {screen.hotspots.map((hotspot) => (
            <div key={hotspot.id} style={{ marginBottom: 14 }}>
              <div style={{ color: "#00e5ff", marginBottom: 4 }}>
                {hotspot.id} · {hotspot.label}
              </div>
              <NudgeField
                label="left"
                value={hotspot.left}
                onChange={(v) => updateHotspot(screenId, hotspot.id, { left: v })}
              />
              <NudgeField
                label="top"
                value={hotspot.top}
                onChange={(v) => updateHotspot(screenId, hotspot.id, { top: v })}
              />
              <NudgeField
                label="width"
                value={hotspot.width}
                onChange={(v) => updateHotspot(screenId, hotspot.id, { width: v })}
              />
              <NudgeField
                label="height"
                value={hotspot.height}
                onChange={(v) => updateHotspot(screenId, hotspot.id, { height: v })}
              />
              {hotspot.rotate !== undefined && (
                <NudgeField
                  label="rotate"
                  value={hotspot.rotate}
                  step={1}
                  onChange={(v) => updateHotspot(screenId, hotspot.id, { rotate: v })}
                />
              )}
            </div>
          ))}

          <label style={{ ...rowStyle, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showGuides}
              onChange={(e) => setShowGuides(e.target.checked)}
            />
            显示参考框
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
              onClick={() => resetHotspotLayout(screenId)}
            >
              重置本页
            </button>
          </div>
        </div>
      )}
    </>
  );
}
