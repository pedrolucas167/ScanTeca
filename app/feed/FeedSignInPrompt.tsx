import { SignInButton, SignUpButton } from "@clerk/nextjs";

export default function FeedSignInPrompt() {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-4 py-16 text-on-surface">
      <section aria-labelledby="feed-sign-in-title" className="w-full max-w-lg rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 text-center sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Comunidade Scanteca</p>
        <h1 id="feed-sign-in-title" className="font-headline-lg-mobile text-3xl">Entre para participar do feed</h1>
        <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">Acompanhe as leituras da comunidade e compartilhe suas descobertas. Entre na sua conta ou cadastre-se para continuar.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <SignInButton mode="modal" forceRedirectUrl="/feed">
            <button className="min-h-11 rounded-full bg-primary-container px-6 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Entrar no feed</button>
          </SignInButton>
          <SignUpButton mode="modal" forceRedirectUrl="/feed">
            <button className="min-h-11 rounded-full border border-outline-variant bg-surface-container px-6 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Criar conta</button>
          </SignUpButton>
        </div>
      </section>
    </main>
  );
}
