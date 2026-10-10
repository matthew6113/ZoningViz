import { DEFAULT_FLOOR_TO_FLOOR_FT, type EnvelopeOptions } from "@zoningviz/engine";
import { availableDistricts } from "@zoningviz/jurisdictions/sf";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useEngine, useEnvelope, useLot } from "./data/hooks";
import type { LoadedLot } from "./data/loadLot";
import { Scene } from "./scene/Scene";
import { clampPosition, lastPosition, revealedCount, viewAt } from "./state/steps";
import type { UrlState } from "./state/url";
import { useUrlState } from "./state/useUrlState";
import { FactCard } from "./ui/FactCard";
import { FrontPrompt } from "./ui/FrontPrompt";
import { HonestyStrip } from "./ui/HonestyStrip";
import { Landing } from "./ui/Landing";
import { RuleCards } from "./ui/RuleCards";
import { StepControls } from "./ui/StepControls";
import { Summary } from "./ui/Summary";

export function App() {
  const [url, setUrl] = useUrlState();
  return (
    <div className="app">
      {url.parcel ? (
        <LotView key={url.parcel} url={url} setUrl={setUrl} />
      ) : (
        <Landing onOpen={(parcel) => setUrl({ parcel, step: 0, front: null, setback: null }, "push")} />
      )}
      <HonestyStrip />
    </div>
  );
}

function LotView({ url, setUrl }: { url: UrlState; setUrl: (patch: Partial<UrlState>, mode?: "replace" | "push") => void }) {
  const lot = useLot(url.parcel!);
  const engine = useEngine();
  const loaded = lot.status === "ready" ? lot.value : null;

  const options = useMemo(() => envelopeOptions(loaded, url), [loaded, url.front, url.setback]); // eslint-disable-line react-hooks/exhaustive-deps
  const envelope = useEnvelope(engine.status === "ready" ? engine.value : null, loaded, options);
  const setPosition = useCallback((step: number) => setUrl({ step }), [setUrl]);

  useEffect(() => {
    if (loaded) document.title = `${loaded.facts.title} · Zoning envelope`;
  }, [loaded]);

  const back = (
    <a className="back-link" href="?" onClick={(e) => (e.preventDefault(), setUrl({ parcel: null, step: null, front: null, setback: null }, "push"))}>
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
            view={null}
            floors={[]}
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

  const position = clampPosition(url.step, result);
  const last = lastPosition(result);
  const view = viewAt(position, result);
  const label =
    view.kind === "start"
      ? `Start: everything up to ${result.start.heightFt} ft`
      : view.kind === "finale"
        ? "Result"
        : `Rule ${position} of ${result.steps.length}: ${view.step.rule.title}`;
  const setbackRule = value.district.rules.find((r) => r.kind === "front_setback");

  return (
    <Layout
      back={back}
      scrollToTop={view.kind === "finale"}
      scene={
        <Scene
          outline={result.lot.outline}
          neighborLots={result.lot.neighbors}
          originPlanar={result.lot.originPlanar}
          projection={value.input!.projection}
          buildings={value.buildings}
          front={result.lot.front}
          candidates={null}
          view={view}
          floors={result.floors}
          frameHeightFt={result.start.heightFt}
        />
      }
      controls={<StepControls position={position} last={last} label={label} onChange={setPosition} />}
      side={
        <>
          {view.kind === "finale" && <Summary totals={result.totals} floorToFloorFt={DEFAULT_FLOOR_TO_FLOOR_FT} />}
          <FactCard facts={value.facts} lot={result.lot} notes={result.notes} />
          {result.lot.frontCandidates.length > 1 && (
            <p className="muted front-note">
              Front: side {String.fromCharCode(65 + result.lot.front.index)}.{" "}
              <button type="button" className="link" onClick={() => setUrl({ front: null, step: 0 })}>
                Change
              </button>
            </p>
          )}
          {view.kind === "start" && (
            <p className="card intro">
              The pale block is the lot extruded to {result.start.heightFt} ft, twice the mapped height: all the space you
              might imagine using. Press Next to apply each rule in turn.
            </p>
          )}
          <RuleCards
            steps={result.steps}
            revealed={revealedCount(position, result)}
            current={view.kind === "rule" ? position - 1 : null}
            onSetback={(feet) => setbackRule && setUrl({ setback: feet })}
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
  return options;
}

function Layout({
  back,
  scene,
  controls,
  side,
  scrollToTop = false,
}: {
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
    <main className="lot-view">
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
