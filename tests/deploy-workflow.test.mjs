import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflowText = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
const packageJsonText = readFileSync(new URL("../package.json", import.meta.url), "utf8");

test("deploy workflow runs Tests (gate) before Build", () => {
  const testsIndex = workflowText.indexOf("- name: Tests (gate)");
  const testCommandIndex = workflowText.indexOf("run: pnpm test", testsIndex);
  const buildIndex = workflowText.indexOf("- name: Build", testsIndex);

  assert.notEqual(testsIndex, -1);
  assert.notEqual(testCommandIndex, -1);
  assert.notEqual(buildIndex, -1);
  assert.ok(testsIndex < buildIndex);
});

test("deploy workflow defines both build_and_deploy and ci_only jobs", () => {
  assert.match(workflowText, /^  build_and_deploy:/m);
  assert.match(workflowText, /^  ci_only:/m);
});

test("ci_only workflow path mentions ca1, feat, and fix branches", () => {
  assert.match(workflowText, /ca1\/\*\*/);
  assert.match(workflowText, /feat\/\*\*/);
  assert.match(workflowText, /fix\/\*\*/);
  assert.match(workflowText, /startsWith\(github\.ref_name, 'ca1\/'\)/);
  assert.match(workflowText, /startsWith\(github\.ref_name, 'feat\/'\)/);
  assert.match(workflowText, /startsWith\(github\.ref_name, 'fix\/'\)/);
});

test("build_and_deploy keeps the Azure deploy step", () => {
  assert.match(workflowText, /- name: Deploy to Azure Static Web Apps/);
});

test("package.json wires the build-number stamp as prebuild", () => {
  assert.match(packageJsonText, /"prebuild": "node scripts\/stamp-build-info\.mjs"/);
});
