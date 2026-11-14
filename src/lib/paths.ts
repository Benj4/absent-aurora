export function withBase(path: string): string {
  const rawBase = import.meta.env.BASE_URL || '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

  if (!path || path === '/') {
    return base;
  }

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${cleanPath}`;
}

export function stripBase(pathname: string): string {
  const rawBase = import.meta.env.BASE_URL || '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

  if (base === '/') {
    return pathname || '/';
  }

  const baseNoTrailingSlash = base.slice(0, -1);
  if (pathname === baseNoTrailingSlash) {
    return '/';
  }

  if (pathname.startsWith(base)) {
    return pathname.slice(base.length - 1) || '/';
  }

  return pathname || '/';
}
