import { Canvas } from "@react-three/fiber";

import { Credits } from "./hud/Credits.tsx";
import { Entry } from "./hud/Entry.tsx";
import { Mute } from "./hud/Mute.tsx";
import { Camera } from "./scene/Camera.tsx";
import { Island } from "./scene/Island.tsx";
import { Lots } from "./scene/Lots.tsx";
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
  return (
    <>
      <Canvas
        className="town"
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [34, 19, 34], fov: 42, near: 0.5, far: 500 }}
      >
        <Sky />
        <Island />
        <Lots />
        <Camera />
      </Canvas>
      <Entry projectName={town.state?.projectName ?? null} onEnter={music.start} />
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
