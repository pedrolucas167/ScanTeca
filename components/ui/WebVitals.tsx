"use client";

import { useReportWebVitals } from "next/web-vitals";
import { getLcpAttribution } from "@/lib/lcp-attribution";

export default function WebVitals() {
  useReportWebVitals((metric) => {
    const payload = JSON.stringify({
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      path: window.location.pathname,
      ...(metric.name === "LCP" ? { lcp: getLcpAttribution(metric.entries) } : {}),
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/vitals", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/vitals", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
    }
  });
  return null;
}
