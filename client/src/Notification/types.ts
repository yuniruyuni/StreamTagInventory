export type NotificationType = "success" | "error" | "info" | "warning";

export interface NotificationProps {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  autoClose?: boolean;
}

export interface NotificationContextType {
  notifications: NotificationProps[];
  addNotification: (notification: Omit<NotificationProps, "id">) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}
