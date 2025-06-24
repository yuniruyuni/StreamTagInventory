export interface ApiClient {
  get: <T>([url, token]: [string, string]) => Promise<T>;
  post: <Arg, T>([url, token]: [string, string], { arg }: { arg: Arg }) => Promise<T>;
  put: <Arg, T>([url, token]: [string, string], { arg }: { arg: Arg }) => Promise<T>;
  patch: <Arg, T>([url, token]: [string, string], { arg }: { arg: Arg }) => Promise<T>;
  delete: <Arg, T>([url, token]: [string, string], { arg }: { arg: Arg }) => Promise<T>;
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