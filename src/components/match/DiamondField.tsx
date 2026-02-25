import {
  Card,
  CardContent,
} from "@/components/ui/8bit/card";
import {
  FIELD_POSITIONS,
  OUT_TYPES,
  HIT_TYPES,
  TEXT_MARKERS,
  HIT_COLORS,
} from "./constants";

interface DiamondFieldProps {
  bases: [boolean, boolean, boolean];
  fieldMarker: { x: number; y: number; type: string } | null;
}

export function DiamondField({ bases, fieldMarker }: DiamondFieldProps) {
  return (
    <Card className="flex-[2] min-h-0 overflow-hidden flex flex-col">
      <CardContent className="flex-1 min-h-0 pt-2 pb-1 px-2 flex items-center justify-center">
        <svg
          className="w-full h-full"
          viewBox="-25 -15 290 235"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/*
            Proportional baseball field:
            Home (120,200). Diamond half-diag=57 → bases at ±57.
            Fence r=200 from home → peaks at y=0, foul poles at (-21,59)/(261,59).
          */}

          {/* Outfield grass — sector from home to foul poles */}
          <path
            d="M 120 200 L -21 59 A 200 200 0 0 1 261 59 Z"
            className="fill-green-900/10 dark:fill-green-600/8"
          />

          {/* Outfield fence arc — r=200, peaks at y=0 (center field) */}
          <path
            d="M -21 59 A 200 200 0 0 1 261 59"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="6,4"
            className="stroke-muted-foreground/30"
          />

          {/* Foul lines — home plate to foul poles */}
          <line
            x1="120"
            y1="200"
            x2="-21"
            y2="59"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4,4"
            className="stroke-muted-foreground/40"
          />
          <line
            x1="120"
            y1="200"
            x2="261"
            y2="59"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4,4"
            className="stroke-muted-foreground/40"
          />
          {/* Foul lines — short stubs behind home */}
          <line
            x1="120"
            y1="200"
            x2="110"
            y2="210"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4,4"
            className="stroke-muted-foreground/40"
          />
          <line
            x1="120"
            y1="200"
            x2="130"
            y2="210"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4,4"
            className="stroke-muted-foreground/40"
          />

          {/* Infield dirt — arc r≈70 from mound area */}
          <path
            d="M 120 200 L 56 136 A 70 70 0 0 1 184 136 Z"
            className="fill-yellow-900/20 dark:fill-yellow-600/15"
          />
          {/* Grass line arc */}
          <path
            d="M 56 136 A 70 70 0 0 1 184 136"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="stroke-muted-foreground/20"
          />

          {/* Basepaths — diamond half-diag=57 */}
          <line
            x1="120"
            y1="200"
            x2="63"
            y2="143"
            stroke="currentColor"
            strokeWidth="2"
            className="stroke-foreground/60"
          />
          <line
            x1="63"
            y1="143"
            x2="120"
            y2="86"
            stroke="currentColor"
            strokeWidth="2"
            className="stroke-foreground/60"
          />
          <line
            x1="120"
            y1="86"
            x2="177"
            y2="143"
            stroke="currentColor"
            strokeWidth="2"
            className="stroke-foreground/60"
          />
          <line
            x1="177"
            y1="143"
            x2="120"
            y2="200"
            stroke="currentColor"
            strokeWidth="2"
            className="stroke-foreground/60"
          />

          {/* Pitcher's mound — 47% of way from home to 2B */}
          <circle
            cx="120"
            cy="147"
            r="6"
            className="fill-yellow-800/30 dark:fill-yellow-600/25 stroke-border"
            stroke="currentColor"
            strokeWidth="1"
          />
          <circle
            cx="120"
            cy="147"
            r="2.5"
            className="fill-background stroke-border"
            stroke="currentColor"
            strokeWidth="1"
          />

          {/* Home plate */}
          <polygon
            points="120,205 115,200 115,197 125,197 125,200"
            className="fill-card stroke-muted-foreground"
            strokeWidth="1.5"
          />

          {/* 2nd Base */}
          <polygon
            points="120,80 126,86 120,92 114,86"
            fill={bases[1] ? "#3b82f6" : "currentColor"}
            className={bases[1] ? "animate-pulse" : "fill-card"}
            stroke={bases[1] ? "#2563eb" : "currentColor"}
            strokeWidth="1.5"
            opacity={bases[1] ? 1 : 0.5}
          />
          {/* 3rd Base */}
          <polygon
            points="63,137 69,143 63,149 57,143"
            fill={bases[2] ? "#3b82f6" : "currentColor"}
            className={bases[2] ? "animate-pulse" : "fill-card"}
            stroke={bases[2] ? "#2563eb" : "currentColor"}
            strokeWidth="1.5"
            opacity={bases[2] ? 1 : 0.5}
          />
          {/* 1st Base */}
          <polygon
            points="177,137 183,143 177,149 171,143"
            fill={bases[0] ? "#3b82f6" : "currentColor"}
            className={bases[0] ? "animate-pulse" : "fill-card"}
            stroke={bases[0] ? "#2563eb" : "currentColor"}
            strokeWidth="1.5"
            opacity={bases[0] ? 1 : 0.5}
          />

          {/* Base labels */}
          <text
            x="120"
            y="74"
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="10"
            fontWeight="bold"
          >
            2B
          </text>
          <text
            x="47"
            y="147"
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="10"
            fontWeight="bold"
          >
            3B
          </text>
          <text
            x="193"
            y="147"
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="10"
            fontWeight="bold"
          >
            1B
          </text>
          <text
            x="120"
            y="218"
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="10"
            fontWeight="bold"
          >
            H
          </text>

          {/* Field marker — red X for outs, starburst for hits */}
          {fieldMarker && OUT_TYPES.has(fieldMarker.type) && (
            <g>
              <line
                x1={fieldMarker.x - 8}
                y1={fieldMarker.y - 8}
                x2={fieldMarker.x + 8}
                y2={fieldMarker.y + 8}
                stroke="#ef4444"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.85"
              />
              <line
                x1={fieldMarker.x + 8}
                y1={fieldMarker.y - 8}
                x2={fieldMarker.x - 8}
                y2={fieldMarker.y + 8}
                stroke="#ef4444"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.85"
              />
            </g>
          )}
          {/* Text marker — K for strikeout, BB for walk */}
          {fieldMarker &&
            TEXT_MARKERS[fieldMarker.type] &&
            (() => {
              const marker = TEXT_MARKERS[fieldMarker.type];
              return (
                <text
                  x={fieldMarker.x}
                  y={fieldMarker.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="42"
                  fontWeight="900"
                  fill={marker.color}
                  opacity="0.85"
                  className="animate-pulse"
                  style={{ fontFamily: "monospace" }}
                >
                  {marker.text}
                </text>
              );
            })()}
          {fieldMarker &&
            HIT_TYPES.has(fieldMarker.type) &&
            (() => {
              const c = HIT_COLORS[fieldMarker.type] || "#4ade80";
              const { x, y } = fieldMarker;
              const isHR = fieldMarker.type === "homerun";
              return (
                <g>
                  <circle
                    cx={x}
                    cy={y}
                    r={isHR ? 5 : 3.5}
                    fill={c}
                    opacity="0.9"
                  />
                  {[
                    [-1, -1],
                    [1, -1],
                    [-1, 1],
                    [1, 1],
                  ].map(([dx, dy], i) => (
                    <line
                      key={i}
                      x1={x + dx! * (isHR ? 6 : 5)}
                      y1={y + dy! * (isHR ? 6 : 5)}
                      x2={x + dx! * (isHR ? 10 : 9)}
                      y2={y + dy! * (isHR ? 10 : 9)}
                      stroke={c}
                      strokeWidth="2"
                      strokeLinecap="round"
                      opacity="0.7"
                    />
                  ))}
                  {isHR && (
                    <circle
                      cx={x}
                      cy={y}
                      r="13"
                      fill="none"
                      stroke={c}
                      strokeWidth="1.5"
                      opacity="0.4"
                    />
                  )}
                </g>
              );
            })()}
        </svg>
      </CardContent>
    </Card>
  );
}
