import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { Credits } from "./Credits.tsx";

test("the credits name the music and the logos", () => {
  const html = renderToStaticMarkup(<Credits />);
  expect(html).toContain("Music: &quot;Lofi Hip Hop Loop&quot; by OMF-Games (CC0)");
  expect(html).toContain("Logos: Simple Icons (CC0)");
});
