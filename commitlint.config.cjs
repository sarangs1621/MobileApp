/**
 * Conventional Commits — enforced by the commit-msg git hook (.husky/commit-msg).
 * Scope is the package or feature, e.g. feat(attendance): bulk mark upsert.
 * See docs/CODING_STANDARDS.md §10.
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "docs", "refactor", "test", "perf", "build", "ci", "revert"],
    ],
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "header-max-length": [2, "always", 100],
  },
};
