import { afterEach, expect, test } from "bun:test";
import { clearMocks, mock } from "bun-bagel";
import { CLIENT_ID } from "./constant";
import { dep, TwitchError, twitch } from "./fetcher";

type Res = {
  hoge: string;
};

afterEach(() => {
  clearMocks();
});

const headers = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "Accept-Language": "en",
  Authorization: "Bearer token",
  "Client-Id": CLIENT_ID,
};

test("TwitchError exports status code", () => {
  const val = new TwitchError("error", 401, "message");
  expect(val.status).toBe(401);
});

test("twtich.get makes requests with GET method", async () => {
  const response = {
    data: { data: { hoge: "hoge" } },
    status: 200,
  };
  mock("https://example.com/", { method: "GET", headers, response });

  const res = await twitch.get<Res>(["https://example.com/", "token", "en"]);
  expect(res).toEqual({ hoge: "hoge" });
});

test("error response on fetchers throws TwitchError", async () => {
  const response = {
    data: { error: { hoge: "hoge" } },
    status: 200,
  };
  mock("https://example.com/", { method: "GET", headers, response });

  expect(
    async () => await twitch.get<Res>(["https://example.com/", "token", "en"]),
  ).toThrowError(TwitchError);
});

test("error status on fetchers throws TwitchError", async () => {
  const response = {
    data: { data: { hoge: "hoge" } },
    status: 401,
  };
  mock("https://example.com/", { method: "GET", headers, response });

  expect(
    async () => await twitch.get<Res>(["https://example.com/", "token", "en"]),
  ).toThrowError(TwitchError);
});

test("twtich.post makes requests with POST method", async () => {
  const response = {
    data: { data: { hoge: "hoge" } },
    status: 200,
  };
  mock("https://example.com/", { method: "POST", headers, response });

  const res = await twitch.post<string, Res>(
    ["https://example.com/", "token", "en"],
    { arg: "" },
  );
  expect(res).toEqual({ hoge: "hoge" });
});

test("twtich.put makes requests with PUT method", async () => {
  const response = {
    data: { data: { hoge: "hoge" } },
    status: 200,
  };
  mock("https://example.com/", { method: "PUT", headers, response });

  const res = await twitch.put<string, Res>(["https://example.com/", "token", "en"], {
    arg: "",
  });
  expect(res).toEqual({ hoge: "hoge" });
});

test("twtich.patch makes requests with PATCH method", async () => {
  const response = {
    data: { data: { hoge: "hoge" } },
    status: 200,
  };
  mock("https://example.com/", { method: "PATCH", headers, response });

  const res = await twitch.patch<string, Res>(
    ["https://example.com/", "token", "en"],
    { arg: "" },
  );
  expect(res).toEqual({ hoge: "hoge" });
});

test("twtich.delete makes requests with DELETE method", async () => {
  const response = {
    data: { data: { hoge: "hoge" } },
    status: 200,
  };
  mock("https://example.com/", { method: "DELETE", headers, response });

  const res = await twitch.delete<string, Res>(
    ["https://example.com/", "token", "en"],
    { arg: "" },
  );
  expect(res).toEqual({ hoge: "hoge" });
});

test("dep expand templates", () => {
  const val1 = 123;
  const val2 = 456;
  expect(dep`https://example.com/${val1}/${val2}`).toBe(
    "https://example.com/123/456",
  );
});

test("dep throws exceptions for undefined values", () => {
  const val = undefined;
  expect(() => dep`https://example.com/${val}`).toThrowError(
    "undefined parameter is assigned so skip request",
  );
});

test("dep throws exceptions for null values", () => {
  const val = null;
  expect(() => dep`https://example.com/${val}`).toThrowError(
    "null parameter is assigned so skip request",
  );
});
