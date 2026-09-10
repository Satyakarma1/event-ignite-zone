import assert from "node:assert/strict";
import { isVitEmail } from "./constants.ts";

assert.equal(isVitEmail("student@vitstudent.ac.in"), true);
assert.equal(isVitEmail("student@VIT.AC.IN"), true);
assert.equal(isVitEmail("student@sub.vit.ac.in"), false);
assert.equal(isVitEmail("student@vit.ac.in@evil.example"), false);
assert.equal(isVitEmail("student@gmail.com"), false);

console.log("VIT email validation smoke test passed");
