import path from "node:path";

export function isPrivateEnvFile(file) {
  const name = path.posix.basename(file.replaceAll("\\", "/"));
  return (name === ".env" || name.startsWith(".env.")) && name !== ".env.example";
}
