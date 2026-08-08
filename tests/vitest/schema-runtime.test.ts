import { describe, expect, it } from "vitest";
import * as schema from "../../db/schema";

describe("drizzle schema surface", () => {
  it("exports every local operations table", () => {
    expect(Object.keys(schema)).toEqual(expect.arrayContaining([
      "matrixCompassMeta", "accounts", "contents", "financeEntries", "reviews", "experiments", "importBatches",
    ]));
  });
});
