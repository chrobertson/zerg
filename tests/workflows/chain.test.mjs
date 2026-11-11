// Chain test: why -> what -> how -> work. Labels added with GITHUB_TOKEN start
// nothing, so each hand-off must dispatch the next workflow. This checks that
// every hand-off dispatches a workflow that exists, accepts workflow_dispatch
// and takes the `issue` input it is given.
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { WORKFLOW_DIR, loadWorkflow, singleJob } from "./helpers.mjs";

const chain = [
  "define-the-why.yml",
  "define-the-what.yml",
  "define-the-how.yml",
  "do-the-work.yml",
];

// Finds `gh workflow run <file> -f issue=...` in every step's script.
function dispatchesOf(workflow) {
  const found = [];
  for (const step of singleJob(workflow).steps) {
    for (const m of (step.run ?? "").matchAll(/gh workflow run (\S+)((?: -f \S+)*)/g)) {
      found.push({ file: m[1], inputs: [...m[2].matchAll(/-f (\w+)=/g)].map((x) => x[1]) });
    }
  }
  return found;
}

describe("hand-off chain", () => {
  test("the four workflows exist", () => {
    const files = readdirSync(WORKFLOW_DIR);
    for (const f of chain) expect(files).toContain(f);
  });

  chain.slice(0, -1).forEach((file, i) => {
    const next = chain[i + 1];
    test(`${file} dispatches ${next}, and only that`, () => {
      const dispatches = dispatchesOf(loadWorkflow(file));
      expect(dispatches.map((d) => d.file)).toEqual([next]);
    });

    test(`${next} accepts workflow_dispatch with the inputs ${file} passes`, () => {
      const accepted = loadWorkflow(next).on.workflow_dispatch;
      expect(accepted).toBeDefined();
      const [dispatch] = dispatchesOf(loadWorkflow(file));
      expect(dispatch.inputs).toEqual(["issue"]);
      for (const input of dispatch.inputs) expect(accepted.inputs[input]).toBeDefined();
      expect(accepted.inputs.issue.required).toBe(true);
    });
  });

  test("the last workflow dispatches nothing", () => {
    expect(dispatchesOf(loadWorkflow("do-the-work.yml"))).toEqual([]);
  });

  test("dispatching needs actions: write on the dispatching job", () => {
    for (const file of chain.slice(0, -1)) {
      expect(singleJob(loadWorkflow(file)).permissions.actions).toBe("write");
    }
  });

  test("the dispatched workflows read the issue from inputs", () => {
    for (const file of chain.slice(1)) {
      const text = JSON.stringify(loadWorkflow(file));
      expect(text).toContain("inputs.issue");
    }
  });
});
