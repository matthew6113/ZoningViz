import { DEFAULT_FLOOR_TO_FLOOR_FT, type EnvelopeOptions } from "@zoningviz/engine";
import { availableDistricts } from "@zoningviz/jurisdictions/sf";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MotionMode } from "./anim/schedule";
import { usePlayer } from "./anim/usePlayer";
import { useEngine, useEnvelope, useLot } from "./data/hooks";
import type { LoadedLot } from "./data/loadLot";
import { Scene } from "./scene/Scene";
import { lastPosition, type OkResult } from "./state/steps";
import type { UrlState } from "./state/url";
import { useUrlState } from "./state/useUrlState";
import { FactCard } from "./ui/FactCard";
import { FrontPrompt } from "./ui/FrontPrompt";
import { HonestyStrip } from "./ui/HonestyStrip";
import { Landing } from "./ui/Landing";
import { RuleCards } from "./ui/RuleCards";
import { Hud } from "./ui/Hud";
import { PlayerControls } from "./ui/PlayerControls";
import { Summary } from "./ui/Summary";

export function App() {
  const [url, setUrl] = useUrlState();
  return (
    <div className="app">
      {url.parcel ? (
        <LotView key={url.parcel} url={url} setUrl={setUrl} />
      ) : (
        <Landing onOpen={(parcel) => setUrl({ parcel, step: null, front: null, setback: null, off: [] }, "push")} />
      )}
      <HonestyStrip />
    </div>
  );
}

