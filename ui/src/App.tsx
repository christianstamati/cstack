import { Canvas } from "@react-three/fiber";
import { useState } from "react";

import { Billboard } from "./hud/Billboard.tsx";
import { Credits } from "./hud/Credits.tsx";
import { Entry } from "./hud/Entry.tsx";
import { Mute } from "./hud/Mute.tsx";
import { TerminalSign } from "./hud/TerminalSign.tsx";
import { Camera } from "./scene/Camera.tsx";
import { Crane, CraneStatus } from "./scene/Crane.tsx";
import { HoverLabel, HoverTracker } from "./scene/Hover.tsx";
import { Island } from "./scene/Island.tsx";
import { Links } from "./scene/Links.tsx";
import { Lots } from "./scene/Lots.tsx";
import { Placements } from "./scene/Placements.tsx";
import { Preview } from "./scene/Preview.tsx";
import { Sky } from "./scene/Sky.tsx";
import { useMusic } from "./use-music.ts";
import { useTown, type Town } from "./use-town.ts";

function statusLine(town: Town): string | null {
  if (!town.hasToken) return "Open the link printed in your terminal to see your town.";
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
      <Canvas
        className="town"
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [26, 15.5, 26], fov: 42, near: 0.5, far: 500 }}
      >
        <Sky />
        <Island />
        <Lots />
        {town.state ? (
          <>
            <Placements state={town.state} />
            <Links state={town.state} />
            <Preview state={town.state} />
            <Crane state={town.state} />
          </>
        ) : null}
        <Camera />
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
