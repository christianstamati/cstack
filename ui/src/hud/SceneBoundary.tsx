// Catches any error in the 3D scene (a WebGL context that won't start, a model that
// throws) and puts a flat backdrop with a note in its place. Only the canvas goes inside
// it: the billboard, the signs and the rest of the HUD stay up, so answering always works.
import { Component, type ReactNode } from "react";

export const SCENE_FALLBACK_NOTE = "The 3D town couldn't load — you can still answer here.";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class SceneBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.error("The 3D town failed:", error);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="scene-fallback">
        <p className="scene-fallback-note" role="status">
          {SCENE_FALLBACK_NOTE}
        </p>
      </div>
    );
  }
}
