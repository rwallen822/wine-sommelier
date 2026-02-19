import { C } from "./theme";

// Thin line-art SVG decorations — wine-themed, organic, hand-drawn feel
// All accept size, color, opacity, style props for flexibility

export const GrapeLeaf = ({ size = 80, color = C.accent, opacity = 0.07, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ ...style, opacity }}>
    <path
      d="M50 90 C50 90 20 65 15 40 C10 15 30 5 50 10 C70 5 90 15 85 40 C80 65 50 90 50 90Z"
      stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.3"
    />
    <path d="M50 10 L50 90" stroke={color} strokeWidth="1" />
    <path d="M50 30 C40 25 25 30 20 40" stroke={color} strokeWidth="0.8" fill="none" />
    <path d="M50 30 C60 25 75 30 80 40" stroke={color} strokeWidth="0.8" fill="none" />
    <path d="M50 50 C42 47 30 50 25 58" stroke={color} strokeWidth="0.8" fill="none" />
    <path d="M50 50 C58 47 70 50 75 58" stroke={color} strokeWidth="0.8" fill="none" />
    <path d="M50 68 C44 66 36 68 32 74" stroke={color} strokeWidth="0.8" fill="none" />
    <path d="M50 68 C56 66 64 68 68 74" stroke={color} strokeWidth="0.8" fill="none" />
  </svg>
);

export const GrapeCluster = ({ size = 60, color = C.accent, opacity = 0.08, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 80 90" fill="none" style={{ ...style, opacity }}>
    <circle cx="30" cy="35" r="8" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.25" />
    <circle cx="50" cy="35" r="8" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.25" />
    <circle cx="40" cy="50" r="8" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.25" />
    <circle cx="20" cy="50" r="8" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.25" />
    <circle cx="60" cy="50" r="8" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.25" />
    <circle cx="30" cy="65" r="8" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.25" />
    <circle cx="50" cy="65" r="8" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.25" />
    <circle cx="40" cy="78" r="8" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.25" />
    {/* Stem */}
    <path d="M40 27 C40 15 45 8 55 5" stroke={color} strokeWidth="1.2" fill="none" />
    <path d="M55 5 C60 3 65 5 62 12" stroke={color} strokeWidth="1" fill="none" />
  </svg>
);

export const VineTendril = ({ width = 120, color = C.accent, opacity = 0.06, style = {} }) => (
  <svg width={width} height={width * 0.25} viewBox="0 0 200 50" fill="none" style={{ ...style, opacity }}>
    <path
      d="M0 25 C20 25 30 10 50 10 C70 10 60 40 80 40 C100 40 90 10 110 10 C130 10 120 40 140 40 C160 40 150 10 170 10 C185 10 195 20 200 25"
      stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round"
    />
    {/* Small curls */}
    <path d="M50 10 C55 2 62 2 60 10" stroke={color} strokeWidth="1" fill="none" />
    <path d="M110 10 C115 2 122 2 120 10" stroke={color} strokeWidth="1" fill="none" />
    <path d="M170 10 C175 2 182 2 180 10" stroke={color} strokeWidth="1" fill="none" />
    {/* Small leaves */}
    <path d="M80 40 C85 45 92 44 90 38" stroke={color} strokeWidth="0.8" fill={color} fillOpacity="0.2" />
    <path d="M140 40 C145 45 152 44 150 38" stroke={color} strokeWidth="0.8" fill={color} fillOpacity="0.2" />
  </svg>
);

export const WineBottle = ({ size = 100, color = C.accent, opacity = 0.06, style = {} }) => (
  <svg width={size * 0.35} height={size} viewBox="0 0 35 100" fill="none" style={{ ...style, opacity }}>
    <path
      d="M13 5 L13 25 C8 30 5 38 5 48 L5 90 C5 95 8 98 13 98 L22 98 C27 98 30 95 30 90 L30 48 C30 38 27 30 22 25 L22 5Z"
      stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.15"
    />
    {/* Neck ring */}
    <path d="M12 8 L23 8" stroke={color} strokeWidth="1" />
    {/* Label area */}
    <rect x="8" y="55" width="19" height="22" rx="2" stroke={color} strokeWidth="0.8" fill={color} fillOpacity="0.1" />
    {/* Label text lines */}
    <line x1="11" y1="62" x2="24" y2="62" stroke={color} strokeWidth="0.6" />
    <line x1="13" y1="66" x2="22" y2="66" stroke={color} strokeWidth="0.5" />
    <line x1="12" y1="70" x2="23" y2="70" stroke={color} strokeWidth="0.5" />
  </svg>
);

export const WineGlassArt = ({ size = 80, color = C.accent, opacity = 0.07, style = {} }) => (
  <svg width={size * 0.6} height={size} viewBox="0 0 50 80" fill="none" style={{ ...style, opacity }}>
    {/* Bowl */}
    <path
      d="M5 5 L8 35 C8 45 15 50 25 50 C35 50 42 45 42 35 L45 5Z"
      stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.12"
    />
    {/* Wine level */}
    <path
      d="M10 20 C15 22 35 22 40 20 L42 35 C42 45 35 50 25 50 C15 50 8 45 8 35Z"
      fill={color} fillOpacity="0.15"
    />
    {/* Stem */}
    <line x1="25" y1="50" x2="25" y2="68" stroke={color} strokeWidth="1.2" />
    {/* Base */}
    <path d="M14 68 C14 68 18 75 25 75 C32 75 36 68 36 68" stroke={color} strokeWidth="1.2" fill="none" />
    <line x1="14" y1="68" x2="36" y2="68" stroke={color} strokeWidth="1" />
  </svg>
);

// Decorative divider with vine motif
export const VineDivider = ({ color = C.accent, opacity = 0.1, style = {} }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0", ...style, opacity }}>
    <div style={{ flex: 1, height: 1, background: color }} />
    <GrapeCluster size={20} color={color} opacity={1} />
    <div style={{ flex: 1, height: 1, background: color }} />
  </div>
);
