import type { Emotion, Color } from "../types.js";

// Per-emotion facial features as inline SVG fragments, composed into a face.
interface FaceSpec {
  bg: string;
  brows: string;
  eyes: string;
  mouth: string;
  extra?: string;
}

const EYES_NORMAL =
  '<circle cx="23" cy="28" r="3" fill="#2a2a2a"/><circle cx="41" cy="28" r="3" fill="#2a2a2a"/>';
const EYES_WIDE =
  '<circle cx="23" cy="28" r="5" fill="#fff" stroke="#2a2a2a"/><circle cx="23" cy="28" r="2.4" fill="#2a2a2a"/>' +
  '<circle cx="41" cy="28" r="5" fill="#fff" stroke="#2a2a2a"/><circle cx="41" cy="28" r="2.4" fill="#2a2a2a"/>';
const EYES_HAPPY =
  '<path d="M19 29 Q23 24 27 29" fill="none" stroke="#2a2a2a" stroke-width="2.4" stroke-linecap="round"/>' +
  '<path d="M37 29 Q41 24 45 29" fill="none" stroke="#2a2a2a" stroke-width="2.4" stroke-linecap="round"/>';
const EYES_HALF =
  '<circle cx="23" cy="29" r="3" fill="#2a2a2a"/><circle cx="41" cy="29" r="3" fill="#2a2a2a"/>' +
  '<path d="M19 26 H27" stroke="#2a2a2a" stroke-width="2.4" stroke-linecap="round"/>' +
  '<path d="M37 26 H45" stroke="#2a2a2a" stroke-width="2.4" stroke-linecap="round"/>';
const EYES_UP =
  '<circle cx="24" cy="26" r="3" fill="#2a2a2a"/><circle cx="42" cy="26" r="3" fill="#2a2a2a"/>';

const SPECS: Record<Emotion, FaceSpec> = {
  neutral: {
    bg: "#ffd8a8",
    brows:
      '<path d="M17 19 H29" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M35 19 H47" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>',
    eyes: EYES_NORMAL,
    mouth: '<path d="M24 46 H40" stroke="#2a2a2a" stroke-width="2.6" stroke-linecap="round"/>',
  },
  happy: {
    bg: "#ffe0a8",
    brows:
      '<path d="M17 18 Q23 15 29 18" fill="none" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M35 18 Q41 15 47 18" fill="none" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>',
    eyes: EYES_HAPPY,
    mouth:
      '<path d="M21 42 Q32 53 43 42" fill="none" stroke="#2a2a2a" stroke-width="2.8" stroke-linecap="round"/>',
    extra:
      '<circle cx="16" cy="38" r="3.5" fill="#ff9aa2" opacity="0.55"/><circle cx="48" cy="38" r="3.5" fill="#ff9aa2" opacity="0.55"/>',
  },
  sad: {
    bg: "#cfe3ff",
    brows:
      '<path d="M17 17 L29 21" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M35 21 L47 17" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>',
    eyes: EYES_NORMAL,
    mouth:
      '<path d="M22 49 Q32 40 42 49" fill="none" stroke="#2a2a2a" stroke-width="2.8" stroke-linecap="round"/>',
    extra: '<path d="M41 31 q3 5 0 8 q-3 -3 0 -8 Z" fill="#5bb6ff"/>',
  },
  angry: {
    bg: "#ffb3a8",
    brows:
      '<path d="M17 16 L29 22" stroke="#7a2a1e" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path d="M35 22 L47 16" stroke="#7a2a1e" stroke-width="2.8" stroke-linecap="round"/>',
    eyes: EYES_NORMAL,
    mouth:
      '<path d="M23 49 Q32 44 41 49" fill="none" stroke="#2a2a2a" stroke-width="2.8" stroke-linecap="round"/>',
  },
  surprised: {
    bg: "#ffe7c2",
    brows:
      '<path d="M17 14 Q23 11 29 14" fill="none" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M35 14 Q41 11 47 14" fill="none" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>',
    eyes: EYES_WIDE,
    mouth: '<ellipse cx="32" cy="46" rx="5" ry="7" fill="#2a2a2a"/>',
  },
  nervous: {
    bg: "#fff0b8",
    brows:
      '<path d="M17 17 Q23 15 29 17" fill="none" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M35 16 Q41 14 47 16" fill="none" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>',
    eyes: EYES_NORMAL,
    mouth:
      '<path d="M23 47 q3 -4 5 0 q2 4 5 0 q3 -4 5 0" fill="none" stroke="#2a2a2a" stroke-width="2.4" stroke-linecap="round"/>',
    extra: '<path d="M47 24 q3 5 0 9 q-3 -4 0 -9 Z" fill="#7fd1ff"/>',
  },
  confident: {
    bg: "#ffe0a8",
    brows:
      '<path d="M17 19 H29" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M35 16 Q41 14 47 17" fill="none" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>',
    eyes: EYES_HALF,
    mouth:
      '<path d="M22 45 Q32 50 43 41" fill="none" stroke="#2a2a2a" stroke-width="2.8" stroke-linecap="round"/>',
  },
  thinking: {
    bg: "#e8def8",
    brows:
      '<path d="M17 20 H29" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M35 15 Q41 13 47 16" fill="none" stroke="#7a4a1e" stroke-width="2.4" stroke-linecap="round"/>',
    eyes: EYES_UP,
    mouth:
      '<path d="M28 48 Q34 45 39 48" fill="none" stroke="#2a2a2a" stroke-width="2.6" stroke-linecap="round"/>',
    extra:
      '<circle cx="50" cy="44" r="1.4" fill="#2a2a2a"/><circle cx="54" cy="40" r="2" fill="#2a2a2a"/>',
  },
};

/** Build an SVG avatar for an emotion, ringed in the player's piece color. */
export function faceSvg(emotion: Emotion, side: Color): string {
  const spec = SPECS[emotion] ?? SPECS.neutral;
  const ring = side === "w" ? "#f4f6fa" : "#20262f";
  return `
    <svg viewBox="0 0 64 64" width="100%" height="100%" role="img" aria-label="${emotion} face">
      <circle cx="32" cy="32" r="30" fill="${spec.bg}" stroke="${ring}" stroke-width="3"/>
      ${spec.brows}
      ${spec.eyes}
      ${spec.mouth}
      ${spec.extra ?? ""}
    </svg>`;
}
