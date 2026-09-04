"use client";

import dynamic from "next/dynamic";

const Scanner = dynamic(() => import("./Scanner"), { ssr: false });

export default function ClientWrapper() {
  return <Scanner />;
}
