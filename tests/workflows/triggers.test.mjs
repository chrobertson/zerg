// Trigger and gating tests: which events start (or skip) each workflow. The
// `on:` block and the job's `if:` are read from the real file.
import { describe, expect, test } from "bun:test";
import { jobRuns, listens, loadWorkflow } from "./helpers.mjs";
import { commented, dispatched, edited, labeled, opened } from "./fixtures/events.mjs";

// [description, event, expected]
const cases = {
  "define-the-why.yml": [
    ["issue opened by the owner", opened(), true],
    ["issue opened by a member", opened({ association: "MEMBER" }), true],
    ["issue opened by a collaborator", opened({ association: "COLLABORATOR" }), true],
    ["issue opened by a stranger", opened({ association: "NONE" }), false],
    ["issue opened by a first-time contributor", opened({ association: "FIRST_TIME_CONTRIBUTOR" }), false],
    ["author replies before the why is approved", commented({ labels: [] }), true],
    ["author replies after the why is approved", commented({ labels: ["why-defined"] }), false],
    ["someone else replies", commented({ by: "someone-else" }), false],
    ["the bot comments", commented({ by: "github-actions[bot]" }), false],
    ["comment on a pull request", commented({ pr: true }), false],
    ["comment on a closed issue", commented({ state: "closed" }), false],
    ["comment by a stranger's issue author", commented({ association: "NONE" }), false],
    ["closed issue opened", opened({ state: "closed" }), false],
    ["why-defined label added", labeled("why-defined"), false],
    ["issue edited", edited(), false],
    ["dispatch", dispatched(), false],
  ],
  "define-the-what.yml": [
    ["why-defined label added by a person", labeled("why-defined"), true],
    ["another label added", labeled("enhancement"), false],
    ["what-defined label added", labeled("what-defined"), false],
    ["why-defined added to a stranger's issue", labeled("why-defined", { association: "NONE" }), false],
    ["why-defined added to a closed issue", labeled("why-defined", { state: "closed" }), false],
    ["author replies after the why, before the what", commented({ labels: ["why-defined"] }), true],
    ["author replies before the why", commented({ labels: [] }), false],
    ["author replies after the what is approved", commented({ labels: ["why-defined", "what-defined"] }), false],
    ["someone else replies", commented({ by: "someone-else", labels: ["why-defined"] }), false],
    ["comment on a pull request", commented({ labels: ["why-defined"], pr: true }), false],
    ["reply on a closed issue", commented({ labels: ["why-defined"], state: "closed" }), false],
    ["reply on a stranger's issue", commented({ labels: ["why-defined"], association: "NONE" }), false],
    ["issue opened", opened(), false],
    ["dispatch", dispatched(), true],
  ],
  "define-the-how.yml": [
    ["what-defined label added by a person", labeled("what-defined"), true],
    ["another label added", labeled("why-defined"), false],
    ["how-defined label added", labeled("how-defined"), false],
    ["what-defined added to a stranger's issue", labeled("what-defined", { association: "NONE" }), false],
    ["what-defined added to a closed issue", labeled("what-defined", { state: "closed" }), false],
    ["author replies after the what, before the how", commented({ labels: ["why-defined", "what-defined"] }), true],
    ["author replies before the what", commented({ labels: ["why-defined"] }), false],
    ["author replies after the how is approved", commented({ labels: ["what-defined", "how-defined"] }), false],
    ["someone else replies", commented({ by: "someone-else", labels: ["what-defined"] }), false],
    ["comment on a pull request", commented({ labels: ["what-defined"], pr: true }), false],
    ["reply on a closed issue", commented({ labels: ["what-defined"], state: "closed" }), false],
    ["reply on a stranger's issue", commented({ labels: ["what-defined"], association: "NONE" }), false],
    ["issue opened", opened(), false],
    ["dispatch", dispatched(), true],
  ],
  // Only ever started by dispatch: no issue or comment event may start it.
  "do-the-work.yml": [
    ["dispatch", dispatched(), true],
    ["how-defined label added by a person", labeled("how-defined", { labels: ["how-defined"] }), false],
    ["author replies on an approved issue", commented({ labels: ["how-defined"] }), false],
    ["issue opened", opened(), false],
  ],
};

for (const [file, table] of Object.entries(cases)) {
  describe(file, () => {
    const workflow = loadWorkflow(file);
    for (const [description, event, expected] of table) {
      test(`${expected ? "starts" : "skips"}: ${description}`, () => {
        expect(jobRuns(workflow, event)).toBe(expected);
      });
    }
  });
}

describe("every event the tables expect to start a job is listed in on:", () => {
  for (const [file, table] of Object.entries(cases)) {
    const workflow = loadWorkflow(file);
    for (const [description, event, expected] of table) {
      if (!expected) continue;
      test(`${file}: ${description}`, () => {
        expect(listens(workflow, event)).toBe(true);
      });
    }
  }
});

describe("workflows listen to the events the hand-off chain relies on", () => {
  test("define-the-why listens to issues opened and comments created", () => {
    const on = loadWorkflow("define-the-why.yml").on;
    expect(on.issues.types).toEqual(["opened"]);
    expect(on.issue_comment.types).toEqual(["created"]);
  });
  for (const file of ["define-the-what.yml", "define-the-how.yml"]) {
    test(`${file} listens to labels, comments and dispatch`, () => {
      const on = loadWorkflow(file).on;
      expect(on.issues.types).toEqual(["labeled"]);
      expect(on.issue_comment.types).toEqual(["created"]);
      expect(on.workflow_dispatch).toBeDefined();
    });
  }
  test("do-the-work only listens to dispatch", () => {
    expect(Object.keys(loadWorkflow("do-the-work.yml").on)).toEqual(["workflow_dispatch"]);
  });
});
