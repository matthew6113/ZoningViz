import { DEFAULT_FLOOR_TO_FLOOR_FT, type EnvelopeOptions } from "@zoningviz/engine";
import { coverageNote, zoningCoverage } from "@zoningviz/jurisdictions/sf";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MotionMode } from "./anim/schedule";
import { usePlayer, useReducedMotion } from "./anim/usePlayer";
import { useEngine, useEnvelope, useLot } from "./data/hooks";
import type { LoadedLot } from "./data/loadLot";
import { MapScreen } from "./map/MapScreen";
import { Scene, type Handoff } from "./scene/Scene";
import { lastPosition, type OkResult } from "./state/steps";
import { CLOSE_LOT, type MapView, type UrlState } from "./state/url";
import { useUrlState } from "./state/useUrlState";
import { FactCard } from "./ui/FactCard";
import { FrontPrompt } from "./ui/FrontPrompt";
import { HonestyStrip } from "./ui/HonestyStrip";
import { RuleCards } from "./ui/RuleCards";
import { Hud } from "./ui/Hud";
import { PlayerControls } from "./ui/PlayerControls";
import { Summary } from "./ui/Summary";

type SetUrl = (patch: Partial<UrlState>, mode?: "replace" | "push") => void;

/** Lots open over the map, which stays mounted underneath so going back is instant. */
export function App() {
  const [url, setUrl] = useUrlState();
  const reducedMotion = useReducedMotion();
  // A deep link to a lot doesn't load the map until the viewer goes back to it.
  const [mapWanted, setMapWanted] = useState(url.parcel === null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  useEffect(() => {
    if (url.parcel === null) setMapWanted(true);
  }, [url.parcel]);

  const onMove = useCallback((at: MapView) => setUrl({ at }), [setUrl]);
  const openLot = useCallback(
    (parcel: string, from: Handoff | null) => {
      setHandoff(from);
      setUrl({ ...CLOSE_LOT, parcel }, "push");
    },
    [setUrl],
  );
  const backToMap = (center: { lon: number; lat: number } | null) => {
    setHandoff(null);
    // Opened from a link with no map view: show the map around this lot.
    const at = url.at ?? (center ? { ...center, zoom: LOT_ON_MAP_ZOOM } : null);
    setUrl({ ...CLOSE_LOT, at }, "push");
  };

  return (
    <div className="app">
      <div className="app-main">
        {mapWanted && (
          <MapScreen hidden={url.parcel !== null} view={url.at} reducedMotion={reducedMotion} onMove={onMove} onOpen={openLot} />
        )}
        {url.parcel && (
          <div className="lot-layer" key={url.parcel}>
            <LotView url={url} setUrl={setUrl} handoff={handoff} onBack={backToMap} />
          </div>
        )}
      </div>
      <HonestyStrip />
    </div>
  );
}

const LOT_ON_MAP_ZOOM = 17.5;

function LotView({
  url,
  setUrl,
  handoff,
  onBack,
}: {
  url: UrlState;
  setUrl: SetUrl;
  handoff: Handoff | null;
  onBack: (center: { lon: number; lat: number } | null) => void;
}) {
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
    <a className="back-link" href="?" onClick={(e) => (e.preventDefault(), onBack(loaded?.center ?? null))}>
      ← Map
    </a>
  );

  if (lot.status === "loading") return <Loading back={back}>Loading lot {url.parcel}…</Loading>;
  if (lot.status === "error") return <Status>{back}<p className="notice">{lot.message}</p></Status>;
  const value = lot.value;

  if (!value.district) {
    return (
      <Status>
        {back}
        <FactCard facts={value.facts} lot={null} notes={[]} />
        <p className="notice">{coverageNote(zoningCoverage(value.facts.zoningCode))}</p>
      </Status>
    );
  }
  if (engine.status === "error") return <Status>{back}<p className="notice">{engine.message}</p></Status>;
  if (!envelope) return <Loading back={back}>Loading the geometry engine…</Loading>;
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

  return <EnvelopeView key={value.id} lot={value} result={result} url={url} setUrl={setUrl} back={back} handoff={handoff} />;
}

function EnvelopeView({
  lot,
  result,
  url,
  setUrl,
  back,
  handoff,
}: {
  lot: LoadedLot;
  result: OkResult;
  url: UrlState;
  setUrl: SetUrl;
  back: React.ReactNode;
  handoff: Handoff | null;
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
            handoff={handoff}
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

/** While a lot loads, the map (or a plain page) stays in view behind a small card. */
function Loading({ back, children }: { back: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="loading-card card" role="status">
      {back}
      <span>{children}</span>
    </div>
  );
}
