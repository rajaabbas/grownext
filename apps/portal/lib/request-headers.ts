export const withRequestedWithHeader = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers ?? {});
  headers.set("X-Requested-With", "XMLHttpRequest");
  return { ...init, headers };
};
