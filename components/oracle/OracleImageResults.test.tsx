// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { OracleImageResults } from "./OracleImageResults";

afterEach(cleanup);

it("shows a thumbnail with alt text and keeps the source link when loading fails", () => {
  render(<OracleImageResults sources={[{
    id: "image-1", title: "Bíblia em exposição", author: "museum.example",
    sourceType: "image", url: "https://museum.example/collection",
    thumbnail: { url: "https://imgs.search.brave.com/preview", alt: "Bíblia em exposição" },
  }, {
    id: "book-1", title: "Livro do acervo", author: "Autor",
  }]} />);
  const image = screen.getByRole("img", { name: "Bíblia em exposição" });
  const link = screen.getByRole("link");
  expect(image.getAttribute("src")).toBe("https://imgs.search.brave.com/preview");
  expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(link.getAttribute("href")).toBe("https://museum.example/collection");
  expect(screen.queryByText("Livro do acervo")).toBeNull();
  fireEvent.error(image);
  expect(screen.getByText("Miniatura indisponível")).toBeTruthy();
  expect(screen.getByRole("link")).toBe(link);
});
