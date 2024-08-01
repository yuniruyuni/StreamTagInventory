import { CLIENT_ID } from "./constant";

export function dep(templs: TemplateStringsArray, ...exprs: unknown[]): string {
  for( const expr of exprs ) {
    if ( expr === null ) throw new Error("null parameter is assigned so skip request");
    if ( expr === undefined ) throw new Error("undefined parameter is assigned so skip request");
  }

  let [res, ...strs] = templs;
  for( let i = 0; i < exprs.length; i++ ) {
    res += strs[i] + exprs[i];
  }
  return res;
}

const fetchWithError = async (url: string, init: RequestInit) => {
  const res = await fetch(url, {
    ...init,
    headers: {
      // this method defautly send json data so we can safely add this header.
      // some usecase(ex: multipart request) may need to remove this header,
      // in such case, user code can specify "Content-Type" in init.headers.
      "Content-Type": "application/json",
      ...init.headers,
      // this method only accept json response so we can safely add this header.
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
};

export class TwitchError extends Error {
  constructor(
    public error: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const fetchForTwitch = async <T>(url: string, init: RequestInit): Promise<T> => {
  const res = await fetchWithError(url, init);

  if( res.error ) throw new TwitchError(res.error, res.status, res.message);
  return res.data;
};

export const twitch = {
  get: <T>([url, token]: [string, string]) =>
    fetchForTwitch<T>(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "Client-Id": CLIENT_ID },
    }),
  post: <Arg, T>([url, token]: [string, string], { arg }: { arg: Arg }) =>
    fetchForTwitch<T>(url, {
      method: "POST",
      body: JSON.stringify(arg),
      headers: { Authorization: `Bearer ${token}`, "Client-ID": CLIENT_ID },
    }),
  put: <Arg, T>([url, token]: [string, string], { arg }: { arg: Arg }) =>
    fetchForTwitch<T>(url, {
      method: "PUT",
      body: JSON.stringify(arg),
      headers: { Authorization: `Bearer ${token}`, "Client-ID": CLIENT_ID },
    }),

  patch: <Arg, T>([url, token]: [string, string], { arg }: { arg: Arg }) =>
    fetchForTwitch<T>(url, {
      method: "PATCH",
      body: JSON.stringify(arg),
      headers: { Authorization: `Bearer ${token}`, "Client-ID": CLIENT_ID },
    }),

  delete: <Arg, T>([url, token]: [string, string], { arg }: { arg: Arg }) =>
    fetchForTwitch<T>(url, {
      method: "DELETE",
      body: JSON.stringify(arg),
      headers: { Authorization: `Bearer ${token}`, "Client-ID": CLIENT_ID },
    }),
};
