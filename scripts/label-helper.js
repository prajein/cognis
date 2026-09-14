#!/usr/bin/env node
/**
 * label-helper.js — LOCAL LABELING TOOL, NOT A PROJECT DELIVERABLE. (v2, schema 2.0.0)
 *
 * Interactively collects one dataset entry at a time, AUTO-COMPUTES
 * responseMetadata from the pasted response text (never hand-typed --
 * derived facts shouldn't be manually entered, only judgment should be),
 * and appends a correctly-shaped entry to your dataset JSON file.
 *
 * Usage:
 *   node scripts/label-helper.js
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { createHash } = require("crypto");

const DATASET_PATH = path.join(
  __dirname,
  "../src/tests/evaluation/datasets/response-analyzer-dataset.json"
);
const PROMPT_REFERENCE_PATH = path.join(__dirname, "./prompt-reference.local.json");

const LABELED_BY = "annotator-1"; 

const PLATFORMS = ["chatgpt", "claude", "gemini"];
const PROMPT_CATEGORIES = [
  "factual",
  "reasoning",
  "coding",
  "long_form",
  "ambiguous",
  "adversarial_verbose",
  "other",
];
const VERDICTS = ["excellent", "good", "average", "poor", "failing"];
const SPLITS = ["evaluation", "holdout"];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

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

async function askFromEnum(question, options) {
  while (true) {
    const raw = (await ask(`${question} [${options.join(" | ")} | quit]: `)).trim().toLowerCase();
    if (raw === "quit") return null;
    if (options.includes(raw)) return raw;
    console.log(`  -> must be one of: ${options.join(", ")}`);
  }
}

async function askScore(label) {
  while (true) {
    const raw = await ask(`${label} (0.0 - 1.0): `);
    const val = parseFloat(raw);
    if (!isNaN(val) && val >= 0 && val <= 1) return val;
    console.log("  -> enter a number between 0 and 1");
  }
}

function hashPrompt(promptText) {
  const normalized = promptText.trim().replace(/\s+/g, " ");
  return "sha256:" + createHash("sha256").update(normalized).digest("hex");
}


function computeResponseMetadata(responseText) {
  const wordCount = responseText.trim().split(/\s+/).filter(Boolean).length;

  const containsCode =
    /```/.test(responseText) || /`[^`\n]+`/.test(responseText);

  const containsMarkdown =
    /^#{1,6}\s/m.test(responseText) || // headers
    /\*\*[^*]+\*\*/.test(responseText) || // bold
    /^\s*[-*]\s/m.test(responseText) || // bullet lists
    /\[[^\]]+\]\([^)]+\)/.test(responseText); // links

  const language = "en";

  return { wordCount, containsCode, containsMarkdown, language };
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

async function main() {
  const dataset = loadJsonOrDefault(DATASET_PATH, {
    _schemaVersion: "2.0.0",
    entries: [],
  });
  const promptReference = loadJsonOrDefault(PROMPT_REFERENCE_PATH, {});

  console.log(`\nLoaded ${dataset.entries.length} existing entries. Type 'quit' at platform prompt to stop.\n`);

  let nextIndex = dataset.entries.length + 1;

  while (true) {
    console.log(`\n--- Entry #${nextIndex} ---`);

    const platform = await askFromEnum("Platform", PLATFORMS);
    if (platform === null) break;

    const promptCategory = await askFromEnum("Prompt category", PROMPT_CATEGORIES);
    if (promptCategory === null) break;

    const id = `resp-${String(nextIndex).padStart(3, "0")}`;

    const promptText = await askMultiline("Paste the ORIGINAL PROMPT:");
    const responseText = await askMultiline("Paste the AI RESPONSE:");

    const promptHash = hashPrompt(promptText);
    const responseMetadata = computeResponseMetadata(responseText);

    console.log("\nAuto-computed responseMetadata:", responseMetadata);
    const languageOverride = await ask('Language override (blank to keep "en"): ');
    if (languageOverride.trim()) responseMetadata.language = languageOverride.trim();

    console.log("\nNow label the response (score BEFORE checking what the real analyzer says):");
    const labels = {
      structure: await askScore("labels.structure"),
      reasoning: await askScore("labels.reasoning"),
      completeness: await askScore("labels.completeness"),
      quality: await askScore("labels.quality"),
    };

    // const scoreRationale = {
    //   structure: await ask("scoreRationale.structure (one line): "),
    //   reasoning: await ask("scoreRationale.reasoning (one line): "),
    //   completeness: await ask("scoreRationale.completeness (one line): "),
    //   quality: await ask("scoreRationale.quality (one line): "),
    // };

    // future application as a multi-annotator dataset, where we want to capture the rationale for each score. For now, we just capture the scores themselves.
    
    const issuesRaw = await ask(
      "observedIssues, comma-separated (e.g. verbosity,unclosed_markdown) or blank: "
    );
    const observedIssues = issuesRaw
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const overallVerdict = await askFromEnum("Overall verdict", VERDICTS);
    if (overallVerdict === null) break;

    //const labelConfidence = await askScore("labelConfidence"); 
    //can be used in future where there's more than one annotator and we want to track confidence in the label.

    const split = await askFromEnum("Split", SPLITS);
    if (split === null) break;

    const labelNotes = await ask("labelNotes (optional, one line): ");

    const entry = {
      id,
      platform,
      promptCategory,
      promptHash,
      responseText,
      responseMetadata,
      labels,
      observedIssues,
      overallVerdict,
      //labelConfidence,
      //scoreRationale,
      split,
      labeledBy: LABELED_BY,
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
  const byCategory = dataset.entries.reduce((acc, e) => {
    acc[e.promptCategory] = (acc[e.promptCategory] || 0) + 1;
    return acc;
  }, {});

  console.log("\n=== Session summary ===");
  console.log(`Total entries: ${dataset.entries.length}`);
  console.log(`Evaluation split: ${evalCount}  |  Holdout split: ${holdoutCount}`);
  console.log("By platform:", byPlatform);
  console.log("By promptCategory:", byCategory);
  console.log(`\nDataset written to: ${DATASET_PATH}`);
  console.log(`Prompt reference (local-only) written to: ${PROMPT_REFERENCE_PATH}\n`);

  rl.close();
}

main();