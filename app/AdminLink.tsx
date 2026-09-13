"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";

export default function AdminLink() {
  const { user, isLoaded } = useUser();
  if (!isLoaded || user?.publicMetadata?.role !== "admin") return null;

  return (
    <Link
      href="/admin"
      title="Painel de administração"
      className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800"
    >
      <ShieldCheck className="h-5 w-5" />
    </Link>
  );
}
