import { useState, type RefObject } from "react";
import { withStills } from "../anim/stills";
import type { AnimState } from "../anim/timeline";
import type { Player } from "../anim/usePlayer";
import type { LotFacts } from "../data/loadLot";
import type { SceneCapturer } from "../scene/capture";
import { composeStoryboard, composeView, TILE_HEIGHT, TILE_WIDTH, toPng, VIEW_WIDTH, type ShotLabels } from "../share/compose";
import { fileName, storyboardCaption, viewCaption, type ShareContext, type ShareKind } from "../share/content";
import type { OkResult, ProgramComparison } from "../state/steps";

export interface ShareButtonsProps {
  capturer: RefObject<SceneCapturer | null>;
  player: Player;
  result: OkResult;
  facts: LotFacts;
  /** Set while a local program is switched on, for the result's comparison line. */
  program: ProgramComparison | null;
}

/** "Save image" (this view) and "Storyboard" (every cut, start to result) as PNGs. */
export function ShareButtons({ capturer, player, result, facts, program }: ShareButtonsProps) {
  const [busy, setBusy] = useState<ShareKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const make = async (kind: ShareKind) => {
    const scene = capturer.current;
    if (!scene || busy) return;
    setBusy(kind);
    setError(null);
    try {
      player.pause();
      const position = player.currentPosition();
      const ctx: ShareContext = { facts, result, href: window.location.href, program };
      const { canvas, link } = kind === "view" ? viewPicture(scene, ctx, player.anim, position) : storyboardPicture(scene, ctx, player);
      await deliver(await toPng(canvas), fileName(facts, result, kind, position), facts.title, link);
    } catch (e) {
      setError(`The image couldn't be made: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="share-buttons" role="group" aria-label="Share">
      <button type="button" onClick={() => make("view")} disabled={busy !== null} title="Save this view, with its rule card, as an image">
        {busy === "view" ? "Saving…" : "Save image"}
      </button>
      <button type="button" onClick={() => make("storyboard")} disabled={busy !== null} title="One image of every rule that cuts, from the starting block to the result">
        {busy === "storyboard" ? "Saving…" : "Storyboard"}
      </button>
      {error && (
        <span className="share-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

// Tiles are smaller and squarer than the screen; a slightly wider view keeps the starting block in frame.
const TILE_ZOOM_OUT = 1.3;

// The labels the scene shows now: the current step's dimension lines, at the label opacity (AnimatedDimensions does the same).
function labelsNow(result: OkResult, anim: AnimState): ShotLabels {
  const step = anim.rule >= 0 && anim.finale === 0 ? result.steps[anim.rule] : undefined;
  return { dimensions: step?.dimensions ?? [], opacity: anim.labelOpacity };
}

function viewPicture(scene: SceneCapturer, ctx: ShareContext, anim: AnimState, position: number) {
  const view = scene.viewSize();
  // The picture keeps the on-screen canvas's shape, within reason.
  const aspect = Math.min(Math.max(view.height / Math.max(view.width, 1), 0.4), 1.3);
  const shot = scene.shoot(VIEW_WIDTH, Math.round(VIEW_WIDTH * aspect));
  // Labels at the size they appear on screen, relative to the picture.
  const labelPx = Math.min(Math.max(Math.round((12 * VIEW_WIDTH) / Math.max(view.width, 1)), 16), 28);
  const caption = viewCaption(ctx, position);
  return { canvas: composeView(shot, labelsNow(ctx.result, anim), caption, labelPx), link: caption.link };
}

function storyboardPicture(scene: SceneCapturer, ctx: ShareContext, player: Player) {
  const caption = storyboardCaption(ctx);
  const shots = withStills(
    ctx.result,
    player.mode,
    player.anim,
    caption.tiles.map((t) => t.position),
    () => ({ shot: scene.shoot(TILE_WIDTH, TILE_HEIGHT, { zoomOut: TILE_ZOOM_OUT }), labels: labelsNow(ctx.result, player.anim) }),
  );
  const canvas = composeStoryboard(
    shots.map((s, i) => ({ ...s, tile: caption.tiles[i]! })),
    caption,
  );
  return { canvas, link: caption.link };
}

/** Phones get the share sheet (image and link); everything else downloads the file. */
async function deliver(blob: Blob, name: string, title: string, link: string) {
  const file = new File([blob], name, { type: "image/png" });
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, url: link });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // the viewer closed the sheet
    }
  }
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
