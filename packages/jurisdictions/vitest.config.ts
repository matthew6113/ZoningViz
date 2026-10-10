import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "jurisdictions",
    environment: "node",
    include: ["sf/test/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
