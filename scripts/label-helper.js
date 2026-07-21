#!/usr/bin/env node
/**
 * label-helper.js — LOCAL LABELING TOOL, NOT A PROJECT DELIVERABLE.
 *
 * Interactively collects one dataset entry at a time (prompt + response +
 * scores + flags), computes promptHash, and appends a correctly-shaped
 * entry to your dataset JSON file.
 *
 * Usage:
 *   node scripts/label-helper.js
 *
 * It will keep asking for entries in a loop until you type "quit" at the
 * platform prompt. Ctrl+C also works to bail out at any point (nothing is
 * lost until you finish an entry — partial entries are discarded).
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { createHash } = require("crypto");

// ---- Configure these two paths for your machine ----
const DATASET_PATH = path.join(
  __dirname,
  "../src/tests/evaluation/datasets/response-analyzer-dataset.json"
);
const PROMPT_REFERENCE_PATH = path.join(
  __dirname,
  "./prompt-reference.local.json" // keep this out of git — see note at bottom
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// Multi-line input: keep reading lines until the user types a lone "%%%"
async function askMultiline(question) {
  console.log(question + "  (type %%% on its own line when done)");
  const lines = [];
  while (true) {
    const line = await ask("");
    if (line.trim() === "%%%") break;
    lines.push(line);
  }
  return lines.join("\n").trim();
}

function hashPrompt(promptText) {
  const normalized = promptText.trim().replace(/\s+/g, " ");
  return "sha256:" + createHash("sha256").update(normalized).digest("hex");
}

function loadJsonOrDefault(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) return defaultValue;
  const raw = fs.readFileSync(filePath, "utf-8");
  return raw.trim() ? JSON.parse(raw) : defaultValue;
}

function saveJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

async function askScore(label) {
  while (true) {
    const raw = await ask(`${label} (0.0 - 1.0): `);
    const val = parseFloat(raw);
    if (!isNaN(val) && val >= 0 && val <= 1) return val;
    console.log("  -> enter a number between 0 and 1");
  }
}

async function askPlatform() {
  while (true) {
    const raw = (await ask('Platform ["chatgpt" | "claude" | "gemini" | "quit"]: '))
      .trim()
      .toLowerCase();
    if (raw === "quit") return null;
    if (["chatgpt", "claude", "gemini"].includes(raw)) return raw;
    console.log("  -> must be chatgpt, claude, gemini, or quit");
  }
}

async function askSplit() {
  while (true) {
    const raw = (await ask('Split ["evaluation" | "holdout"]: ')).trim().toLowerCase();
    if (raw === "evaluation" || raw === "holdout") return raw;
    console.log("  -> must be evaluation or holdout");
  }
}

async function main() {
  const dataset = loadJsonOrDefault(DATASET_PATH, {
    _schemaVersion: "1.0.0",
    entries: [],
  });
  const promptReference = loadJsonOrDefault(PROMPT_REFERENCE_PATH, {});

  console.log(`\nLoaded ${dataset.entries.length} existing entries.`);
  console.log("Enter 'quit' at the platform prompt any time to stop.\n");

  let nextIndex = dataset.entries.length + 1;

  while (true) {
    console.log(`\n--- Entry #${nextIndex} ---`);

    const platform = await askPlatform();
    if (platform === null) break;

    const id = `resp-${String(nextIndex).padStart(3, "0")}`;

    const promptText = await askMultiline("Paste the ORIGINAL PROMPT:");
    const responseText = await askMultiline("Paste the AI RESPONSE:");

    const promptHash = hashPrompt(promptText);

    console.log("\nNow label the response (score BEFORE checking what the real analyzer says):");
    const expectedStructureScore = await askScore("expectedStructureScore");
    const expectedReasoningScore = await askScore("expectedReasoningScore");
    const expectedCompletenessScore = await askScore("expectedCompletenessScore");
    const expectedQualityScore = await askScore("expectedQualityScore");

    const flagsRaw = await ask(
      "expectedFlags, comma-separated (e.g. prose_heavy,unclosed_markdown) or blank: "
    );
    const expectedFlags = flagsRaw
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const split = await askSplit();
    const labelNotes = await ask("labelNotes (optional, one line): ");

    const entry = {
      id,
      platform,
      promptHash,
      responseText,
      expectedStructureScore,
      expectedReasoningScore,
      expectedCompletenessScore,
      expectedQualityScore,
      expectedFlags,
      split,
      labeledBy: "Dhan",
      ...(labelNotes.trim() ? { labelNotes: labelNotes.trim() } : {}),
    };

    dataset.entries.push(entry);
    promptReference[id] = promptText; // local-only, never committed

    saveJson(DATASET_PATH, dataset);
    saveJson(PROMPT_REFERENCE_PATH, promptReference);

    console.log(`Saved ${id}. Dataset now has ${dataset.entries.length} entries.`);
    nextIndex++;
  }

  const evalCount = dataset.entries.filter((e) => e.split === "evaluation").length;
  const holdoutCount = dataset.entries.filter((e) => e.split === "holdout").length;
  const byPlatform = dataset.entries.reduce((acc, e) => {
    acc[e.platform] = (acc[e.platform] || 0) + 1;
    return acc;
  }, {});

  console.log("\n=== Session summary ===");
  console.log(`Total entries: ${dataset.entries.length}`);
  console.log(`Evaluation split: ${evalCount}  |  Holdout split: ${holdoutCount}`);
  console.log("By platform:", byPlatform);
  console.log(`\nDataset written to: ${DATASET_PATH}`);
  console.log(`Prompt reference (local-only) written to: ${PROMPT_REFERENCE_PATH}\n`);

  rl.close();
}

main();