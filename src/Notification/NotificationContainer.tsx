import type React from "react";
import { NotificationBanner } from "./NotificationBanner";
import { useNotification } from "./context";

export const NotificationContainer: React.FC = () => {
  const { notifications } = useNotification();

  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 flex flex-col items-end px-4 py-6 pointer-events-none sm:p-6 z-50"
      style={{ gap: "0.5rem" }}
    >
      <div className="flex flex-col items-center space-y-4 w-full sm:items-end">
        {notifications.map((notification) => (
          <NotificationBanner
            key={notification.id}
            notification={notification}
          />
        ))}
      </div>
    </div>
  );
};
