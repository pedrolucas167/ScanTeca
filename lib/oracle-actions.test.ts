import { expect, it } from "vitest";
import { ORACLE_ACTIONS, isOracleAction } from "./oracle-actions";

it("permits only fixed application actions, rejecting URLs and inherited keys", () => {
  expect(isOracleAction("add_book")).toBe(true);
  expect(ORACLE_ACTIONS.add_book.href).toBe("/manual-add");
  expect(ORACLE_ACTIONS.create_route.href).toBe("/rota");
  expect(ORACLE_ACTIONS.update_status.href).toBe("/");
  for (const value of [undefined, null, {}, "constructor", "__proto__", "https://example.org", "unknown"]) {
    expect(isOracleAction(value)).toBe(false);
  }
});
