import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/scanner(.*)", "/api/scan(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  console.log("Middleware: pathname =", req.nextUrl.pathname);
  
  // TEMPORARY: Removed redirect to test if it's causing the loop
  // if (req.nextUrl.pathname === "/catalogo") {
  //   console.log("Middleware: redirecting /catalogo to /");
  //   return NextResponse.redirect(new URL("/", req.url));
  // }
  
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
