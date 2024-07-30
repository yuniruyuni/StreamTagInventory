import { CLIENT_ID } from "./constant";

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

export const twitch = {
  get: ([url, token]: [string, string]) =>
    fetchWithError(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "Client-Id": CLIENT_ID },
    }),
  post: <Arg>([url, token]: [string, string], { arg }: { arg: Arg }) =>
    fetchWithError(url, {
      method: "POST",
      body: JSON.stringify(arg),
      headers: { Authorization: `Bearer ${token}`, "Client-ID": CLIENT_ID },
    }),
  put: <Arg>([url, token]: [string, string], { arg }: { arg: Arg }) =>
    fetchWithError(url, {
      method: "PUT",
      body: JSON.stringify(arg),
      headers: { Authorization: `Bearer ${token}`, "Client-ID": CLIENT_ID },
    }),

  patch: <Arg>([url, token]: [string, string], { arg }: { arg: Arg }) =>
    fetchWithError(url, {
      method: "PATCH",
      body: JSON.stringify(arg),
      headers: { Authorization: `Bearer ${token}`, "Client-ID": CLIENT_ID },
    }),

  delete: <Arg>([url, token]: [string, string], { arg }: { arg: Arg }) =>
    fetchWithError(url, {
      method: "DELETE",
      body: JSON.stringify(arg),
      headers: { Authorization: `Bearer ${token}`, "Client-ID": CLIENT_ID },
    }),
};