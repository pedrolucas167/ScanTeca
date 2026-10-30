const ELEMENTS = new Set(["IMG", "H1", "H2", "P", "DIV", "SPAN"]);

// Only numeric timings and a coarse element type leave the browser.
// The resource URL is used for a local lookup, never returned or reported.
export function getLcpAttribution(entries: PerformanceEntry[]) {
  const entry = entries.at(-1) as (PerformanceEntry & { element?: Element | null; url?: string }) | undefined;
  if (!entry) return undefined;
  const tag = entry.element?.tagName ?? "OTHER";
  const resource = entry.url
    ? performance.getEntriesByName(entry.url, "resource")
      .filter(item => (item as PerformanceResourceTiming).responseEnd > 0 && (item as PerformanceResourceTiming).responseEnd <= entry.startTime)
      .at(-1) as PerformanceResourceTiming | undefined
    : undefined;
  return {
    element: ELEMENTS.has(tag) ? tag : "OTHER",
    paintMs: entry.startTime,
    ...(resource ? { resourceStartMs: resource.startTime, resourceEndMs: resource.responseEnd } : {}),
  };
}
