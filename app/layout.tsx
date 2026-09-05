import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import { BookOpen, Heart } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scanteca",
  description: "Scanteca - biblioteca pessoal com scanner de códigos ISBN",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
            <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
              <Link
                href="/"
                className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-foreground"
              >
                <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Scanteca
              </Link>
              <div className="flex items-center gap-2 sm:gap-4">
                <Link
                  href="/"
                  className="hidden text-sm font-medium text-zinc-600 transition-colors hover:text-foreground sm:inline dark:text-zinc-400"
                >
                  Catálogo
                </Link>
                <Link
                  href="/scanner"
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 sm:px-4 sm:text-sm"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                  </svg>
                  <span className="hidden sm:inline">Scanner</span>
                </Link>
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="text-xs font-medium text-zinc-600 transition-colors hover:text-foreground sm:text-sm dark:text-zinc-400">
                      Entrar
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 sm:px-4 sm:text-sm dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                      Cadastrar
                    </button>
                  </SignUpButton>
                </Show>
                <Show when="signed-in">
                  <UserButton />
                </Show>
              </div>
            </nav>
          </header>
          {children}
          <footer className="border-t border-zinc-200 bg-white py-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="flex items-center justify-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
              Feito com
              <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" /> por{" "}
              <a
                href="https://portfoliomarques.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Pedro Marques
              </a>
            </p>
            <div className="mt-2 flex items-center justify-center gap-4 text-sm">
              <a
                href="https://portfoliomarques.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
              >
                Portfólio
              </a>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <a
                href="https://www.linkedin.com/in/pedromarquesdev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
              >
                LinkedIn
              </a>
            </div>
            <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
              © {new Date().getFullYear()} Scanteca. Todos os direitos reservados.
            </p>
          </footer>
        </ClerkProvider>
      </body>
    </html>
  );
}
