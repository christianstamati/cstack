import { expect, test } from "vite-plus/test";

import { checkPackSize } from "../scripts/check-pack-size.ts";

test("pack size limit is 3 MB", () => {
  expect(checkPackSize(3 * 1024 * 1024)).toBeNull();
  expect(checkPackSize(3 * 1024 * 1024 + 1)).toMatch(/3 MB/);
});

test("pack size limit can be changed", () => {
  expect(checkPackSize(2048, 1024)).toMatch(/over/);
  expect(checkPackSize(1024, 1024)).toBeNull();
});
