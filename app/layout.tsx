import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, EB_Garamond } from "next/font/google";
import Link from "next/link";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import { BookOpen, Heart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import ThemeToggle from "./ThemeToggle";
import AccentPicker from "./AccentPicker";
import PwaRegister from "./PwaRegister";
import MobileNav from "./MobileNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Scanteca",
  description: "Scanteca - biblioteca pessoal com scanner de códigos ISBN",
  applicationName: "Scanteca",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scanteca",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

// Cache por usuário — invalidado via revalidateTag no POST /api/library-settings.
// Sem a tag, um accent velho do cache sobrescreveria o localStorage fresco.
const getAccentTheme = (userId: string) =>
  unstable_cache(
    async () => {
      const setting = await prisma.librarySetting.findUnique({
        where: { userId },
        select: { accentTheme: true },
      });
      return setting?.accentTheme ?? null;
    },
    ["accent-theme", userId],
    { tags: [`accent-theme:${userId}`], revalidate: 3600 }
  )();

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let accent: string | null = null;
  try {
    const { userId } = await auth();
    if (userId) {
      accent = await getAccentTheme(userId);
    }
  } catch {}

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      data-accent={accent ?? undefined}
      className={`${geistSans.variable} ${geistMono.variable} ${garamond.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');var el=document.documentElement;if(el.dataset.accent){localStorage.setItem('accent',el.dataset.accent)}else{var a=localStorage.getItem('accent');if(a)el.dataset.accent=a}}catch(e){}",
          }}
        />
        <ClerkProvider>
          <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
            <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
              <div className="flex items-center gap-8">
                <Link href="/" className="group flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-md shadow-indigo-600/20 transition-transform duration-200 group-hover:scale-105">
                    <BookOpen className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold leading-none tracking-tight text-foreground">
                      Scanteca
                    </span>
                    <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600/80 dark:text-indigo-400/80">
                      Bibliotheca Personalis
                    </span>
                  </div>
                </Link>
                <div className="hidden items-center gap-1 md:flex">
                  <Link
                    href="/"
                    className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Catálogo
                  </Link>
                  <Link
                    href="/jornada"
                    className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Jornada
                  </Link>
                  <Link
                    href="/manifesto"
                    className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Manifesto
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <Link
                  href="/scanner"
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 sm:px-5 sm:py-2.5"
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
                  <span className="hidden sm:inline">Adicionar</span>
                </Link>
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800">
                      Entrar
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 sm:px-5 sm:py-2.5 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                      Cadastrar
                    </button>
                  </SignUpButton>
                </Show>
                <AccentPicker />
                <ThemeToggle />
                <Show when="signed-in">
                  <UserButton />
                </Show>
                <MobileNav />
              </div>
            </nav>
          </header>
          {children}
          <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-10 md:flex-row md:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800">
                  <BookOpen className="h-4 w-4 text-white" />
                </div>
                <span className="font-serif text-lg font-semibold text-foreground">
                  Scanteca
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-zinc-600 dark:text-zinc-400">
                <Link href="/manifesto" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
                  Manifesto
                </Link>
                <Link href="/jornada" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
                  Jornada
                </Link>
                <Link href="/oracle" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
                  Oráculo
                </Link>
                <a
                  href="https://www.linkedin.com/in/pedromarquesdev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  LinkedIn
                </a>
              </div>
              <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 md:text-right">
                © {new Date().getFullYear()} Scanteca — Bibliotheca Personalis.
                <br />
                Feito com{" "}
                <Heart className="inline h-3 w-3 fill-rose-500 text-rose-500" /> por{" "}
                <a
                  href="https://portfoliomarques.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Pedro Marques
                </a>
              </p>
            </div>
          </footer>
        </ClerkProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
