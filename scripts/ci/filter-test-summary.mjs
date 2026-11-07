#!/usr/bin/env node
// Daily Filter Tests — run summary built from what the suites actually
// reported (Playwright's JSON reporter), never from job conclusions: until
// Nov 2026 every test step ran with continue-on-error, so the jobs were green
// and the summary said « Pass » over 16 failed tests.
//
// Usage: node scripts/ci/filter-test-summary.mjs <dir>
//   <dir> holds one downloaded artifact folder per suite:
//   filter-results-<suite>/results.json
// Env: API_JOB / E2E_JOB = needs.<job>.result, to tell a suite that was out
//   of scope (workflow_dispatch « api-only » / « e2e-only ») from one that
//   crashed before writing its report.
// Exit code 1 when any suite failed, errored, or left no report.

import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const SUITES = [
  { key: "api", label: "API", job: process.env.API_JOB },
  { key: "films", label: "Films", job: process.env.E2E_JOB },
  { key: "series", label: "Séries", job: process.env.E2E_JOB },
  { key: "jeux", label: "Jeux", job: process.env.E2E_JOB },
]
const INFRA = "[infra]"

const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*m/g, "")
const firstLine = (text) => stripAnsi(text ?? "").trim().split("\n")[0].slice(0, 220)
const escapeCell = (text) => text.replace(/\|/g, "\\|")

function collectTests(suite, path, out) {
  const here = suite.title && !suite.title.endsWith(".ts") ? [...path, suite.title] : path
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      out.push({ title: [...here, spec.title].join(" › "), status: test.status, results: test.results ?? [] })
    }
  }
  for (const child of suite.suites ?? []) collectTests(child, here, out)
  return out
}

function lastError(test) {
  const last = test.results.at(-1)
  return firstLine(last?.error?.message ?? last?.errors?.[0]?.message ?? `ended ${last?.status ?? "without a result"}`)
}

function summarize(report) {
  const tests = (report.suites ?? []).flatMap((suite) => collectTests(suite, [], []))
  const byStatus = (status) => tests.filter((t) => t.status === status)
  const failed = byStatus("unexpected").map((t) => ({ title: t.title, error: lastError(t) }))
  return {
    passed: byStatus("expected").length,
    failed,
    infra: failed.filter((f) => f.error.includes(INFRA)).length,
    flaky: byStatus("flaky").map((t) => ({ title: t.title, error: firstLine(t.results.find((r) => r.status !== "passed")?.error?.message) })),
    skipped: byStatus("skipped").length,
    retries: tests.reduce((sum, t) => sum + Math.max(0, t.results.length - 1), 0),
    // Errors outside any test: a spec that failed to load, a broken config…
    errors: (report.errors ?? []).map((e) => firstLine(e.message)),
    total: tests.length,
  }
}

const dir = process.argv[2] ?? "filter-results"
const rows = []
const details = []
const annotations = []
let failing = false

for (const suite of SUITES) {
  if (suite.job === "skipped") {
    rows.push(`| ${suite.label} | – | – | – | – | – | not in scope |`)
    continue
  }
  const file = join(dir, `filter-results-${suite.key}`, "results.json")
  if (!existsSync(file)) {
    failing = true
    rows.push(`| ${suite.label} | – | – | – | – | – | **FAIL** — no report (the job ended, ${suite.job ?? "result unknown"}, before its tests could report) |`)
    annotations.push(`::error title=${suite.label} filter tests::No test report: the job ended (${suite.job ?? "unknown result"}) before its tests could report.`)
    continue
  }
  let s
  try {
    s = summarize(JSON.parse(readFileSync(file, "utf8")))
  } catch (error) {
    failing = true
    rows.push(`| ${suite.label} | – | – | – | – | – | **FAIL** — unreadable report |`)
    annotations.push(`::error title=${suite.label} filter tests::Unreadable report: ${firstLine(String(error))}`)
    continue
  }
  const bad = s.failed.length > 0 || s.errors.length > 0 || s.total === 0
  if (bad) failing = true
  const verdict = bad
    ? `**FAIL** — ${s.failed.length} failed${s.infra ? ` (${s.infra} infrastructure)` : ""}${s.errors.length ? `, ${s.errors.length} error(s) outside tests` : ""}${s.total === 0 ? ", no test ran" : ""}`
    : s.flaky.length > 0
      ? "PASS, with flaky tests"
      : "PASS"
  rows.push(`| ${suite.label} | ${s.passed} | ${s.failed.length} | ${s.flaky.length} | ${s.skipped} | ${s.retries} | ${verdict} |`)

  for (const f of s.failed) {
    const kind = f.error.includes(INFRA) ? "infrastructure" : "test failure"
    details.push(`- **${suite.label}** › ${escapeCell(f.title)} — ${kind}: \`${f.error.replace(/`/g, "'")}\``)
  }
  for (const f of s.flaky) {
    details.push(`- **${suite.label}** › ${escapeCell(f.title)} — flaky (passed only on retry): \`${(f.error || "?").replace(/`/g, "'")}\``)
    annotations.push(`::warning title=Flaky filter test::${suite.label} › ${f.title} passed only on retry`)
  }
  for (const e of s.errors) {
    details.push(`- **${suite.label}** — error outside tests: \`${e.replace(/`/g, "'")}\``)
  }
  if (bad) {
    const parts = [`${s.failed.length} failed`, `${s.flaky.length} flaky`, `${s.retries} retries`]
    if (s.errors.length) parts.push(`${s.errors.length} error(s) outside tests`)
    if (s.total === 0) parts.push("no test ran")
    annotations.push(`::error title=${suite.label} filter tests::${parts.join(", ")}`)
  }
}

const markdown = [
  "## Daily Filter Tests",
  "",
  `**Target:** ${process.env.PLAYWRIGHT_BASE_URL ?? "?"} · **Date:** ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`,
  "",
  "| Suite | Passed | Failed | Flaky (passed on retry) | Skipped | Retries | Result |",
  "|-------|-------:|-------:|------------------------:|--------:|--------:|--------|",
  ...rows,
  "",
  ...(details.length ? ["### Failed and flaky tests", "", ...details, ""] : []),
  "Reports, traces and screenshots: the `filter-report-*` artifacts of this run.",
  "",
].join("\n")

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown)
process.stdout.write(markdown + "\n")
for (const line of annotations) console.log(line)
process.exit(failing ? 1 : 0)
