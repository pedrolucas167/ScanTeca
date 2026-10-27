import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { redactTestLog } from "./redact-test-log.mjs";

const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)], {
  stdio: ["inherit", "pipe", "pipe"],
});
for (const [input, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  input.on("data", chunk => {
    pending += decoder.write(chunk);
    const lines = pending.split("\n");
    pending = lines.pop() || "";
    for (const line of lines) output.write(`${redactTestLog(line)}\n`);
  });
  input.on("end", () => { if (pending) output.write(redactTestLog(pending + decoder.end())); });
}
child.on("error", () => { process.stderr.write("Não foi possível iniciar o Playwright.\n"); process.exitCode = 1; });
child.on("close", code => { process.exitCode = code ?? 1; });
process.on("SIGINT", () => child.kill("SIGINT"));
