import { Canvas } from "@react-three/fiber";
import { useState } from "react";

import { Billboard } from "./hud/Billboard.tsx";
import { Credits } from "./hud/Credits.tsx";
import { Entry } from "./hud/Entry.tsx";
import { Mute } from "./hud/Mute.tsx";
import { TerminalSign } from "./hud/TerminalSign.tsx";
import { Camera, CAMERA_START } from "./scene/Camera.tsx";
import { Clouds } from "./scene/Clouds.tsx";
import { Crane, CraneStatus } from "./scene/Crane.tsx";
import { Ground } from "./scene/Ground.tsx";
import { HoverLabel, HoverTracker } from "./scene/Hover.tsx";
import { LightsUp } from "./scene/LightsUp.tsx";
import { Links } from "./scene/Links.tsx";
import { SurveyPlot } from "./scene/Lots.tsx";
import { Placements } from "./scene/Placements.tsx";
import { Preview } from "./scene/Preview.tsx";
import { Signs } from "./scene/Signs.tsx";
import { Sky, SkyBackdrop } from "./scene/Sky.tsx";
import { Blocks, Streets } from "./scene/Streets.tsx";
import { Traffic } from "./scene/Traffic.tsx";
import { useMusic } from "./use-music.ts";
import { useTown, type Town } from "./use-town.ts";

function statusLine(town: Town): string | null {
  if (!town.hasToken) return "Open the link printed in your terminal to see your town.";
  // After the report the billboard says the project is ready; nothing to add.
  if (town.state?.phase === "done" && town.state.report) return null;
  if (town.state?.agentStopped) return "The agent stopped. You can close this tab.";
  if (!town.connected) return "Connecting…";
  return null;
}

export function App() {
  const town = useTown();
  const music = useMusic();
  const status = statusLine(town);
  // Until the entry screen is gone, keyboard focus stays on it.
  const [entered, setEntered] = useState(false);
  return (
    <>
      <SkyBackdrop />
      <Canvas
        className="town"
        shadows="percentage"
        dpr={[1, 2]}
        orthographic
        gl={{ alpha: true }}
        camera={{ position: CAMERA_START, zoom: 20, near: 1, far: 300 }}
      >
        <Sky />
        <Clouds />
        <Ground />
        {town.state ? (
          <>
            {/* Streets first: they say when each street is paved, for the cars and links. */}
            <Streets state={town.state} />
            <Blocks state={town.state} />
            <Placements state={town.state} />
            <Links state={town.state} />
            <Traffic state={town.state} />
            <SurveyPlot state={town.state} />
            <Preview state={town.state} />
            <Crane state={town.state} />
            <Signs state={town.state} />
            <LightsUp state={town.state} entered={entered} />
          </>
        ) : null}
        <Camera state={town.state} />
        <HoverTracker />
      </Canvas>
      <HoverLabel />
      {town.state ? (
        <>
          <CraneStatus state={town.state} />
          {/* While disconnected the pill says "Connecting…" and the state may be old. */}
          {town.connected ? <TerminalSign state={town.state} /> : null}
          <Billboard state={town.state} postAnswer={town.postAnswer} takeFocus={entered} />
        </>
      ) : null}
      <Entry
        projectName={town.state?.projectName ?? null}
        onEnter={() => {
          setEntered(true);
          music.start();
        }}
      />
      {status ? (
        <div className="hud-pill" role="status">
          {status}
        </div>
      ) : null}
      <Mute muted={music.muted} onToggle={music.toggleMute} />
      <Credits />
    </>
  );
}
