import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { isConventionalTitle, workflowProblems } from "./github-policy.mjs";

const errors = [];
for (const filename of fs.readdirSync(".github/workflows").filter(name => /\.ya?ml$/u.test(name))) {
  const workflow = yaml.load(fs.readFileSync(path.join(".github/workflows", filename), "utf8"));
  errors.push(...workflowProblems(workflow).map(problem => `${filename}: ${problem}`));
}
if (process.env.GITHUB_EVENT_NAME === "pull_request") {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  if (!isConventionalTitle(event.pull_request?.title)) errors.push("O título do pull request deve seguir Conventional Commits.");
}
if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else process.stdout.write("Workflows e metadados atendem à política.\n");
