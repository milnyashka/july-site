import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, isLocale, locales } from './src/i18n/config';
import { updateSession } from './src/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.includes('/api/withdrawals') ||
    pathname.includes('/api/admin/withdrawals')
  ) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const withdrawalLocale = locales.find(
    (locale) =>
      pathname === `/${locale}/marketplace/withdraw` ||
      pathname.startsWith(`/${locale}/marketplace/withdraw/`) ||
      pathname === `/${locale}/admin/withdrawals` ||
      pathname.startsWith(`/${locale}/admin/withdrawals/`)
  );

  if (withdrawalLocale) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.includes('/admin/withdrawals')
      ? `/${withdrawalLocale}/admin`
      : `/${withdrawalLocale}/account`;
    return NextResponse.redirect(url);
  }

  const supabaseResponse = await updateSession(request);

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
  matcher: [
    '/((?!api|_next|.*\\..*).*)',
    '/api/withdrawals/:path*',
    '/api/admin/withdrawals/:path*',
  ],
};