// Event payload builders. They carry only the fields the workflows read.
import { makeEvent } from "../helpers.mjs";

const AUTHOR = "author";

export function issue({ labels = [], state = "open", association = "OWNER", pr = false } = {}) {
  return {
    number: 7,
    state,
    author_association: association,
    user: { login: AUTHOR },
    labels: labels.map((name) => ({ name })),
    ...(pr ? { pull_request: { url: "https://example.test/pr/7" } } : {}),
  };
}

export const opened = (opts) => makeEvent("issues", "opened", { issue: issue(opts) });

export const labeled = (label, opts) =>
  makeEvent("issues", "labeled", { issue: issue(opts), label: { name: label } });

export const commented = ({ by = AUTHOR, ...opts } = {}) =>
  makeEvent("issue_comment", "created", { issue: issue(opts), comment: { user: { login: by } } });

export const dispatched = (inputs = { issue: "7" }) =>
  makeEvent("workflow_dispatch", undefined, {}, inputs);

// An event type the workflows do not list, to prove they ignore it.
export const edited = (opts) => makeEvent("issues", "edited", { issue: issue(opts) });

// GitHub starts no workflow for a label added with GITHUB_TOKEN, so there is
// no event to build for it: a hand-off must be a dispatch (see chain.test.mjs).
export const BOT_LABEL_ADDS_START_NOTHING = true;
