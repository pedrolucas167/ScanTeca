export function isConventionalTitle(title) {
  return typeof title === "string" && title.length <= 160 && !/[\r\n]/u.test(title)
    && /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9][a-z0-9._/-]*\))?!?: \S.*$/u.test(title);
}

export function workflowProblems(workflow) {
  const problems = [];
  if (!workflow || typeof workflow !== "object" || !workflow.jobs) return ["Workflow sem jobs."];
  if (workflow.permissions === "write-all" || !workflow.permissions) problems.push("Defina permissões mínimas explícitas.");
  for (const [name, job] of Object.entries(workflow.jobs)) {
    if (!Number.isInteger(job["timeout-minutes"]) || job["timeout-minutes"] < 1 || job["timeout-minutes"] > 45) problems.push(`${name}: timeout deve estar entre 1 e 45 minutos.`);
    if (job.permissions === "write-all") problems.push(`${name}: write-all não é permitido.`);
    for (const step of job.steps || []) {
      if (!step.uses || step.uses.startsWith("./")) continue;
      if (!/^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/u.test(step.uses)) problems.push(`${name}: action deve usar SHA completo: ${step.uses}`);
    }
  }
  return problems;
}
