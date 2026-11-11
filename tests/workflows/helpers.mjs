// Helpers for the workflow tests: load a workflow, evaluate its real `if:`
// expressions with GitHub's own evaluator, and run a step's `run:` script with
// a stubbed `gh`. Nothing here calls the real agent or touches real issues.
import { Evaluator, Lexer, Parser, data } from "@actions/expressions";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

export const WORKFLOW_DIR = join(import.meta.dir, "..", "..", ".github", "workflows");

export function loadWorkflow(file) {
  const doc = parse(readFileSync(join(WORKFLOW_DIR, file), "utf8"));
  return { ...doc, on: doc.on ?? doc[true] };
}

export function singleJob(workflow) {
  const [job] = Object.values(workflow.jobs);
  return job;
}

export function findStep(job, name) {
  const step = job.steps.find((s) => s.name === name);
  if (!step) throw new Error(`No step named "${name}"`);
  return step;
}

// Evaluates a GitHub expression (the text of an `if:` or of a `${{ }}`) against
// a context object such as { github, inputs, steps }.
export function evaluate(expression, context) {
  const expr = expression.trim().replace(/^\$\{\{([\s\S]*)\}\}$/, "$1");
  const tokens = new Lexer(expr).lex().tokens;
  const ast = new Parser(tokens, Object.keys(context), []).parse();
  const ctx = JSON.parse(JSON.stringify(context), data.reviver);
  return new Evaluator(ast, ctx).evaluate();
}

// GitHub's rule for an `if:`: the job or step runs when the result is truthy.
export function isTruthy(result) {
  const v = JSON.parse(JSON.stringify(result, data.replacer));
  return !(v === null || v === false || v === 0 || v === "" || Number.isNaN(v));
}

// Does `on:` list this event (and, for activity types, this action)?
export function listens(workflow, event) {
  const trigger = workflow.on[event.name];
  if (trigger === undefined) return false;
  const types = trigger?.types;
  return !types || types.includes(event.action);
}

// Whether this event starts the job: it must be listed in `on:` and pass the
// job's `if:`.
export function jobRuns(workflow, event) {
  if (!listens(workflow, event)) return false;
  const job = singleJob(workflow);
  if (job.if === undefined) return true;
  return isTruthy(evaluate(String(job.if), { github: event.github, inputs: event.inputs ?? {} }));
}

// Builds an event: github.event_name, github.event (payload) and inputs.
export function makeEvent(name, action, payload = {}, inputs) {
  return {
    name,
    action,
    inputs,
    github: { event_name: name, event: { action, ...payload } },
  };
}

// Runs a step's `run:` script in bash with a fake `gh` and a fake `sleep`.
// The fake `gh` returns canned JSON and applies the step's real `--jq` filter
// with jq, so the filters are tested too. Responses:
//   issueState    -> state of the issue (default OPEN)
//   labels        -> label names on the issue
//   prs           -> states of PRs from the worker branch, e.g. ["CLOSED"]
//   runsStarted   -> whether the dispatched run shows in `gh run list` (default true)
//   dispatchFails -> make `gh workflow run` exit non-zero
// Every gh call is recorded in the returned `calls`.
export function runStep(step, { env = {}, responses = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "wf-test-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const callsFile = join(dir, "calls.log");
  const outputFile = join(dir, "output.txt");
  writeFileSync(callsFile, "");
  writeFileSync(outputFile, "");

  const gh = [
    "#!/usr/bin/env bash",
    'echo "$*" >> "$CALLS_FILE"',
    "jq_filter=",
    'args=("$@")',
    'for ((i = 0; i < ${#args[@]}; i++)); do',
    '  [ "${args[i]}" = --jq ] && jq_filter=${args[i+1]}',
    "done",
    `emit() { if [ -n "$jq_filter" ]; then printf '%s' "$1" | jq -r "$jq_filter"; else printf '%s\\n' "$1"; fi; }`,
    'case "$1 $2" in',
    '  "issue view") emit "$FAKE_ISSUE_JSON" ;;',
    '  "pr list") emit "$FAKE_PRS_JSON" ;;',
    '  "run list") emit "$FAKE_RUNS_JSON" ;;',
    '  "workflow run") [ -z "$FAKE_DISPATCH_FAILS" ] || exit 1 ;;',
    "esac",
    "exit 0",
    "",
  ].join("\n");
  writeFileSync(join(bin, "gh"), gh);
  writeFileSync(join(bin, "sleep"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(join(bin, "gh"), 0o755);
  chmodSync(join(bin, "sleep"), 0o755);

  const result = Bun.spawnSync(["bash", "-e", "-o", "pipefail", "-c", step.run], {
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: dir,
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_OUTPUT: outputFile,
      CALLS_FILE: callsFile,
      FAKE_ISSUE_JSON: JSON.stringify({
        state: responses.issueState ?? "OPEN",
        labels: (responses.labels ?? []).map((name) => ({ name })),
      }),
      FAKE_PRS_JSON: JSON.stringify((responses.prs ?? []).map((state) => ({ state }))),
      FAKE_RUNS_JSON: JSON.stringify(
        (responses.runsStarted ?? true) ? [{ createdAt: "2999-01-01T00:00:00Z" }] : [],
      ),
      FAKE_DISPATCH_FAILS: responses.dispatchFails ? "1" : "",
      ...env,
    },
  });

  const read = (f) => readFileSync(f, "utf8");
  return {
    status: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    calls: read(callsFile).split("\n").filter(Boolean),
    outputs: Object.fromEntries(
      read(outputFile)
        .split("\n")
        .filter(Boolean)
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    ),
  };
}
