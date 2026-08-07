import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get token from cookies
  const token = request.cookies.get("token")?.value;

  // Verify token
  let userPayload = null;
  if (token) {
    userPayload = await verifyToken(token);
  }

  // 1. Protection for /owner routes
  if (pathname.startsWith("/owner")) {
    if (!userPayload || userPayload.role !== "owner") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("role", "owner");
      loginUrl.searchParams.set("redirect", pathname);
      
      // Clear token cookie if invalid
      const response = NextResponse.redirect(loginUrl);
      if (token) {
        response.cookies.delete("token");
      }
      return response;
    }
  }

  // 2. Protection for /customer routes
  if (pathname.startsWith("/customer")) {
    if (!userPayload || userPayload.role !== "customer") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("role", "customer");
      loginUrl.searchParams.set("redirect", pathname);

      // Clear token cookie if invalid
      const response = NextResponse.redirect(loginUrl);
      if (token) {
        response.cookies.delete("token");
      }
      return response;
    }
  }

  // 3. Prevent logged-in users from accessing /login
  if (pathname === "/login") {
    if (userPayload) {
      if (userPayload.role === "owner") {
        return NextResponse.redirect(new URL("/owner/dashboard", request.url));
      } else if (userPayload.role === "customer") {
        return NextResponse.redirect(new URL("/customer/dashboard", request.url));
      }
    }
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ["/owner/:path*", "/customer/:path*", "/login"],
};
