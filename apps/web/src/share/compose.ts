import type { Dimension } from "@zoningviz/engine";
import { dimensionLabelAnchor } from "../scene/Animated";
import type { Shot } from "../scene/capture";
import { COLORS } from "../scene/palette";
import { wrapText, type StoryboardCaption, type StoryTile, type ViewCaption } from "./content";

// Lays share images out on a 2D canvas: the scene shot(s), the dimension
// labels the scene draws as HTML, and the caption. Colors are the app's own
// (styles.css and scene/palette.ts); red appears only as the removed-volume swatch.

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const INK: string = COLORS.ink;
const MUTED = "#6d685d";
const LINE = "#e2ded4";
const BACKGROUND = "#f7f6f2";
const PANEL = "#ffffff";
const AMBER = "#a86a00";
const AMBER_BG = "#fff4dc";
const ACCENT = "#2f5d8a";

/** The scene part of a "Save image" picture, in pixels. */
export const VIEW_WIDTH = 1600;
/** Storyboard tiles, in pixels. */
export const TILE_WIDTH = 640;
export const TILE_HEIGHT = 480;
export const STORYBOARD_COLUMNS = 3;
const MARGIN = 48;
const GAP = 20;

/** The dimension lines' labels to draw on a shot: the ones on screen, at their opacity. */
export interface ShotLabels {
  dimensions: Dimension[];
  opacity: number;
}

/** A "Save image" picture: the scene as on screen with the caption band below. */
export function composeView(shot: Shot, labels: ShotLabels, caption: ViewCaption, labelPx: number): HTMLCanvasElement {
  const width = shot.image.width;
  const sceneHeight = shot.image.height;
  const flow = new Flow(MARGIN, width - 2 * MARGIN, sceneHeight + MARGIN * 0.75);
  flow.text(caption.heading, 40, { weight: 700 });
  flow.text(caption.details, 24, { color: MUTED });
  flow.space(10);
  flow.text(caption.step, 30, { weight: 700 });
  const sentence = caption.body.length === 1;
  for (const paragraph of caption.body) flow.text(paragraph, 26, { maxLines: sentence ? 5 : 2, gap: sentence ? 0.35 : 0.1 });
  if (caption.removed) {
    flow.removedLine(`${Math.round(caption.removed.cuFt).toLocaleString("en-US")} cu ft removed · ${caption.removed.percentLeft.toFixed(0)}% of the block left`, 24);
  }
  if (caption.citation) flow.citation(caption.citation, caption.unverified, 22);
  flow.rule();
  for (const line of caption.footer) flow.text(line, 20, { color: MUTED, gap: 0.1 });
  flow.text(caption.link, 20, { color: ACCENT, gap: 0 });

  const canvas = blank(width, Math.ceil(flow.y + MARGIN * 0.75));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, sceneHeight, width, canvas.height - sceneHeight);
  ctx.drawImage(shot.image, 0, 0);
  drawLabels(ctx, shot, labels, labelPx, 0, 0, 1);
  ctx.fillStyle = LINE;
  ctx.fillRect(0, sceneHeight, width, 2);
  flow.draw(ctx);
  return canvas;
}

export interface StoryboardShot {
  tile: StoryTile;
  shot: Shot;
  labels: ShotLabels;
}

/** One picture of the whole sequence: a tile per step that cuts, from the starting block to the result. */
export function composeStoryboard(shots: StoryboardShot[], caption: StoryboardCaption): HTMLCanvasElement {
  const columns = Math.min(STORYBOARD_COLUMNS, shots.length);
  const rows = Math.ceil(shots.length / columns);
  const width = 2 * MARGIN + columns * TILE_WIDTH + (columns - 1) * GAP;
  const tileCaption = 84;

  const header = new Flow(MARGIN, width - 2 * MARGIN, MARGIN);
  header.text(caption.heading, 40, { weight: 700 });
  header.text(caption.details, 24, { color: MUTED });
  header.text("How each rule carves the block, in order", 24, { gap: 0.6 });
  const gridTop = header.y;
  const gridHeight = rows * (TILE_HEIGHT + tileCaption) + (rows - 1) * GAP;

  const footer = new Flow(MARGIN, width - 2 * MARGIN, gridTop + gridHeight + MARGIN * 0.5);
  footer.rule();
  for (const line of caption.footer) footer.text(line, 20, { color: MUTED, gap: 0.1 });
  footer.text(caption.link, 20, { color: ACCENT, gap: 0 });

  const canvas = blank(width, Math.ceil(footer.y + MARGIN * 0.75));
  const ctx = canvas.getContext("2d")!;
  header.draw(ctx);
  shots.forEach(({ tile, shot, labels }, i) => {
    const x = MARGIN + (i % columns) * (TILE_WIDTH + GAP);
    const y = gridTop + Math.floor(i / columns) * (TILE_HEIGHT + tileCaption + GAP);
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, y, TILE_WIDTH, TILE_HEIGHT + tileCaption);
    ctx.drawImage(shot.image, x, y, TILE_WIDTH, TILE_HEIGHT);
    drawLabels(ctx, shot, labels, 14, x, y, TILE_WIDTH / shot.image.width);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE_WIDTH - 2, TILE_HEIGHT + tileCaption - 2);
    const text = new Flow(x + 16, TILE_WIDTH - 32, y + TILE_HEIGHT + 12);
    text.text(tile.title, 24, { weight: 700, maxLines: 1, gap: 0.15 });
    if (tile.removedCuFt !== null) text.removedLine(tile.detail, 20);
    else text.text(tile.detail, 20, { color: MUTED, maxLines: 1 });
    text.draw(ctx);
  });
  footer.draw(ctx);
  return canvas;
}

