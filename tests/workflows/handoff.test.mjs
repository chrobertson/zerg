// Hand-off tests: run the real `run:` scripts in bash with a stubbed `gh` (and
// `sleep`), so no real issue is touched and no agent runs.
import { describe, expect, test } from "bun:test";
import { findStep, loadWorkflow, runStep, singleJob } from "./helpers.mjs";

const handoffs = [
  {
    file: "define-the-why.yml",
    step: "Define the what once the why is approved",
    label: "why-defined",
    next: "define-the-what.yml",
  },
  {
    file: "define-the-what.yml",
    step: "Define the how once the what is approved",
    label: "what-defined",
    next: "define-the-how.yml",
  },
  {
    file: "define-the-how.yml",
    step: "Do the work once the how is approved",
    label: "how-defined",
    next: "do-the-work.yml",
  },
];

for (const { file, step, label, next } of handoffs) {
  describe(`${file}: ${step}`, () => {
    const job = singleJob(loadWorkflow(file));
    const handoff = findStep(job, step);
    const run = (responses) => runStep(handoff, { env: { ISSUE: "7" }, responses });
    const dispatches = (calls) => calls.filter((c) => c.startsWith("workflow run"));

    test(`dispatches ${next} with the issue number once ${label} is on the issue`, () => {
      const r = run({ labels: ["enhancement", label] });
      expect(r.status).toBe(0);
      expect(dispatches(r.calls)).toEqual([`workflow run ${next} -f issue=7`]);
    });

    test(`dispatches nothing when ${label} is missing`, () => {
      const r = run({ labels: ["enhancement"] });
      expect(r.status).toBe(0);
      expect(dispatches(r.calls)).toEqual([]);
    });

    test(`does not mistake a label that merely contains ${label}`, () => {
      const r = run({ labels: [`not-${label}`, `${label}-later`] });
      expect(dispatches(r.calls)).toEqual([]);
    });

    test("fails the step when the dispatch never starts a run", () => {
      const r = run({ labels: [label], runsStarted: false });
      expect(r.status).not.toBe(0);
      expect(r.stdout).toContain(`::error::${next} did not start after the hand-off for #7.`);
    });

    test("fails the step when the dispatch is rejected", () => {
      const r = run({ labels: [label], dispatchFails: true });
      expect(r.status).not.toBe(0);
    });
  });
}

// The why workflow's job is only started for an open issue, so it has no
// closed-issue step. The what and how workflows may be dispatched for any issue.
for (const file of ["define-the-what.yml", "define-the-how.yml"]) {
  describe(`${file}: Skip closed issues`, () => {
    const job = singleJob(loadWorkflow(file));
    const step = findStep(job, "Skip closed issues");
    const run = (issueState) => runStep(step, { env: { ISSUE: "7" }, responses: { issueState } });

    test("goes ahead for an open issue", () => {
      const r = run("OPEN");
      expect(r.status).toBe(0);
      expect(r.outputs.open).toBe("true");
    });

    test("skips a closed issue and says why", () => {
      const r = run("CLOSED");
      expect(r.status).toBe(0);
      expect(r.outputs.open).toBe("false");
      expect(r.stdout).toContain("::notice::Issue #7 is closed, so it is out of scope.");
    });

    test("every later step is gated on the lookup, except failure reporting", () => {
      const later = job.steps.slice(job.steps.indexOf(step) + 1);
      for (const s of later) {
        if (s.name === "Say the step failed" || s.name === "Show Claude's error") continue;
        expect(String(s.if)).toContain("steps.issue.outputs.open == 'true'");
      }
    });
  });
}

describe("do-the-work.yml: Check the issue is ready for work", () => {
  const job = singleJob(loadWorkflow("do-the-work.yml"));
  const step = findStep(job, "Check the issue is ready for work");
  const run = (responses) =>
    runStep(step, {
      env: { ISSUE: "7", BRANCH: "do-the-work/issue-7" },
      responses,
    });

  test("goes for an open issue with an approved how and no worker PR", () => {
    const r = run({ labels: ["how-defined"], prs: [] });
    expect(r.outputs.go).toBe("true");
  });

  test("goes when the only earlier worker PR was closed unmerged", () => {
    expect(run({ labels: ["how-defined"], prs: ["CLOSED"] }).outputs.go).toBe("true");
  });

  test("skips a closed issue", () => {
    const r = run({ issueState: "CLOSED", labels: ["how-defined"] });
    expect(r.outputs.go).toBe("false");
    expect(r.stdout).toContain("Issue #7 is closed, so it is out of scope.");
  });

  test("skips an issue without an approved how", () => {
    const r = run({ labels: ["what-defined"] });
    expect(r.outputs.go).toBe("false");
    expect(r.stdout).toContain("has no approved how");
  });

  test("skips when a worker PR is already open", () => {
    const r = run({ labels: ["how-defined"], prs: ["OPEN"] });
    expect(r.outputs.go).toBe("false");
    expect(r.stdout).toContain("already has a worker PR from do-the-work/issue-7");
  });

  test("skips when a worker PR was already merged", () => {
    expect(run({ labels: ["how-defined"], prs: ["MERGED"] }).outputs.go).toBe("false");
  });
});

describe("do-the-work.yml: Merge the PR", () => {
  const job = singleJob(loadWorkflow("do-the-work.yml"));
  const step = findStep(job, "Merge the PR");

  test("squash-merges with --auto so required checks must pass first", () => {
    expect(step.run).toContain("gh pr merge");
    expect(step.run).toContain("--auto");
    expect(step.run).toContain("--squash");
  });
});
