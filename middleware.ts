import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Everything under these paths is reachable signed out.
const PUBLIC_PATHS = ["/", "/login", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) =>
    p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/"),
  );
}

export async function middleware(req: NextRequest) {
  // When the requested callback isn't in Supabase's Redirect URLs allow-list,
  // Supabase quietly falls back to the project's Site URL — dropping the user
  // on "/" with ?code=... still attached and nothing there to exchange it.
  // That reads as a hung sign-in. Forward it to the route that handles it.
  if (req.nextUrl.pathname === "/" && req.nextUrl.searchParams.has("code")) {
    const callback = req.nextUrl.clone();
    callback.pathname = "/auth/callback";
    return NextResponse.redirect(callback);
  }

  // Start from a pass-through response so Supabase can write refreshed
  // auth cookies onto it.
  let res = NextResponse.next({ request: req });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Misconfiguration — fail loudly rather than bouncing users to a login
    // page that can't work either.
    return new NextResponse(
      "Server is missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example.",
      { status: 500 },
    );
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });

  // getUser() revalidates the token with Supabase and refreshes it if needed.
  const { data } = await supabase.auth.getUser();

  if (!data.user && !isPublic(req.nextUrl.pathname)) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return res;
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
