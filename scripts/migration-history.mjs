import fs from "node:fs";
import { spawnSync } from "node:child_process";

const root = "prisma/migrations/";
const normalized = value => String(value).replaceAll("\r\n", "\n");

export function inspectMigrationHistory(base, current) {
  const errors = [];
  const warnings = [];
  const migrations = new Map();
  const added = [];
  const problem = (code, file, message) => errors.push({ code, file, message });
  for (const [file, content] of base) {
    if (!file.startsWith(root)) continue;
    if (!current.has(file)) problem("HISTORY_DELETED", file, "Migração histórica removida. Restaure o arquivo e crie uma nova migração para a alteração.");
    else if (normalized(content) !== normalized(current.get(file))) problem("HISTORY_CHANGED", file, "Histórico de migrações alterado. Restaure o conteúdo integrado e gere uma nova migração.");
  }
  const baseVersions = [...base.keys()].flatMap(file => file.match(/^prisma\/migrations\/(\d{14})_[^/]+\/migration\.sql$/u)?.[1] ?? []);
  const latest = baseVersions.sort().at(-1);
  for (const [file, content] of current) {
    if (!file.startsWith(root) || file === `${root}migration_lock.toml`) continue;
    const relative = file.slice(root.length);
    const [directory] = relative.split("/");
    if (!relative.includes("/")) {
      if (base.has(file)) warnings.push({ file, message: "SQL legado fora de uma pasta de migração: Prisma migrate deploy não o executa. Mantido sem alterações; reconciliação histórica pendente." });
      else problem("LOOSE_SQL", file, "Arquivo fora do formato Prisma. Use prisma/migrations/AAAAMMDDHHMMSS_descricao/migration.sql.");
      continue;
    }
    migrations.set(directory, `${root}${directory}/migration.sql`);
    if (!/^\d{14}_[a-z][a-z0-9_]*$/u.test(directory) || relative !== `${directory}/migration.sql`) {
      problem("INVALID_NAME", file, "Nome inválido. Use uma pasta AAAAMMDDHHMMSS_descricao com apenas migration.sql.");
    } else if (!String(content).trim()) problem("EMPTY_SQL", file, "Migração vazia. Inclua o SQL da alteração antes de abrir o PR.");
  }
  const versions = new Map();
  for (const [directory, file] of migrations) {
    if (!current.has(file)) problem("MISSING_SQL", file, "Pasta de migração sem migration.sql. Inclua o arquivo SQL.");
    const version = directory.slice(0, 14);
    if (!/^\d{14}$/u.test(version)) continue;
    const iso = `${version.slice(0, 4)}-${version.slice(4, 6)}-${version.slice(6, 8)}T${version.slice(8, 10)}:${version.slice(10, 12)}:${version.slice(12, 14)}.000Z`;
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== iso) problem("INVALID_TIMESTAMP", file, "Data/hora da versão inválida. Gere novamente a migração com Prisma.");
    if (versions.has(version)) {
      const previous = versions.get(version);
      const previousFile = `${root}${previous}/migration.sql`;
      const duplicatedFile = base.has(file) && !base.has(previousFile) ? previousFile : file;
      const other = duplicatedFile === file ? previous : directory;
      problem("DUPLICATE_VERSION", duplicatedFile, `Versão ${version} repetida em duas pastas. Gere uma versão única; outra pasta: ${other}.`);
    }
    versions.set(version, directory);
    if (!base.has(file) && current.has(file)) {
      added.push(file);
      if (latest && version <= latest) problem("OUT_OF_ORDER", file, `Migração nova anterior ou igual à última versão integrada (${latest}). Atualize sua branch e gere uma versão posterior.`);
    }
  }
  if (!current.has(`${root}migration_lock.toml`)) problem("MISSING_LOCK", `${root}migration_lock.toml`, "Inclua migration_lock.toml no histórico versionado.");
  return { errors, warnings, added: added.sort(), needsReplay: added.length > 0 || normalized(base.get("prisma/schema.prisma")) !== normalized(current.get("prisma/schema.prisma")) };
}

export function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error("Não foi possível ler a base Git. Faça fetch da branch de destino e informe MIGRATION_BASE_REF.");
  return result.stdout;
}

export function readMigrationComparison(reference = process.env.MIGRATION_BASE_REF || "origin/main") {
  const revision = git(["rev-parse", "--verify", "--end-of-options", `${reference}^{commit}`]).trim();
  if (!/^[a-f0-9]{40}$/u.test(revision)) throw new Error("Base Git inválida.");
  const paths = ["prisma/migrations", "prisma/schema.prisma"];
  const baseFiles = git(["ls-tree", "-r", "--name-only", "-z", revision, "--", ...paths]).split("\0").filter(Boolean);
  const currentFiles = git(["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ...paths]).split("\0").filter(Boolean);
  const base = new Map(baseFiles.map(file => [file, git(["show", `${revision}:${file}`])]));
  const current = new Map([...new Set(currentFiles)].filter(file => fs.existsSync(file)).map(file => {
    if (!fs.lstatSync(file).isFile()) throw new Error("O histórico deve conter somente arquivos regulares, sem links simbólicos.");
    return [file, fs.readFileSync(file, "utf8")];
  }));
  if (!base.has("prisma/schema.prisma") || !current.has("prisma/schema.prisma")) throw new Error("Schema Prisma ausente na base ou na branch atual.");
  return { base, current, revision, ...inspectMigrationHistory(base, current) };
}

const escapeData = value => String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
export function annotation(kind, { file = "prisma/schema.prisma", code = "MIGRATION_CHECK", message }) {
  const property = escapeData(file).replaceAll(":", "%3A").replaceAll(",", "%2C");
  return `::${kind} file=${property},line=1,title=Histórico Prisma (${code})::${escapeData(message)}`;
}
