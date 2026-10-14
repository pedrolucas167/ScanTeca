import { describe, expect, it } from "vitest";
import { developmentSeedConfig, fixtureId } from "./development-fixtures";

const local = "postgresql://dev:dev@127.0.0.1:55440/scanteca_development";
describe("proteções do seed de desenvolvimento", () => {
  it("exige destino e usuário explícitos mesmo com DATABASE_URL disponível", () => {
    expect(() => developmentSeedConfig({ DATABASE_URL: local })).toThrow();
    expect(() => developmentSeedConfig({ SEED_DATABASE_URL: local })).toThrow();
  });
  it.each([
    "postgresql://dev:dev@production.example:55440/scanteca_development",
    "postgresql://dev:dev@127.0.0.1:5432/production",
    "postgresql://dev:dev@127.0.0.1:55440/production",
    "https://127.0.0.1:55440/scanteca_development",
  ])("rejeita outro destino: %s", url => {
    expect(() => developmentSeedConfig({ SEED_DATABASE_URL: url, SEED_USER_ID: "user_test" })).toThrow();
  });
  it("bloqueia modo produção", () => {
    expect(() => developmentSeedConfig({ NODE_ENV: "production", SEED_DATABASE_URL: local, SEED_USER_ID: "user_test" })).toThrow();
  });
  it("aceita o banco local dedicado", () => {
    expect(developmentSeedConfig({ SEED_DATABASE_URL: local, SEED_USER_ID: "user_test" }).userId).toBe("user_test");
  });
  it("IDs são estáveis por conta e distintos entre contas", () => {
    expect(fixtureId("user_a", "reading")).toBe(fixtureId("user_a", "reading"));
    expect(fixtureId("user_a", "reading")).not.toBe(fixtureId("user_b", "reading"));
  });
});
