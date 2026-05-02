import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

import garments from "../data/garments.json" with { type: "json" };
import { createJob, transitionJob } from "../lib/garment-pipeline.ts";
import { stubAdapter } from "../lib/garment-pipeline-stub-adapter.mjs";
import { trellisAdapter } from "../lib/garment-pipeline-trellis-adapter.mjs";

const USAGE =
  "Usage: node scripts/generate-garment-mesh.mjs --garment <id> --image <url-or-path> [--adapter stub|trellis]";

const repoRoot = resolve(process.env.VF9_ROOT_DIR ?? process.cwd());
const args = parseArgs(process.argv.slice(2));

if (!args.garment || !args.image) {
  console.error(USAGE);
  process.exit(1);
}

const garment = garments.find((entry) => entry.id === args.garment);

if (!garment) {
  console.error(`[VF-9] unknown garmentId: ${args.garment}`);
  process.exit(1);
}

const adapters = new Map([
  [stubAdapter.name, stubAdapter],
  [trellisAdapter.name, trellisAdapter]
]);

const adapter = adapters.get(args.adapter);

if (!adapter) {
  console.error(`[VF-9] unknown adapter: ${args.adapter}`);
  process.exit(1);
}

const outputAbsPath = resolve(repoRoot, "public", "garments", `${garment.id}.glb`);
const manifestPath = resolve(repoRoot, "data", "garment-pipeline-jobs.json");

let job = createJob({
  garmentId: garment.id,
  sourceImageUrl: args.image,
  adapter: adapter.name
});

job = transitionJob(job, "running");

try {
  const result = await adapter.generate({
    garmentId: garment.id,
    sourceImageUrl: args.image,
    outputAbsPath
  });

  job = transitionJob(job, "succeeded", {
    outputAssetUrl: result.outputAssetUrl
  });

  await appendManifestEntry(manifestPath, job);
  console.log(`[VF-9] generated stub mesh for ${garment.id} at ${outputAbsPath}`);
  process.exit(0);
} catch (error) {
  job = transitionJob(job, "failed", {
    error: error instanceof Error ? error.message : String(error)
  });

  await appendManifestEntry(manifestPath, job);
  console.error(`[VF-9] failed to generate mesh for ${garment.id}: ${job.error}`);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {
    garment: "",
    image: "",
    adapter: "stub"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (token === "--garment") {
      parsed.garment = value ?? "";
      index += 1;
      continue;
    }

    if (token === "--image") {
      parsed.image = value ?? "";
      index += 1;
      continue;
    }

    if (token === "--adapter") {
      parsed.adapter = value ?? "";
      index += 1;
    }
  }

  return parsed;
}

async function appendManifestEntry(manifestPath, job) {
  await mkdir(dirname(manifestPath), { recursive: true });

  let jobs = [];

  try {
    const existing = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(existing);
    jobs = Array.isArray(parsed) ? parsed : [];
  } catch {
    jobs = [];
  }

  jobs.push(job);
  await writeFile(manifestPath, `${JSON.stringify(jobs, null, 2)}\n`, "utf8");
}
