import clsx from "clsx";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { ANIMATION_DURATION, NOTIFICATION_DURATION } from "./constants";
import { useNotification } from "./context";
import type { NotificationProps } from "./types";

interface NotificationBannerProps {
  notification: NotificationProps;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notification,
}) => {
  const { removeNotification } = useNotification();
  const [isExiting, setIsExiting] = useState(false);

  // Handle the exit animation before removing
  const handleClose = useCallback(() => {
    setIsExiting(true);
    // Wait for the animation to complete before removing the notification
    setTimeout(() => {
      removeNotification(notification.id);
    }, 300);
  }, [notification.id, removeNotification]);

  // Create a progress bar effect for auto-close notifications
  useEffect(() => {
    if (notification.autoClose) {
      const timer = setTimeout(() => {
        handleClose();
      }, NOTIFICATION_DURATION - ANIMATION_DURATION); // Subtract animation time

      return () => clearTimeout(timer);
    }
  }, [notification.autoClose, handleClose]);

  // Get the appropriate styles based on notification type
  const getBannerStyles = () => {
    switch (notification.type) {
      case "success":
        return "bg-surface border-l-4 border-green-500 text-green-700";
      case "error":
        return "bg-surface border-l-4 border-red-500 text-red-700";
      case "warning":
        return "bg-surface border-l-4 border-yellow-500 text-yellow-700";
      case "info":
        return "bg-surface border-l-4 border-blue-500 text-blue-700";
      default:
        return "bg-surface border-l-4 border-gray-500 text-gray-700";
    }
  };

  // Get the appropriate icon based on notification type
  const getIcon = () => {
    switch (notification.type) {
      case "success":
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Success icon"
          >
            <title>Success</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case "error":
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Error icon"
          >
            <title>Error</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      case "warning":
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Warning icon"
          >
            <title>Warning</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      case "info":
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Information icon"
          >
            <title>Information</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={clsx(
        "max-w-sm w-full shadow-lg rounded-lg pointer-events-auto overflow-hidden transform transition-all",
        getBannerStyles(),
        isExiting ? "translate-x-full opacity-0" : "translate-x-0",
      )}
      style={{ transition: "all 0.3s ease-out" }}
      role="alert"
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">{getIcon()}</div>
          <div className="ml-3 w-0 flex-1">
            <p className="text-sm font-medium">{notification.title}</p>
            <p className="mt-1 text-sm">{notification.message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              type="button"
              className="rounded-md inline-flex text-text-subtle hover:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
              onClick={handleClose}
            >
              <span className="sr-only">Close</span>
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                role="img"
                aria-label="Close"
              >
                <title>Close</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {notification.autoClose && (
        <div className="bg-hover-bg h-1 w-full">
          <div
            className={clsx(
              "h-full animate-shrink",
              notification.type === "success" && "bg-green-500",
              notification.type === "error" && "bg-red-500",
              notification.type === "warning" && "bg-yellow-500",
              notification.type === "info" && "bg-blue-500",
            )}
            style={{
              animationDuration: `${NOTIFICATION_DURATION - ANIMATION_DURATION}ms`,
            }}
          />
        </div>
      )}
    </div>
  );
};
