import assert from "node:assert/strict";
import { toCsv } from "./exports.functions";

assert.equal(
  toCsv(["name", "note"], [{ name: "Ada", note: 'Uses, "quotes"' }]),
  'name,note\nAda,"Uses, ""quotes"""',
);

console.log("CSV escaping smoke test passed");
