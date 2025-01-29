import clsx from "clsx";
import { createCallable } from 'react-call';

type Props = {
  title: string;
  message: string;
};
type Response = undefined;

export const ErrorNotification = createCallable<Props, Response>(({ call, title, message }) => (
  <div role="dialog" className={clsx("z-40 fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center")}>
    <div className="max-w-prose ml-16 mr-16 bg-white p-4 rounded-lg">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="whitespace-pre-wrap break-words">{message}</div>
      <button
        type="button"
        className="block mx-auto mt-4 btn btn-primary"
        onClick={() => call.end(undefined)}
      >Close</button>
    </div>
  </div>
))
