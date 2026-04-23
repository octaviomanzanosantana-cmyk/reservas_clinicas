import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/clinic", "/admin", "/reminders", "/mi-plan"];

function matchesProtectedPrefix(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function requiresEmailConfirmation(pathname: string): boolean {
  return matchesProtectedPrefix(pathname);
}

function requiresAuthentication(pathname: string): boolean {
  return matchesProtectedPrefix(pathname);
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Bloqueo suave: si hay sesión con email no confirmado y el usuario
  // intenta acceder a rutas protegidas, redirige a /verify-email.
  if (user && !user.email_confirmed_at && requiresEmailConfirmation(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/verify-email";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  // Defensa en profundidad: anónimo en ruta protegida → /login.
  // Los layouts RSC (requireClinicAccessForSlug, getAdminUser) también lo
  // hacen, pero aquí cortamos antes y evitamos el render del layout.
  if (!user && requiresAuthentication(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/clinic/:path*",
    "/admin/:path*",
    "/reminders/:path*",
    "/mi-plan/:path*",
  ],
};
