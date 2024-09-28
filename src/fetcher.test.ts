import { afterEach,  expect, test } from "bun:test";
import { clearMocks, mock } from "bun-bagel";
import { TwitchError, twitch } from "./fetcher";

type Res = {
  hoge: string,
};

afterEach(() => {
  clearMocks();
});

test("TwitchError exports status code", () => {
  const val = new TwitchError("error", 401, "message");
  expect(val.status).toBe(401);
});

test("twtich.get makes requests with GET method", async () => {
  const response = {
    data: { data: { hoge: "hoge"} },
    status: 200,
  };
  mock("https://example.com/", { method: "GET", response });

  const res = await twitch.get<Res>(["https://example.com/", "token"]);
  expect(res).toEqual({hoge: "hoge"});
});

test("error response on fetchers throws TwitchError", async () => {
  const response = {
    data: { error: { hoge: "hoge" } },
    status: 200,
  };
  mock("https://example.com/", { method: "GET", response });

  expect(
    async () => await twitch.get<Res>(["https://example.com/", "token"]),
  ).toThrowError(TwitchError);
});

test("error status on fetchers throws TwitchError", async () => {
  const response = {
    data: { data: { hoge: "hoge"} },
    status: 401,
  };
  mock("https://example.com/", { method: "GET", response });

  expect(
    async () => await twitch.get<Res>(["https://example.com/", "token"]),
  ).toThrowError(TwitchError);
});

test("twtich.post makes requests with POST method", async () => {
  const response = {
    data: { data: { hoge: "hoge"} },
    status: 200,
  };
  mock("https://example.com/", { method: "POST", response });

  const res = await twitch.post<string, Res>(["https://example.com/", "token"], {arg: ""});
  expect(res).toEqual({hoge: "hoge"});
});

test("twtich.put makes requests with PUT method", async () => {
  const response = {
    data: { data: { hoge: "hoge"} },
    status: 200,
  };
  mock("https://example.com/", { method: "PUT", response });

  const res = await twitch.put<string, Res>(["https://example.com/", "token"], {arg: ""});
  expect(res).toEqual({hoge: "hoge"});
});

test("twtich.patch makes requests with PATCH method", async () => {
  const response = {
    data: { data: { hoge: "hoge"} },
    status: 200,
  };
  mock("https://example.com/", { method: "PATCH", response });

  const res = await twitch.patch<string, Res>(["https://example.com/", "token"], {arg: ""});
  expect(res).toEqual({hoge: "hoge"});
});

test("twtich.delete makes requests with DELETE method", async () => {
  const response = {
    data: { data: { hoge: "hoge"} },
    status: 200,
  };
  mock("https://example.com/", { method: "DELETE", response });

  const res = await twitch.delete<string, Res>(["https://example.com/", "token"], {arg: ""});
  expect(res).toEqual({hoge: "hoge"});
});
