"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ROUTES = ["/", "/jornada", "/diario", "/rota"];

export default function RoutePrefetch() {
  const router = useRouter();

  useEffect(() => {
    const prefetch = () => ROUTES.forEach((route) => router.prefetch(route));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(prefetch, 1000);
    return () => clearTimeout(timer);
  }, [router]);

  return null;
}
