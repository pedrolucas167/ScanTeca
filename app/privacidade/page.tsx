import PrivacyNotice from "./PrivacyNotice";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Aviso de Privacidade da ScanTeca</h1>
      <PrivacyNotice />
    </main>
  );
}
