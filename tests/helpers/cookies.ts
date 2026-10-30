/** Stand-in for the browser's cookie jar behind the `next/headers` mock. One jar per test. */
export const cookieJar = new Map<string, string>();

export function cookieStore() {
  return {
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    has: (name: string) => cookieJar.has(name),
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  };
}

export const sessionCookie = () => cookieJar.get("pm_session");
