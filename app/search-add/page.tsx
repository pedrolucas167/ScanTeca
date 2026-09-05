import { redirect } from "next/navigation";

export default function SearchAddPage() {
  redirect("/scanner?tab=search");
}

