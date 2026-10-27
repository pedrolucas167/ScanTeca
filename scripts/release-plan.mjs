import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { isConventionalTitle } from "./github-policy.mjs";

const tags = execFileSync("git", ["tag", "--sort=-version:refname"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const latest = tags.find(tag => /^v?\d+\.\d+\.\d+$/u.test(tag));
const args = ["log", "--format=%s", "--max-count=100", ...(latest ? [`${latest}..HEAD`] : [])];
const titles = execFileSync("git", args, { encoding: "utf8" }).trim().split("\n").filter(isConventionalTitle);
const escape = value => value.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "\\|");
const content = ["# Proposta de release", "", latest ? `Base: ${escape(latest)}.` : "Sem tag de versão anterior; resumo dos últimos 100 commits.", "", "Revisar esta proposta antes de criar PR ou publicar release.", "", ...titles.map(title => `- ${escape(title)}`), ""].join("\n");
fs.mkdirSync("reports/release", { recursive: true });
fs.writeFileSync("reports/release/plan.md", content);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, content);
process.stdout.write(content);
