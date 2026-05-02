import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip auth for public auth endpoints (login, register, refresh, password-reset)
  const urlPath = new URL(req.url, window.location.origin).pathname;
  const publicPaths = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/password-reset'];
  const isPublicAuth = publicPaths.some((path) => urlPath.endsWith(path));

  const token = localStorage.getItem('access_token');
  if (token && !isPublicAuth) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    return next(cloned);
  }
  return next(req);
};
