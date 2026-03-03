import { useContext } from "react";
import useSWR from "swr";
import { dep, twitch } from "~/fetcher";
import { useTranslation } from "~/i18n";
import type { Category } from "~/model/category";
import type { ChannelInfo } from "~/model/channel";
import { TwitchAuthContext } from "~/TwitchAuth";

type UseChannelInfoResult = {
  channelInfo: ChannelInfo | undefined;
  category: Category | undefined;
  isLoading: boolean;
};

export const useChannelInfo = (
  broadcasterId: string | undefined,
): UseChannelInfoResult => {
  const { i18n } = useTranslation();
  const { token } = useContext(TwitchAuthContext);

  const { data: channels, isLoading: isChannelLoading } = useSWR(
    () => [
      dep`https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`,
      token,
      i18n.language,
    ],
    twitch.get<ChannelInfo[]>,
  );

  const channelInfo = channels?.[0];

  const { data: games, isLoading: isGameLoading } = useSWR(
    () => [
      dep`https://api.twitch.tv/helix/games?id=${channelInfo?.game_id !== "" ? channelInfo?.game_id : undefined}`,
      token,
      i18n.language,
    ],
    twitch.get<Category[]>,
  );

  const category = games?.[0];

  return {
    channelInfo,
    category,
    isLoading: isChannelLoading || isGameLoading,
  };
};
