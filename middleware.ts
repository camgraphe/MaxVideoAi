import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PATHS = ["/dashboard", "/generate", "/jobs", "/billing", "/settings", "/api/jobs"];

function requiresAuth(pathname: string) {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  if (!requiresAuth(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/generate",
    "/jobs/:path*",
    "/billing",
    "/settings/:path*",
    "/api/jobs/:path*",
  ],
};
