// Scene colors. Red is reserved for removed volume and must not be used for
// anything else (CLAUDE.md); the matching CSS token is --removed.
export const COLORS = {
  envelope: "#c9c1ad",
  envelopeEdge: "#6f6857",
  start: "#e4ded0",
  removed: "#d4402f",
  removedEdge: "#8f2417",
  floor: "#a99f87",
  ground: "#eeece6",
  lotLine: "#3f3b33",
  neighborLotLine: "#b9b4a8",
  building: "#c4c4c4",
  buildingEdge: "#9a9a9a",
  front: "#2f5d8a",
  candidate: ["#2f5d8a", "#b07a12", "#4f7d3a", "#6b4c9a"],
  ink: "#2b2924",
} as const;
