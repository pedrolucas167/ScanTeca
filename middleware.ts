import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { measureServerTask } from "@/lib/server-timing";

const isProtectedRoute = createRouteMatcher(["/scanner(.*)", "/api/scan(.*)"]);

const handleAuthentication = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export default function middleware(...args: Parameters<typeof handleAuthentication>) {
  const path = args[0].nextUrl.pathname;
  return path === "/" || path === "/manifesto"
    ? measureServerTask("middleware.auth", () => handleAuthentication(...args))
    : handleAuthentication(...args);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
