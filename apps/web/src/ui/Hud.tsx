import type { HudRefs } from "../anim/usePlayer";

/** Running totals over the canvas. The timeline writes the numbers directly, so playback doesn't re-render React. */
export function Hud({ refs }: { refs: HudRefs }) {
  return (
    <div className="hud" aria-label="Running totals" data-testid="hud">
      <span>
        Volume <strong ref={refs.volume} data-testid="hud-volume" />
      </span>
      <span>
        Footprint <strong ref={refs.footprint} />
      </span>
      <span>
        Left <strong ref={refs.percent} data-testid="hud-percent" />
      </span>
    </div>
  );
}