function LotView({ url, setUrl }: { url: UrlState; setUrl: (patch: Partial<UrlState>, mode?: "replace" | "push") => void }) {
  const lot = useLot(url.parcel!);
  const engine = useEngine();
  const loaded = lot.status === "ready" ? lot.value : null;

  const offKey = url.off.join(",");
  const options = useMemo(() => envelopeOptions(loaded, url), [loaded, url.front, url.setback, offKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const envelope = useEnvelope(engine.status === "ready" ? engine.value : null, loaded, options);

  useEffect(() => {
    if (loaded) document.title = `${loaded.facts.title} · Zoning envelope`;
  }, [loaded]);

  const back = (
    <a className="back-link" href="?" onClick={(e) => (e.preventDefault(), setUrl({ parcel: null, step: null, front: null, setback: null, off: [] }, "push"))}>
      ← Choose another lot
    </a>
  );

  if (lot.status === "loading") return <Status>{back}Loading parcel {url.parcel}…</Status>;
  if (lot.status === "error") return <Status>{back}<p className="notice">{lot.message}</p></Status>;
  const value = lot.value;

  if (!value.district) {
    return (
      <Status>
        {back}
        <FactCard facts={value.facts} lot={null} notes={[]} />
        <p className="notice">
          This lot is zoned {value.facts.zoningCode ?? "unknown"}. Rule files exist for {availableDistricts().join(", ")} only
          so far, so its envelope isn't shown.
        </p>
      </Status>
    );
  }
  if (engine.status === "error") return <Status>{back}<p className="notice">{engine.message}</p></Status>;
  if (!envelope) return <Status>{back}Loading the geometry engine…</Status>;
  if (envelope.status === "error") return <Status>{back}<p className="notice">{envelope.message}</p></Status>;
  const result = envelope.value;

  if (result.status === "needs_front_choice") {
    return (
      <Layout
        back={back}
        scene={
          <Scene
            outline={result.outline}
            neighborLots={result.neighbors}
            originPlanar={result.originPlanar}
            projection={value.input!.projection}
            buildings={value.buildings}
            front={null}
            candidates={result.candidates}
            result={null}
            anim={null}
            frameHeightFt={40}
          />
        }
        side={
          <>
            <FactCard facts={value.facts} lot={null} notes={[]} />
            <FrontPrompt candidates={result.candidates} onChoose={(front) => setUrl({ front, step: 0 })} />
          </>
        }
      />
    );
  }

  return <EnvelopeView key={value.id} lot={value} result={result} url={url} setUrl={setUrl} back={back} />;
}

function EnvelopeView({
  lot,
  result,
  url,
  setUrl,
  back,
}: {
  lot: LoadedLot;
  result: OkResult;
  url: UrlState;
  setUrl: (patch: Partial<UrlState>, mode?: "replace" | "push") => void;
  back: React.ReactNode;
}) {
  const onPosition = useCallback((step: number) => setUrl({ step }), [setUrl]);
  const player = usePlayer(result, url.step, onPosition);
  const { position } = player;
  const last = lastPosition(result);
  const current = position >= 1 && position <= result.steps.length ? result.steps[position - 1]! : null;
  const label =
    position === 0
      ? `Start: everything up to ${result.start.heightFt} ft`
      : position === last
        ? "Result"
        : `Rule ${position} of ${result.steps.length}: ${current!.rule.title}`;
  const setbackRule = lot.district!.rules.find((r) => r.kind === "front_setback");
  const toggle = (ruleId: string) =>
    setUrl({ off: url.off.includes(ruleId) ? url.off.filter((id) => id !== ruleId) : [...url.off, ruleId] });

  return (
    <Layout
      back={back}
      motion={player.mode}
      scrollToTop={position === last}
      scene={
        <>
          <Scene
            outline={result.lot.outline}
            neighborLots={result.lot.neighbors}
            originPlanar={result.lot.originPlanar}
            projection={lot.input!.projection}
            buildings={lot.buildings}
            front={result.lot.front}
            candidates={null}
            result={result}
            anim={player.anim}
            frameHeightFt={result.start.heightFt}
          />
          <Hud refs={player.hud} />
        </>
      }
      controls={<PlayerControls player={player} label={label} steps={result.steps} />}
      side={
        <>
          {position === last && <Summary totals={result.totals} floorToFloorFt={DEFAULT_FLOOR_TO_FLOOR_FT} />}
          <FactCard facts={lot.facts} lot={result.lot} notes={result.notes} />
          {result.lot.frontCandidates.length > 1 && (
            <p className="muted front-note">
              Front: side {String.fromCharCode(65 + result.lot.front.index)}.{" "}
              <button type="button" className="link" onClick={() => setUrl({ front: null, step: 0 })}>
                Change
              </button>
            </p>
          )}
          {position === 0 && (
            <p className="card intro">
              The pale block is the lot extruded to {result.start.heightFt} ft, twice the mapped height: all the space you
              might imagine using. Press Play to watch each rule carve it, or Next to go one rule at a time.
            </p>
          )}
          <RuleCards
            steps={result.steps}
            current={current ? position - 1 : null}
            onSetback={(feet) => setbackRule && setUrl({ setback: feet })}
            off={url.off}
            onToggle={toggle}
            registerCard={player.registerCard}
          />
        </>
      }
    />
  );
}

function envelopeOptions(lot: LoadedLot | null, url: UrlState): EnvelopeOptions {
  const options: EnvelopeOptions = {};
  if (url.front !== null) options.frontSide = url.front;
  const setbackRule = lot?.district?.rules.find((r) => r.kind === "front_setback");
  const setback = url.setback ?? lot?.defaultSetbackFt ?? null;
  if (setbackRule && setback !== null) options.overrides = { [setbackRule.id]: { feet: setback } };
  if (url.off.length) options.disabledRuleIds = url.off;
  return options;
}

function Layout({
  back,
  scene,
  controls,
  side,
  scrollToTop = false,
  motion,
}: {
  motion?: MotionMode;
  back: React.ReactNode;
  scene: React.ReactNode;
  controls?: React.ReactNode;
  side: React.ReactNode;
  /** Bring the top of the side panel (the result summary) into view. */
  scrollToTop?: boolean;
}) {
  const sideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (scrollToTop) sideRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [scrollToTop]);
  return (
    <main className="lot-view" data-motion={motion}>
      <div className="stage">
        <div className="stage-top">{back}</div>
        <div className="scene-wrap">{scene}</div>
        {controls}
      </div>
      <aside className="side" ref={sideRef}>
        {side}
      </aside>
    </main>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return <main className="status">{children}</main>;
}
