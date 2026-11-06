"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { analyticsPage, analyticsVitals, browserAnalyticsPreference } from "@/lib/analytics-preference";

function sendMetric(event: { page: NonNullable<ReturnType<typeof analyticsPage>>; name: string; rating?: string }) {
  if (browserAnalyticsPreference() !== "accepted") return;
  void fetch("/api/vitals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
    referrerPolicy: "no-referrer",
  }).catch(() => {});
}

function PerformanceMetrics() {
  // Stable reference: the hook can replay buffered metrics when a callback changes.
  useReportWebVitals(reportVital);
  return null;
}

const reportVital: Parameters<typeof useReportWebVitals>[0] = metric => {
  if (!analyticsVitals.some(name => name === metric.name)) return;
  const navigationUrl = "navigationURL" in metric && typeof metric.navigationURL === "string"
    ? metric.navigationURL
    : performance.getEntriesByType("navigation")[0]?.name;
  if (!navigationUrl) return;
  const navigation = new URL(navigationUrl);
  if (navigation.origin !== window.location.origin) return;
  const page = analyticsPage(navigation.pathname);
  if (page) sendMetric({ page, name: metric.name, rating: metric.rating });
};

export default function WebVitals({ measureLoad }: { measureLoad: boolean }) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const page = analyticsPage(pathname);
    if (page) sendMetric({ page, name: "page_view" });
  }, [pathname]);

  return measureLoad ? <PerformanceMetrics /> : null;
}
