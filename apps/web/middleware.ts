import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function toHostName(value: string | undefined) {
  if (!value) {
    return '';
  }

  try {
    const normalized = value.includes('://') ? value : `https://${value}`;
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return value.toLowerCase().split(':')[0] ?? '';
  }
}

function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isReservedPath(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/favicon')
  );
}

export function middleware(request: NextRequest) {
  const { nextUrl, headers } = request;
  const path = nextUrl.pathname;

  if (isReservedPath(path) || path !== '/') {
    return NextResponse.next();
  }

  const hostHeader = headers.get('x-forwarded-host') ?? headers.get('host') ?? '';
  const hostname = hostHeader.split(':')[0]?.toLowerCase() ?? '';

  if (!hostname || isLocalHost(hostname)) {
    return NextResponse.next();
  }

  const appHost = toHostName(process.env.NEXT_PUBLIC_APP_URL ?? process.env.WEB_APP_URL);
  if (appHost && hostname === appHost) {
    return NextResponse.next();
  }

  const rewriteUrl = nextUrl.clone();
  rewriteUrl.pathname = `/public/${hostname}`;
  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: ['/']
};
