import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, isLocale, locales } from './src/i18n/config';
import { updateSession } from './src/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const supabaseResponse = await updateSession(request);
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return supabaseResponse;

  const cookieLocale = request.cookies.get('locale')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  const redirect = NextResponse.redirect(url);

  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value);
  });

  return redirect;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};