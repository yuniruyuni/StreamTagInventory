import clsx from "clsx";
import { createCallable } from "react-call";
import { Button } from "~/components/Button";
import { useTranslation } from "~/i18n";

type Props = {
  title: string;
  message: string;
};
type Response = undefined;

export const ErrorNotification = createCallable<Props, Response>(
  ({ call, title, message }) => {
    const { t } = useTranslation();
    return (
      <dialog
        open
        className={clsx(
          "z-40 fixed inset-0 bg-slate-950/50 flex items-center justify-center",
        )}
      >
        <div className="max-w-prose ml-16 mr-16 bg-white p-4 rounded-lg">
          <h2 className="text-xl font-bold">{title}</h2>
          <div className="whitespace-pre-wrap break-words">{message}</div>
          <Button
            type="button"
            variant="primary"
            className="block mx-auto mt-4"
            onClick={() => call.end(undefined)}
          >
            {t("common.close")}
          </Button>
        </div>
      </dialog>
    );
  },
);
