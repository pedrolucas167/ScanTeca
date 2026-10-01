import { describe, expect, it } from "vitest";
import { validateOracleResponse } from "./oracle-quality";

describe("validateOracleResponse", () => {
  it("accepts a grounded Portuguese response", () => {
    expect(
      validateOracleResponse(
        'Eu recomendaria "Duna" porque a sinopse e o gênero registrados no acervo combinam com o pedido.',
        ["Duna"]
      ).valid
    ).toBe(true);
  });

  it("rejects generated gibberish", () => {
    expect(
      validateOracleResponse(
        "Uma leitura interessante payload async headerCode Cor.R.type braI " +
          "recomendo algo sem evidência."
      ).valid
    ).toBe(false);
  });

  it("rejects unknown quoted titles", () => {
    expect(
      validateOracleResponse('Leia "Livro Inventado" neste fim de semana.', ["Duna"]).valid
    ).toBe(false);
  });
});
