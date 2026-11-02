// Geometry + looks shared by the office scene and its overlays.
// Kept out of the component files so React fast refresh keeps working.

export const C = 0.8660254;
export const S = 44; // pixels per floor unit
export const OX = 520;
export const OY = 120;
export const ROOM = 11;
export const WALL_H = 5.2;
export const VIEW = { x: 128, y: 20, w: 792, h: 528 };

export const iso = (x, y, z = 0) => [OX + (x - y) * C * S, OY + (x + y) * 0.5 * S - z * S];
export const P = (...points) => points.map((p) => iso(...p).map((n) => n.toFixed(1)).join(",")).join(" ");

// Affine transforms that let us draw flat 2D art onto a wall / screen plane
export const rightWallMatrix = `matrix(${C * S},${0.5 * S},0,${S},${OX},${OY - S * WALL_H})`;
export const leftWallMatrix = `matrix(${-C * S},${0.5 * S},0,${S},${OX},${OY - S * WALL_H})`;
export const xPlaneMatrix = (X, zTop) =>
  `matrix(${-C * S},${0.5 * S},0,${S},${OX + X * C * S},${OY + X * 0.5 * S - zTop * S})`;

// Desk positions (floor units). Index = seat order of the team.
export const DESK_W = 1.15;
export const DESK_D = 2.5;
export const SLOTS = [
  { x: 1.3, y: 1.3 },
  { x: 5.4, y: 0.9 },
  { x: 1.5, y: 5.6 },
  { x: 5.7, y: 5.1 },
  { x: 8.5, y: 2.5 },
];

export const SEAT_COUNT = SLOTS.length;

// Look of each team member, by seat
export const LOOKS = [
  { hair: "#5b3624", hairStyle: "bun", accent: "#f472b6", top: "#ec4899", sleeve: "#3b82f6", pants: "#2f6fbd", shoes: "#f43f5e", phones: "#f9a8d4" },
  { hair: "#3b2416", hairStyle: "beanie", accent: "#f59e0b", top: "#f5efe3", sleeve: "#ece3d0", pants: "#2b2f3a", shoes: "#f59e0b", phones: null },
  { hair: "#6b4226", hairStyle: "curly", accent: "#111827", top: "#16a34a", sleeve: "#15803d", pants: "#1f2937", shoes: "#22c55e", phones: "#1f2937" },
  { hair: "#7a4a2a", hairStyle: "ponytail", accent: "#fb7185", top: "#fbcfe8", sleeve: "#f9a8d4", pants: "#334155", shoes: "#fda4af", phones: null },
  { hair: "#1f2937", hairStyle: "short", accent: "#6366f1", top: "#6366f1", sleeve: "#4f46e5", pants: "#1e293b", shoes: "#e5e7eb", phones: "#cbd5e1" },
];

export const SKIN = ["#f2c9a8", "#e8b892", "#c98e6a", "#f5d0b5", "#d9a37f"];


// Seat colour (hoodie) so cards outside the scene can match the character
// (strong enough for white text, e.g. the beanie agent's cream hoodie -> amber)
const SEAT_BADGES = ["#ec4899", "#f59e0b", "#16a34a", "#f43f5e", "#6366f1"];
export const seatColor = (index) => SEAT_BADGES[index % SEAT_BADGES.length];

export const seatAnchor = (index) => {
  const slot = SLOTS[index];
  const [sx, sy] = iso(slot.x + 1.8, slot.y + DESK_D / 2);
  return {
    left: ((sx - VIEW.x) / VIEW.w) * 100,
    top: ((sy - 98 - VIEW.y) / VIEW.h) * 100,
  };
};
