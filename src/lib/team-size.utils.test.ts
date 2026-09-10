import assert from "node:assert/strict";
import { formatTeamSizeRange, teamSizeLimitError, teamSizeRangeError } from "./team-size.utils.ts";

assert.equal(teamSizeRangeError(null, null), null);
assert.equal(teamSizeRangeError(2, 5), null);
assert.equal(teamSizeRangeError(0, 5), "Team size must be between 1 and 10.");
assert.equal(teamSizeRangeError(5, 2), "Minimum team size cannot exceed maximum team size.");
assert.equal(
  teamSizeLimitError(1, 2, 5),
  "Teams for this hackathon must allow at least 2 members.",
);
assert.equal(teamSizeLimitError(6, 2, 5), "Teams for this hackathon can have at most 5 members.");
assert.equal(teamSizeLimitError(4, 2, 5), null);
assert.equal(formatTeamSizeRange(2, 5), "Teams: 2–5 members");
assert.equal(formatTeamSizeRange(4, 4), "Teams: 4 members");

console.log("Team size range smoke test passed");
