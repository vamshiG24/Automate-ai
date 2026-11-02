import { useId } from "react";

import {
  ROOM, WALL_H, VIEW, iso, P, rightWallMatrix, leftWallMatrix,
  xPlaneMatrix, DESK_W, DESK_D, SLOTS, LOOKS, SKIN,
} from "./layout";

// --------------------------------------------------
// LIVE AGENT OFFICE
// --------------------------------------------------
// An isometric office drawn in SVG. Every agent of a team sits at its own
// desk; its pose, monitor and status bubble follow the agent's live status.
// Everything is code-drawn (no image assets), so it scales and animates.

// ---------- primitives ----------

function Box({ x, y, z = 0, w, d, h, top, left, right }) {
  return (
    <g>
      <polygon points={P([x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h])} fill={left} />
      <polygon points={P([x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h])} fill={right} />
      <polygon points={P([x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h])} fill={top} />
    </g>
  );
}

function FloorRect({ x, y, w, d, fill, opacity = 1 }) {
  return <polygon points={P([x, y], [x + w, y], [x + w, y + d], [x, y + d])} fill={fill} opacity={opacity} />;
}

function Plant({ at, screen, size = 1, pot = "#f8fafc", potSide = "#e2e8f0", leaf = "#3f9d5a", leafLight = "#6cc27f" }) {
  const [sx, sy] = screen ?? iso(at.x, at.y, at.z ?? 0);
  return (
    <g transform={`translate(${sx},${sy}) scale(${size})`}>
      <ellipse cx="0" cy="2" rx="13" ry="5" fill="#0f172a" opacity="0.08" />
      <path d="M-11,-18 L11,-18 L8,0 Q0,4 -8,0 Z" fill={pot} />
      <path d="M0,-18 L11,-18 L8,0 Q4,2 0,2 Z" fill={potSide} />
      <ellipse cx="0" cy="-18" rx="11" ry="3.5" fill="#cbd5e1" />
      <g className="office-sway">
        {[-34, -20, -6, 8, 22, 36].map((angle, index) => (
          <ellipse
            key={angle}
            cx="0"
            cy="-34"
            rx="5.5"
            ry="17"
            fill={index % 2 ? leafLight : leaf}
            transform={`rotate(${angle} 0 -18)`}
          />
        ))}
        <ellipse cx="0" cy="-38" rx="5" ry="16" fill={leafLight} />
      </g>
    </g>
  );
}

// ---------- monitor screens ----------

