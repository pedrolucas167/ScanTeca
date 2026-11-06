import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
      <p className="max-w-sm text-center text-sm text-on-surface-variant">
        Leia os <Link href="/termos" className="underline underline-offset-4">termos de uso da ScanTeca</Link> e o{" "}
        <Link href="/privacidade" className="underline underline-offset-4">Aviso de Privacidade</Link>. Após criar a conta, você poderá confirmar o aceite dos termos antes de continuar no app.
      </p>
      <SignUp />
    </div>
  );
}
