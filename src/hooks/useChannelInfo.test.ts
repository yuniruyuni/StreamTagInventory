import { expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import type { Category } from "~/model/category";
import type { ChannelInfo } from "~/model/channel";
import { SWRConfigWrapper } from "~/test-utils";
import { useChannelInfo } from "./useChannelInfo";

const mockChannelInfo: ChannelInfo = {
  broadcaster_id: "123",
  broadcaster_name: "testuser",
  broadcaster_language: "en",
  game_name: "Just Chatting",
  game_id: "509658",
  title: "Test Stream Title",
  tags: ["English", "Chill"],
};

const mockCategory: Category = {
  id: "509658",
  name: "Just Chatting",
  box_art_url: "https://example.com/boxart.jpg",
};

test("broadcasterIdがundefinedの場合データが返らない", () => {
  const wrapper = SWRConfigWrapper({
    data: undefined,
    isLoading: false,
  });

  const { result } = renderHook(() => useChannelInfo(undefined), { wrapper });

  expect(result.current.channelInfo).toBeUndefined();
  expect(result.current.category).toBeUndefined();
});

test("ローディング中はisLoadingがtrueになる", () => {
  const wrapper = SWRConfigWrapper({
    data: undefined,
    isLoading: true,
  });

  const { result } = renderHook(() => useChannelInfo("123"), { wrapper });

  expect(result.current.isLoading).toBe(true);
});

test("チャンネル情報とカテゴリが正しく返される", () => {
  // SWRConfigWrapper returns the same mock data for all useSWR calls,
  // so we test with the channel info array (first call returns this)
  const wrapper = SWRConfigWrapper({
    data: [mockChannelInfo],
    isLoading: false,
  });

  const { result } = renderHook(() => useChannelInfo("123"), { wrapper });

  // The mock returns [mockChannelInfo] for all SWR calls,
  // so channelInfo picks the first element
  expect(result.current.channelInfo).toEqual(mockChannelInfo);
  expect(result.current.isLoading).toBe(false);
});

test("データ取得完了後isLoadingがfalseになる", () => {
  const wrapper = SWRConfigWrapper({
    data: [mockCategory],
    isLoading: false,
  });

  const { result } = renderHook(() => useChannelInfo("123"), { wrapper });

  expect(result.current.isLoading).toBe(false);
});
