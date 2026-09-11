import assert from "node:assert/strict";
import { toCsv } from "./csv.utils.ts";

// RFC 4180 quoting: delimiters, quotes and newlines are wrapped and quotes doubled.
assert.equal(
  toCsv(["name", "note"], [{ name: "Ada", note: 'Uses, "quotes"' }]),
  'name,note\nAda,"Uses, ""quotes"""',
);

// Formula injection (CWE-1236): cells starting with =, +, -, @ (or tab/CR) are
// prefixed with a single quote so spreadsheets treat them as text, not formulas.
assert.equal(toCsv(["v"], [{ v: "=1+2" }]), "v\n'=1+2");
assert.equal(toCsv(["v"], [{ v: "+1" }]), "v\n'+1");
assert.equal(toCsv(["v"], [{ v: "-1+1" }]), "v\n'-1+1");
assert.equal(toCsv(["v"], [{ v: "@SUM(A1)" }]), "v\n'@SUM(A1)");
assert.equal(toCsv(["v"], [{ v: "\tinjected" }]), "v\n'\tinjected");

// A formula trigger that also contains a delimiter is both neutralized and quoted.
assert.equal(toCsv(["v"], [{ v: "=1,2" }]), 'v\n"\'=1,2"');
assert.equal(
  toCsv(["v"], [{ v: '=HYPERLINK("http://evil.example","x")' }]),
  'v\n"\'=HYPERLINK(""http://evil.example"",""x"")"',
);

// Ordinary values are untouched.
assert.equal(toCsv(["v"], [{ v: "Ada Lovelace" }]), "v\nAda Lovelace");
assert.equal(toCsv(["v"], [{ v: null }]), "v\n");

console.log("CSV escaping + formula-injection smoke test passed");