/** PNG bytes of a composed picture. */
export function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The image couldn't be encoded."))), "image/png"),
  );
}

function blank(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

/** The dimension labels as the scene shows them: white boxes with an ink border, centered on each line's midpoint. */
function drawLabels(ctx: CanvasRenderingContext2D, shot: Shot, labels: ShotLabels, fontPx: number, x0: number, y0: number, scale: number) {
  if (labels.opacity <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = labels.opacity;
  ctx.font = `400 ${fontPx}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const overlaps = (r: (typeof placed)[number]) =>
    placed.some((p) => Math.abs(p.x - r.x) * 2 < p.w + r.w && Math.abs(p.y - r.y) * 2 < p.h + r.h);
  for (const d of labels.dimensions) {
    const at = shot.project(dimensionLabelAnchor(d));
    if (!at) continue;
    const cx = x0 + at[0] * scale;
    const w = ctx.measureText(d.label).width + fontPx * 0.9;
    const h = fontPx * 1.5;
    // Two lines can share a midpoint on screen (a rear yard and its first story); step the later label down.
    let cy = y0 + at[1] * scale;
    for (let tries = 0; tries < 4 && overlaps({ x: cx, y: cy, w, h }); tries++) cy += h + fontPx * 0.3;
    placed.push({ x: cx, y: cy, w, h });
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, fontPx / 12);
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, fontPx / 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillText(d.label, cx, cy);
  }
  ctx.restore();
}

type Op = (ctx: CanvasRenderingContext2D) => void;

interface TextStyle {
  weight?: number;
  color?: string;
  maxLines?: number;
  /** Space after the paragraph, as a fraction of the font size. */
  gap?: number;
}

/** Text laid out top to bottom: measured now, drawn later, so the canvas can be sized to fit. */
class Flow {
  y: number;
  private readonly ops: Op[] = [];
  private readonly measurer = document.createElement("canvas").getContext("2d")!;

  constructor(
    private readonly x: number,
    private readonly width: number,
    top: number,
  ) {
    this.y = top;
  }

  text(text: string, size: number, { weight = 400, color = INK, maxLines = Infinity, gap = 0.35 }: TextStyle = {}) {
    const font = `${weight} ${size}px ${FONT}`;
    this.measurer.font = font;
    const lines = wrapText((t) => this.measurer.measureText(t).width, text, this.width, maxLines);
    for (const line of lines) {
      const y = this.y;
      this.ops.push((ctx) => {
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(line, this.x, y);
      });
      this.y += Math.round(size * 1.3);
    }
    this.y += Math.round(size * gap);
  }

  /** A line about removed volume, after the red swatch the rule cards use. */
  removedLine(text: string, size: number) {
    const y = this.y;
    const swatch = Math.round(size * 0.75);
    this.ops.push((ctx) => {
      ctx.fillStyle = COLORS.removed;
      ctx.fillRect(this.x, y + (size * 1.3 - swatch) / 2, swatch, swatch);
      ctx.font = `400 ${size}px ${FONT}`;
      ctx.fillStyle = INK;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(text, this.x + swatch + size * 0.4, y + size * 0.1);
    });
    this.y += Math.round(size * 1.6);
  }

  /** The rule's citation, with the amber "unverified" tag the cards show. */
  citation(text: string, unverified: boolean, size: number) {
    const font = `400 ${size}px ${FONT}`;
    this.measurer.font = font;
    const tagFont = `600 ${size * 0.9}px ${FONT}`;
    const lines = wrapText((t) => this.measurer.measureText(t).width, text, this.width * 0.8, 2);
    lines.forEach((line, i) => {
      const y = this.y;
      const last = i === lines.length - 1;
      this.ops.push((ctx) => {
        ctx.font = font;
        ctx.fillStyle = ACCENT;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(line, this.x, y);
        if (!last || !unverified) return;
        const left = this.x + ctx.measureText(line).width + size * 0.6;
        ctx.font = tagFont;
        const w = ctx.measureText("unverified").width + size * 0.8;
        ctx.fillStyle = AMBER_BG;
        ctx.strokeStyle = "#f0d49a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(left, y - size * 0.1, w, size * 1.3, size * 0.25);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = AMBER;
        ctx.fillText("unverified", left + size * 0.4, y + size * 0.05);
      });
      this.y += Math.round(size * 1.4);
    });
    this.y += Math.round(size * 0.3);
  }

  /** A thin divider. */
  rule() {
    const y = this.y + 8;
    this.ops.push((ctx) => {
      ctx.fillStyle = LINE;
      ctx.fillRect(this.x, y, this.width, 2);
    });
    this.y += 26;
  }

  space(px: number) {
    this.y += px;
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const op of this.ops) op(ctx);
  }
}
