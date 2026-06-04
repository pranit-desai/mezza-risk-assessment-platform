import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

const PUBLIC_PREFIXES = ['/login', '/auth', '/connect', '/api/fc/session', '/api/fc/link-info', '/api/stripe/webhook'];
const ALLOWED_DOMAINS = ['mezzapay.com', 'mezzaapp.com'];

export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => path === p || path.startsWith(p + '/')
  );

  if (!isPublic) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    const domain = (user.email || '').split('@')[1]?.toLowerCase();
    if (!ALLOWED_DOMAINS.includes(domain)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('denied', '1');
      return NextResponse.redirect(url);
    }
  }

  return response;
}
