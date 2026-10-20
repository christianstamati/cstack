import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { Credits } from "./Credits.tsx";
import { SCENE_FALLBACK_NOTE, SceneBoundary } from "./SceneBoundary.tsx";

test("the credits name the music and the logos", () => {
  const html = renderToStaticMarkup(<Credits />);
  expect(html).toContain("Music: &quot;Lofi Hip Hop Loop&quot; by OMF-Games (CC0)");
  expect(html).toContain("Logos: Simple Icons (CC0)");
});

test("a scene error swaps the canvas for a flat backdrop and a note", () => {
  expect(SceneBoundary.getDerivedStateFromError()).toEqual({ failed: true });
  const boundary = new SceneBoundary({ children: <p>scene</p> });
  expect(renderToStaticMarkup(<>{boundary.render()}</>)).toBe("<p>scene</p>");
  boundary.state = { failed: true };
  const html = renderToStaticMarkup(<>{boundary.render()}</>);
  expect(html).toContain('class="scene-fallback"');
  expect(html).toContain(SCENE_FALLBACK_NOTE.replace("'", "&#x27;"));
  expect(SCENE_FALLBACK_NOTE).toBe("The 3D town couldn't load — you can still answer here.");
  expect(html).not.toContain("scene</p>");
});
