import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanChunk } from "../../lib/cleanChunk.js";

describe("cleanChunk", () => {
  it("strips heading markers at start of line", () => {
    assert.equal(cleanChunk("## Your plan"), "Your plan");
    assert.equal(cleanChunk("### Step 1"), "Step 1");
  });

  it("strips bold markers", () => {
    assert.equal(cleanChunk("**Important note**"), "Important note");
    assert.equal(cleanChunk("***bold italic***"), "bold italic");
  });

  it("strips italic markers", () => {
    assert.equal(cleanChunk("*emphasis*"), "emphasis");
    assert.equal(cleanChunk("_underline italic_"), "underline italic");
  });

  it("strips numbered list at start of line", () => {
    assert.equal(cleanChunk("1. Eat well"), "Eat well");
    assert.equal(cleanChunk("2. Sleep more\n3. Exercise"), "Sleep more\nExercise");
  });

  it("strips numbered list mid-line (after space — the key fix)", () => {
    const input = "Here is your plan. 1. Eat well";
    const out = cleanChunk(input);
    assert.ok(!out.includes("1. "), `Expected no "1. " in: ${out}`);
    assert.ok(out.includes("Eat well"), `Expected "Eat well" in: ${out}`);
  });

  it("strips numbered list after tab mid-line", () => {
    const input = "Summary:\t1. First item";
    const out = cleanChunk(input);
    assert.ok(!out.includes("1. "), `Expected no "1. " in: ${out}`);
  });

  it("multi-chunk simulation: sentence boundary then numbered item", () => {
    const chunk1 = "Here is your plan.";
    const chunk2 = " 1. Eat more protein.";
    const combined = cleanChunk(chunk1 + chunk2);
    assert.ok(!combined.includes("1. "), `Leaked "1. " in: ${combined}`);
  });

  it("strips bullet dashes and stars", () => {
    assert.equal(cleanChunk("- item one"), "item one");
    assert.equal(cleanChunk("* item two"), "item two");
  });

  it("strips inline code", () => {
    assert.equal(cleanChunk("`some code`"), "");
    assert.equal(cleanChunk("use `npm install`"), "use ");
  });

  it("strips strikethrough", () => {
    assert.equal(cleanChunk("~~old text~~"), "old text");
  });

  it("replaces em-dashes and en-dashes with space", () => {
    assert.equal(cleanChunk("strong—bold"), "strong bold");
    assert.equal(cleanChunk("en–dash"), "en dash");
  });

  it("leaves plain prose untouched", () => {
    const plain = "You should drink 2 litres of water daily.";
    assert.equal(cleanChunk(plain), plain);
  });
});
