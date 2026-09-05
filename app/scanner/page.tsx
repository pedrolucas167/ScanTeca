import AddBookClient from "./AddBookClient";

export default async function ScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = tab === "search" ? "search" : "scan";
  return <AddBookClient initialTab={initialTab} />;
}
