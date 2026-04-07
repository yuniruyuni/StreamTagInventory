import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { ulid } from "ulid";
import { NOTIFICATION_DURATION } from "./constants";
import type { NotificationContextType, NotificationProps } from "./types";

// Create the notification context with default values
const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  addNotification: () => "",
  removeNotification: () => {},
  clearNotifications: () => {},
});

export const useNotification = () => useContext(NotificationContext);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prevNotifications) =>
      prevNotifications.filter((notification) => notification.id !== id),
    );
  }, []);

  const addNotification = useCallback(
    (notification: Omit<NotificationProps, "id">) => {
      const id = ulid();
      const newNotification: NotificationProps = {
        ...notification,
        id,
        autoClose: notification.autoClose ?? true,
      };

      setNotifications((prevNotifications) => [
        ...prevNotifications,
        newNotification,
      ]);

      // Auto-close notification if enabled
      if (newNotification.autoClose) {
        setTimeout(() => {
          removeNotification(id);
        }, NOTIFICATION_DURATION);
      }

      return id;
    },
    [removeNotification],
  );

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
