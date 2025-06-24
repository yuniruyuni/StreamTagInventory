import { getApiClient } from "./api";
export { TwitchError } from "./api";

export function dep(templs: TemplateStringsArray, ...exprs: unknown[]): string {
  for (const expr of exprs) {
    if (expr === null)
      throw new Error("null parameter is assigned so skip request");
    if (expr === undefined)
      throw new Error("undefined parameter is assigned so skip request");
  }

  let [res, ...strs] = templs;
  for (let i = 0; i < exprs.length; i++) {
    res += exprs[i] + strs[i];
  }
  return res;
}

// Export a getter to always get the current instance
export const twitch = {
  get: <T>(args: [string, string]) => getApiClient().get<T>(args),
  post: <Arg, T>(args: [string, string], params: { arg: Arg }) => getApiClient().post<Arg, T>(args, params),
  put: <Arg, T>(args: [string, string], params: { arg: Arg }) => getApiClient().put<Arg, T>(args, params),
  patch: <Arg, T>(args: [string, string], params: { arg: Arg }) => getApiClient().patch<Arg, T>(args, params),
  delete: <Arg, T>(args: [string, string], params: { arg: Arg }) => getApiClient().delete<Arg, T>(args, params),
};
