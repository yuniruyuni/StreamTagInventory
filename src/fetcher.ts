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

export class TwitchError extends Error {
  constructor(
    public error: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type TwitchErrorResponse = {
  error: string;
  status: number;
  message: string;
};

const fetchForTwitch = async <T>(
  url: string,
  init: RequestInit,
): Promise<T> => {
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

  type Resp = { data: T, error?: string } | TwitchErrorResponse;

  function isTwitchErrorResponse(
    arg: Resp,
  ): arg is TwitchErrorResponse {
    return arg.error !== undefined;
  }

  let json: Resp;
  try {
    json = await res.json();
  } catch {
    throw new TwitchError(
      "parse error",
      500,
      "invalid json payload was returned from twitch",
    );
  }

  if (!res.ok) {
    throw new TwitchError(
      json.error ?? "",
      res.status,
      "twitch returns error status code",
    );
  }

  if (isTwitchErrorResponse(json)) {
    throw new TwitchError(
      json.error,
      res.status,
      "twitch returns error payload",
    );
  }

  return json.data;
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
