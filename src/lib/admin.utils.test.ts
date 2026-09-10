import assert from "node:assert/strict";
import { profileToForm, suggestionStatusLabel } from "./admin.utils.ts";

const form = profileToForm({
  full_name: "Pratham Gupta",
  reg_number: "25BAI0165",
  programme: "2nd year",
  phone: "9876543210",
  skills: ["React", "Supabase"],
  instagram: "https://instagram.com/pratham",
  linkedin: "https://linkedin.com/in/pratham",
  github: null,
  avatar_url: null,
});

assert.equal(form.full_name, "Pratham Gupta");
assert.equal(form.reg_number, "25BAI0165");
assert.equal(form.skills, "React, Supabase");
assert.equal(suggestionStatusLabel("approved"), "Approved");
assert.equal(suggestionStatusLabel("rejected"), "Rejected");
assert.equal(suggestionStatusLabel("pending"), "Pending");

console.log("Admin data helper smoke test passed");
