import { useEffect, useState } from 'react';

export type Route = { path: string; parts: string[]; query: URLSearchParams };

function parse(): Route {
  const h = location.hash.replace(/^#/, '') || '/';
  const [p, q] = h.split('?');
  const path = p.startsWith('/') ? p : '/' + p;
  return { path, parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q || '') };
}

export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const f = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

export const go = (path: string) => {
  location.hash = path.startsWith('#') ? path : '#' + path;
};
export const back = () => {
  if (history.length > 1) history.back();
  else go('/');
};
export const href = (path: string) => '#' + path;
