import { describe, expect, it } from "vitest";
import { validateOracleResponse } from "./oracle-quality";

describe("validateOracleResponse", () => {
  it("accepts a grounded Portuguese response", () => {
    expect(
      validateOracleResponse(
        'Eu recomendaria "Duna" porque a sinopse e o gênero registrados no acervo combinam com o pedido.',
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

  it("does not reject a natural quoted phrase by itself", () => {
    expect(
      validateOracleResponse('Leia "Livro Inventado" neste fim de semana.').valid
    ).toBe(true);
  });
});
