import type { FC } from "react";
import { useTranslation } from "~/i18n";

type Props = {
  /** 下部テキストを差し替える場合。省略時は t("common.loading") */
  label?: string;
};

/**
 * 認証後の identity resolve 待ち等、短時間の全画面 loading 表示に使う。
 * Entrance と同じブランドタイトルを見せ、スピナー + 控えめな loading ラベルを添える。
 */
export const LoadingScreen: FC<Props> = ({ label }) => {
  const { t } = useTranslation();
  return (
    <main
      className="h-screen w-screen flex flex-col items-center justify-center bg-surface"
      role="status"
      aria-live="polite"
    >
      <h1 className="text-4xl font-bold">Stream Tag Inventory</h1>
      <div
        className="mt-8 h-8 w-8 rounded-full border-2 border-slate-200 border-t-sky-600 animate-spin"
        aria-hidden="true"
      />
      <p className="mt-4 text-sm text-slate-500">
        {label ?? t("common.loading")}
      </p>
    </main>
  );
};
