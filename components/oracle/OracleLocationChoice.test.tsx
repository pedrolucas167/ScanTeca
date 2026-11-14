// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OracleLocationChoice } from "./OracleLocationChoice";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "geolocation");
});

it("requests location only after a click and submits coordinates to the search callback", () => {
  const getCurrentPosition = vi.fn((success: PositionCallback) => success({
    coords: { latitude: -23.56, longitude: -46.68 },
  } as GeolocationPosition));
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
  const onSearch = vi.fn();
  render(<OracleLocationChoice category="livrarias" disabled={false} onSearch={onSearch} />);
  expect(getCurrentPosition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Usar minha localização" }));
  expect(getCurrentPosition).toHaveBeenCalledOnce();
  expect(onSearch).toHaveBeenCalledWith("Encontre livrarias perto de mim", { latitude: -23.56, longitude: -46.68 });
});

it.each([undefined, 1, 2])("offers a city fallback if geolocation is unavailable or fails (%s)", code => {
  if (code) Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => error({ code } as GeolocationPositionError),
  } });
  const onSearch = vi.fn();
  render(<OracleLocationChoice category="sebos" disabled={false} onSearch={onSearch} />);
  fireEvent.click(screen.getByRole("button", { name: "Usar minha localização" }));
  expect(screen.getByRole("status").textContent).toContain("Informe a cidade ou o bairro");
  expect(onSearch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Cidade ou bairro"), { target: { value: "Recife" } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  expect(onSearch).toHaveBeenCalledWith('Encontre sebos em "Recife"');
});