function ScreenContent({ state, gradId }) {
  // Local coords: u = 0..0.77 across the screen, w = 0..0.47 downward
  if (state === "running") {
    return (
      <g>
        <rect x="0" y="0" width="0.77" height="0.47" fill="#0f172a" />
        {[
          [0.05, 0.07, 0.38, "#60a5fa"], [0.1, 0.13, 0.3, "#f472b6"], [0.1, 0.19, 0.44, "#a3e635"],
          [0.05, 0.25, 0.24, "#60a5fa"], [0.1, 0.31, 0.5, "#fbbf24"], [0.1, 0.37, 0.28, "#a3e635"],
        ].map(([u, w, len, color]) => (
          <rect key={`${u}-${w}`} x={0.77 - u - len} y={w} width={len} height="0.025" rx="0.012" fill={color} opacity="0.9" />
        ))}
        <rect className="office-glow" x="0" y="0" width="0.77" height="0.47" fill="#60a5fa" opacity="0.12" />
      </g>
    );
  }

  if (state === "waiting_approval") {
    return (
      <g>
        <rect x="0" y="0" width="0.77" height="0.47" fill="#fef3c7" />
        <circle cx="0.385" cy="0.235" r="0.13" fill="#f59e0b" className="office-glow" />
        <rect x="0.372" y="0.15" width="0.026" height="0.1" rx="0.013" fill="#fff" />
        <circle cx="0.385" cy="0.29" r="0.016" fill="#fff" />
      </g>
    );
  }

  if (state === "completed") {
    return (
      <g>
        <rect x="0" y="0" width="0.77" height="0.47" fill="#dcfce7" />
        <circle cx="0.385" cy="0.235" r="0.13" fill="#22c55e" />
        <path d="M0.45,0.235 L0.4,0.29 L0.31,0.2" fill="none" stroke="#fff" strokeWidth="0.03" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }

  if (state === "failed") {
    return (
      <g>
        <rect x="0" y="0" width="0.77" height="0.47" fill="#fee2e2" />
        <circle cx="0.385" cy="0.235" r="0.13" fill="#ef4444" />
        <path d="M0.43,0.19 L0.34,0.28 M0.34,0.19 L0.43,0.28" stroke="#fff" strokeWidth="0.03" strokeLinecap="round" />
      </g>
    );
  }

  if (state === "off") {
    return <rect x="0" y="0" width="0.77" height="0.47" fill="#1e293b" />;
  }

  // idle / pending: mountain wallpaper
  return (
    <g>
      <rect x="0" y="0" width="0.77" height="0.47" fill={`url(#${gradId}-wall)`} />
      <path d="M0,0.47 L0,0.33 L0.18,0.2 L0.33,0.3 L0.5,0.14 L0.77,0.32 L0.77,0.47 Z" fill="#60a5fa" opacity="0.75" />
      <path d="M0,0.47 L0,0.38 L0.25,0.3 L0.45,0.37 L0.62,0.31 L0.77,0.36 L0.77,0.47 Z" fill="#34d399" />
    </g>
  );
}

function Monitor({ x, y, state, gradId }) {
  const z0 = 0.95;
  const h = 0.55;
  const depth = 0.85;
  const thick = 0.06;
  const X = x + thick;

  return (
    <g>
      <Box x={x - 0.08} y={y + depth / 2 - 0.16} z={0.77} w={0.32} d={0.32} h={0.02} top="#334155" left="#1e293b" right="#0f172a" />
      <Box x={x - 0.02} y={y + depth / 2 - 0.05} z={0.79} w={0.07} d={0.1} h={0.18} top="#334155" left="#1e293b" right="#0f172a" />
      <Box x={x} y={y} z={z0} w={thick} d={depth} h={h} top="#475569" left="#1e293b" right="#111827" />
      <g transform={`${xPlaneMatrix(X, z0 + h - 0.04)} translate(${y + 0.04},0)`}>
        <ScreenContent state={state} gradId={gradId} />
      </g>
      {state === "running" && (
        <polygon className="office-glow" points={P([X, y, z0], [X + 0.5, y - 0.1, 0.77], [X + 0.5, y + depth + 0.1, 0.77], [X, y + depth, z0])} fill="#60a5fa" opacity="0.18" />
      )}
    </g>
  );
}

// ---------- desk ----------

function Desk({ slot, screen, gradId }) {
  const { x, y } = slot;
  const lampAt = iso(x + 0.25, y + DESK_D - 0.3, 0.77);

  return (
    <g>
      {/* rug + soft shadow */}
      <FloorRect x={x - 0.45} y={y - 0.35} w={3.05} d={DESK_D + 0.7} fill="#8193c7" opacity="0.32" />
      <FloorRect x={x - 0.3} y={y - 0.2} w={2.75} d={DESK_D + 0.4} fill="#93a5d6" opacity="0.28" />
      <FloorRect x={x - 0.05} y={y + 0.05} w={DESK_W + 0.2} d={DESK_D} fill="#0f172a" opacity="0.07" />

      {/* drawer cabinet + PC + leg panel */}
      <Box x={x + 0.05} y={y + 0.08} w={1.0} d={0.7} h={0.7} top="#f1f5f9" left="#e2e8f0" right="#cfd8e6" />
      {[0.2, 0.42].map((zLine) => (
        <polyline key={zLine} points={P([x + 1.05, y + 0.12, zLine], [x + 1.05, y + 0.74, zLine])} stroke="#b6c2d6" strokeWidth="1" fill="none" />
      ))}
      <Box x={x + 0.25} y={y + DESK_D - 0.75} w={0.45} d={0.22} h={0.5} top="#334155" left="#1f2937" right="#111827" />
      <polyline points={P([x + 0.7, y + DESK_D - 0.72, 0.42], [x + 0.7, y + DESK_D - 0.56, 0.42])} stroke="#38bdf8" strokeWidth="1.5" />
      <Box x={x + 0.1} y={y + DESK_D - 0.1} w={0.95} d={0.06} h={0.7} top="#334155" left="#1f2937" right="#111827" />

      {/* desktop + blue LED strip */}
      <Box x={x} y={y} z={0.7} w={DESK_W} d={DESK_D} h={0.07} top="#ffffff" left="#e8edf5" right="#dbe3ee" />
      <polyline points={P([x + DESK_W, y, 0.69], [x + DESK_W, y + DESK_D, 0.69])} stroke="#60a5fa" strokeWidth="2.5" opacity="0.85" />
      <polyline points={P([x + DESK_W, y, 0.69], [x + DESK_W, y + DESK_D, 0.69])} stroke="#93c5fd" strokeWidth="6" opacity="0.25" />

      {/* monitors */}
      <Monitor x={x + 0.18} y={y + 0.3} state={screen} gradId={gradId} />
      <Monitor x={x + 0.18} y={y + 1.25} state={screen === "running" ? "running" : screen === "off" ? "off" : "idle"} gradId={gradId} />

      {/* keyboard, mouse, mug, lamp, little plant */}
      <Box x={x + 0.62} y={y + 0.75} z={0.77} w={0.24} d={0.85} h={0.025} top="#475569" left="#334155" right="#1e293b" />
      <Box x={x + 0.7} y={y + 1.8} z={0.77} w={0.13} d={0.09} h={0.03} top="#475569" left="#334155" right="#1e293b" />
      <Box x={x + 0.75} y={y + 0.1} z={0.77} w={0.12} d={0.12} h={0.12} top="#fbbf24" left="#f59e0b" right="#d97706" />
      <g transform={`translate(${lampAt[0]},${lampAt[1]})`}>
        <ellipse cx="0" cy="0" rx="5" ry="2" fill="#1f2937" />
        <path d="M0,0 L2,-20 L12,-24" stroke="#1f2937" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M9,-28 L18,-22 L13,-18 Z" fill="#1f2937" />
      </g>
      <Plant at={{ x: x + 0.3, y: y + 2.2, z: 0.77 }} size={0.45} />
    </g>
  );
}

// ---------- person ----------

function Hair({ style, color, accent }) {
  const base = <circle cx="-2" cy="-61" r="12.5" fill={color} />;

  if (style === "bun") {
    return (
      <g>
        {base}
        <circle cx="-4" cy="-76" r="6.5" fill={color} />
        <ellipse cx="-4" cy="-71" rx="6" ry="2.4" fill={accent} />
      </g>
    );
  }
  if (style === "beanie") {
    return (
      <g>
        <circle cx="-2" cy="-60" r="12" fill={color} />
        <path d="M-15,-61 Q-14,-80 -2,-80 Q11,-80 11,-61 Z" fill={accent} />
        {[-11, -6, -1, 4, 9].map((stripe) => (
          <line key={stripe} x1={stripe} y1="-78" x2={stripe} y2="-63" stroke="#d97706" strokeWidth="1" opacity="0.5" />
        ))}
        <rect x="-15.5" y="-64" width="27" height="5" rx="2.5" fill="#d97706" />
      </g>
    );
  }
  if (style === "curly") {
    return (
      <g>
        {base}
        {[[-13, -64], [-10, -72], [-3, -75], [5, -72], [9, -65], [-14, -56], [8, -58]].map(([cx, cy]) => (
          <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="5" fill={color} />
        ))}
      </g>
    );
  }
  if (style === "ponytail") {
    return (
      <g>
        {base}
        <path d="M6,-64 Q16,-58 10,-40 Q6,-46 4,-54 Z" fill={color} />
        <circle cx="7" cy="-64" r="3" fill={accent} />
      </g>
    );
  }
  return (
    <g>
      <path d="M-14,-60 Q-14,-74 -2,-74 Q10,-74 10,-60 Q4,-64 -2,-63 Q-9,-62 -14,-60 Z" fill={color} />
    </g>
  );
}

function Person({ look, skin, pose }) {
  const typing = pose === "typing";
  const raised = pose === "raised";

  return (
    <g>
      {/* feet + legs reaching under the desk */}
      <path d="M-6,-20 Q-16,-20 -22,-12 L-18,-8 Q-12,-14 -4,-14 Z" fill={look.pants} />
      <ellipse cx="-22" cy="-8" rx="6" ry="3.2" fill={look.shoes} />
      <path d="M4,-20 Q-4,-14 -10,-6 L-6,-3 Q2,-10 8,-16 Z" fill={look.pants} />
      <ellipse cx="-9" cy="-3" rx="6" ry="3.2" fill={look.shoes} />

      {/* left arm (far side) */}
      <g className={typing ? "office-type-l" : undefined}>
        <path d="M-10,-46 Q-20,-44 -25,-37" stroke={look.sleeve} strokeWidth="7" fill="none" strokeLinecap="round" />
        <circle cx="-26" cy="-36" r="3.4" fill={skin} />
      </g>

      {/* torso (hoodie) */}
      <path d="M-15,-22 Q-17,-36 -14,-47 Q-8,-54 0,-54 Q9,-54 13,-47 Q15,-36 13,-22 Z" fill={look.top} />
      <path d="M-7,-52 Q-1,-47 6,-52 Q4,-56 -1,-56 Q-5,-56 -7,-52 Z" fill={look.sleeve} opacity="0.65" />

      {/* right arm */}
      {raised ? (
        <g className="office-bob">
          <path d="M10,-48 Q18,-58 17,-72" stroke={look.sleeve} strokeWidth="7" fill="none" strokeLinecap="round" />
          <circle cx="17" cy="-75" r="4" fill={skin} />
        </g>
      ) : (
        <g className={typing ? "office-type-r" : undefined}>
          <path d="M11,-46 Q16,-38 12,-32 Q4,-33 -4,-37" stroke={look.sleeve} strokeWidth="7" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* head */}
      <rect x="-5" y="-54" width="7" height="6" rx="2" fill={skin} />
      <circle cx="-2" cy="-61" r="11.5" fill={skin} />
      <ellipse cx="9.5" cy="-60" rx="2.6" ry="3.6" fill={skin} />
      <Hair style={look.hairStyle} color={look.hair} accent={look.accent} />
      {look.phones && (
        <g>
          <path d="M-14,-62 Q-3,-82 10,-63" stroke={look.phones} strokeWidth="3" fill="none" />
          <rect x="7" y="-66" width="6" height="10" rx="3" fill={look.phones} />
        </g>
      )}
    </g>
  );
}

function Chair({ withPerson, look, skin, pose }) {
  return (
    <g>
      <ellipse cx="0" cy="1" rx="17" ry="6" fill="#0f172a" opacity="0.12" />
      {[[-14, -1], [14, -1], [-7, 4], [8, 4], [0, -4]].map(([cx, cy]) => (
        <g key={`${cx}${cy}`}>
          <line x1="0" y1="-2" x2={cx} y2={cy} stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={cx} cy={cy + 1} r="1.8" fill="#111827" />
        </g>
      ))}
      <rect x="-1.8" y="-18" width="3.6" height="16" fill="#374151" />
      <ellipse cx="-2" cy="-19" rx="15" ry="6" fill="#374151" />
      <ellipse cx="-2" cy="-20.5" rx="14" ry="5" fill="#475569" />

      {withPerson && <Person look={look} skin={skin} pose={pose} />}

      {/* chair back in front of the person's back */}
      <path d="M-12,-20 L-12,-40 Q-12,-47 -2,-47 Q10,-47 10,-40 L10,-20 Z" fill="#2f3542" opacity={withPerson ? 0.96 : 1} />
      <path d="M-9,-23 L-9,-39 Q-9,-43 -2,-43 Q7,-43 7,-39 L7,-23 Z" fill="#3f4655" />
      <path d="M12,-28 L16,-30 L16,-22" stroke="#1f2937" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </g>
  );
}

// ---------- room ----------

function Room({ gradId }) {
  return (
    <g>
      {/* floor */}
      <polygon points={P([0, 0], [ROOM, 0], [ROOM, ROOM], [0, ROOM])} fill="#e9edf5" />
      {Array.from({ length: ROOM - 1 }, (_, index) => index + 1).map((n) => (
        <g key={n} stroke="#dde3ee" strokeWidth="1">
          <polyline points={P([n, 0], [n, ROOM])} fill="none" />
          <polyline points={P([0, n], [ROOM, n])} fill="none" />
        </g>
      ))}
      {/* sunlight from the windows */}
      {[1.2, 4.2, 7.2].map((start) => (
        <polygon key={start} points={P([start, 0], [start + 2.2, 0], [start + 4.2, 4.2], [start + 2, 4.2])} fill={`url(#${gradId}-sun)`} />
      ))}

      {/* left wall */}
      <polygon points={P([0, 0, 0], [0, ROOM, 0], [0, ROOM, WALL_H], [0, 0, WALL_H])} fill="#eef2f9" />
      <g transform={leftWallMatrix}>
        {/* blue slatted feature wall */}
        <rect x="0.35" y="0" width="3.6" height={WALL_H - 0.2} fill="#3b5fc4" />
        {Array.from({ length: 14 }, (_, index) => (
          <rect key={index} x={0.45 + index * 0.25} y="0" width="0.06" height={WALL_H - 0.2} fill="#5b7ddb" />
        ))}
        {/* framed art */}
        <rect x="1" y="1.1" width="1.2" height="1.5" fill="#f8fafc" />
        <rect x="1.08" y="1.18" width="1.04" height="1.34" fill="#bfdbfe" />
        <path d="M1.2,2.3 Q1.5,1.5 1.9,1.9 Q2.0,2.3 1.2,2.3 Z" fill="#3b82f6" />
        <rect x="2.5" y="1.5" width="1.1" height="1.3" fill="#f8fafc" />
        <rect x="2.58" y="1.58" width="0.94" height="1.14" fill="#dbeafe" />
        <circle cx="3.05" cy="2.15" r="0.32" fill="#2563eb" />
        {/* shelves with books */}
        {[2.6, 3.5].map((shelfY) => (
          <g key={shelfY}>
            <rect x="5.4" y={shelfY} width="4.6" height="0.1" fill="#cbd5e1" />
            {[
              [5.6, 0.18, "#6366f1"], [5.82, 0.14, "#f59e0b"], [5.99, 0.2, "#ec4899"], [6.24, 0.16, "#0ea5e9"],
              [7.4, 0.2, "#14b8a6"], [7.64, 0.14, "#f43f5e"], [7.82, 0.18, "#8b5cf6"], [9.0, 0.2, "#22c55e"], [9.24, 0.16, "#64748b"],
            ].map(([bx, bw, color]) => (
              <rect key={`${shelfY}-${bx}`} x={bx} y={shelfY - 0.55} width={bw} height="0.55" fill={color} />
            ))}
          </g>
        ))}
        <rect x="0" y={WALL_H - 0.18} width={ROOM} height="0.18" fill="#dbe2ee" />
      </g>

      {/* right wall with windows */}
      <polygon points={P([0, 0, 0], [ROOM, 0, 0], [ROOM, 0, WALL_H], [0, 0, WALL_H])} fill="#f6f8fc" />
      <g transform={rightWallMatrix}>
        <defs>
          <clipPath id={`${gradId}-glass`}>
            <rect x="0.5" y="0.25" width="10.1" height="4.3" />
          </clipPath>
        </defs>
        <rect x="0.5" y="0.25" width="10.1" height="4.3" fill={`url(#${gradId}-sky)`} />
        <g clipPath={`url(#${gradId}-glass)`}>
          {[
            [0.6, 1.9, 0.7, "#a9bfe0"], [1.4, 1.3, 0.55, "#c3d3ec"], [2.0, 2.3, 0.6, "#93abd6"], [2.7, 1.6, 0.8, "#b4c6e6"],
            [3.6, 0.9, 0.5, "#8fa8d4"], [4.2, 1.8, 0.7, "#c3d3ec"], [5.0, 1.2, 0.9, "#a0b7de"], [6.0, 2.0, 0.55, "#8aa3d0"],
            [6.6, 1.5, 0.7, "#bccce9"], [7.4, 0.8, 0.6, "#98afd8"], [8.1, 1.7, 0.8, "#b0c3e5"], [9.0, 1.1, 0.6, "#8fa8d4"], [9.7, 1.9, 0.8, "#c3d3ec"],
          ].map(([bx, top, bw, color]) => (
            <g key={bx}>
              <rect x={bx} y={top} width={bw} height={4.5 - top} fill={color} />
              {Array.from({ length: Math.floor((3.2 - top) / 0.28) }, (_, row) => (
                <rect key={row} x={bx + 0.1} y={top + 0.15 + row * 0.28} width={bw - 0.2} height="0.07" fill="#e0ecfb" opacity="0.7" />
              ))}
            </g>
          ))}
          {Array.from({ length: 24 }, (_, index) => (
            <circle key={index} cx={0.4 + index * 0.45} cy={3.95 - (index % 3) * 0.12} r={0.38 + (index % 4) * 0.06} fill={index % 2 ? "#5fb36b" : "#4a9d5c"} />
          ))}
          {Array.from({ length: 24 }, (_, index) => (
            <circle key={index} cx={0.6 + index * 0.45} cy={4.3} r="0.36" fill={index % 2 ? "#78c785" : "#5aae68"} />
          ))}
        </g>
        {/* window frames */}
        <rect x="0.5" y="0.25" width="10.1" height="4.3" fill="none" stroke="#e2e8f0" strokeWidth="0.1" />
        {[3.0, 5.55, 8.1].map((mullion) => (
          <rect key={mullion} x={mullion} y="0.25" width="0.1" height="4.3" fill="#e2e8f0" />
        ))}
        <rect x="0.5" y="2.2" width="10.1" height="0.05" fill="#e2e8f0" />
        <rect x="0.35" y="4.5" width="10.4" height="0.14" fill="#ffffff" />
        <rect x="0" y={WALL_H - 0.18} width={ROOM} height="0.18" fill="#e5eaf3" />
        {/* LED strip under the window sill */}
        <rect x="0.5" y="4.64" width="10.1" height="0.04" fill="#93c5fd" opacity="0.8" />
      </g>
    </g>
  );
}

function Sofa() {
  const x = 2.2;
  const y = 9.5;
  return (
    <g>
      <FloorRect x={x - 0.2} y={y - 0.1} w={3.1} d={1.3} fill="#0f172a" opacity="0.06" />
      <Box x={x} y={y} w={2.7} d={1.0} h={0.32} top="#a5b4fc" left="#818cf8" right="#6366f1" />
      <Box x={x + 0.08} y={y + 0.05} z={0.32} w={1.25} d={0.75} h={0.1} top="#c7d2fe" left="#a5b4fc" right="#818cf8" />
      <Box x={x + 1.37} y={y + 0.05} z={0.32} w={1.25} d={0.75} h={0.1} top="#c7d2fe" left="#a5b4fc" right="#818cf8" />
      <Box x={x} y={y + 0.8} z={0.32} w={2.7} d={0.25} h={0.5} top="#a5b4fc" left="#818cf8" right="#6366f1" />
      <Box x={x - 0.22} y={y} w={0.22} d={1.05} h={0.6} top="#a5b4fc" left="#818cf8" right="#6366f1" />
      <Box x={x + 2.7} y={y} w={0.22} d={1.05} h={0.6} top="#a5b4fc" left="#818cf8" right="#6366f1" />
      <Box x={x + 0.4} y={y + 0.55} z={0.42} w={0.45} d={0.25} h={0.35} top="#fde68a" left="#fbbf24" right="#f59e0b" />
    </g>
  );
}

function CoffeeTable() {
  const [sx, sy] = iso(4.2, 8.55, 0);
  return (
    <g transform={`translate(${sx},${sy})`}>
      <ellipse cx="0" cy="4" rx="40" ry="14" fill="#0f172a" opacity="0.08" />
      <line x1="0" y1="-20" x2="0" y2="2" stroke="#1f2937" strokeWidth="3" />
      <ellipse cx="0" cy="3" rx="14" ry="4" fill="#1f2937" />
      <ellipse cx="0" cy="-20" rx="36" ry="14" fill="#f1f5f9" />
      <ellipse cx="0" cy="-22" rx="36" ry="14" fill="#ffffff" />
      {Array.from({ length: 14 }, (_, index) => (
        <circle key={index} cx={-26 + (index * 7) % 52} cy={-26 + ((index * 5) % 9)} r="0.9" fill="#94a3b8" />
      ))}
      <rect x="-14" y="-30" width="20" height="4" rx="1" fill="#1d4ed8" />
      <rect x="-12" y="-33" width="18" height="3.5" rx="1" fill="#f59e0b" />
      <Plant screen={[12, -24]} size={0.5} />
    </g>
  );
}

// ---------- scene ----------

const POSES = {
  running: "typing",
  waiting_approval: "raised",
  completed: "resting",
  failed: "resting",
  skipped: "resting",
  pending: "resting",
  idle: "resting",
};

/**
 * @param agents  [{ id, status }] in seat order (max 5). Empty seats get
 *                an empty desk.
 */
export default function OfficeScene({ agents = [], className = "" }) {
  const gradId = `office${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const drawables = SLOTS.map((slot, index) => {
    const agent = agents[index];
    const status = agent?.status ?? "empty";
    const screen = !agent ? "off"
      : status === "running" ? "running"
      : status === "waiting_approval" ? "waiting_approval"
      : status === "completed" ? "completed"
      : status === "failed" ? "failed"
      : "idle";
    const [cx, cy] = iso(slot.x + 1.8, slot.y + DESK_D / 2);

    return {
      depth: slot.x + slot.y,
      node: (
        <g key={index}>
          <Desk slot={slot} screen={screen} gradId={gradId} />
          <g transform={`translate(${cx},${cy}) scale(1.15)`}>
            <Chair
              withPerson={Boolean(agent)}
              look={LOOKS[index]}
              skin={SKIN[index]}
              pose={POSES[status] ?? "resting"}
            />
            {agent && <title>{agent.title ?? agent.id}</title>}
          </g>
        </g>
      ),
    };
  });

  drawables.push(
    { depth: 0.3 + 10.4, node: <Plant key="plant-left" at={{ x: 0.5, y: 10.3 }} size={1.6} /> },
    { depth: 10.4 + 0.5, node: <Plant key="plant-right" at={{ x: 10.3, y: 0.6 }} size={1.5} leaf="#2f8a4a" /> },
    { depth: 3.6 + 0.4, node: <Plant key="plant-mid" at={{ x: 3.6, y: 0.4 }} size={1.1} /> },
    { depth: 0.4 + 4.6, node: <Plant key="plant-wall" at={{ x: 0.4, y: 4.6 }} size={1.2} leaf="#3a8f55" /> },
    { depth: 12.75, node: <CoffeeTable key="table" /> },
    { depth: 14.5, node: <Sofa key="sofa" /> },
    { depth: 10.6 + 6.9, node: <Plant key="plant-front" at={{ x: 10.6, y: 6.9 }} size={1.3} leaf="#2f8a4a" /> }
  );

  return (
    <svg
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      className={className}
      role="img"
      aria-label="Isometric office where each AI agent works at its own desk"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${gradId}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfdcff" />
          <stop offset="1" stopColor="#eef6ff" />
        </linearGradient>
        <linearGradient id={`${gradId}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfdbfe" />
          <stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
        <linearGradient id={`${gradId}-sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffbeb" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fffbeb" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${gradId}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfe7f5" />
          <stop offset="1" stopColor="#eef2f8" />
        </linearGradient>
      </defs>
      <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill={`url(#${gradId}-bg)`} />
      <Room gradId={gradId} />
      {drawables.sort((a, b) => a.depth - b.depth).map((item) => item.node)}
    </svg>
  );
}
