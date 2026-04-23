import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import type React from "react";
import { useEffect, useRef } from "react";
import { NotificationProvider, useNotification } from "./context";
import { NotificationBanner } from "./NotificationBanner";
import type { NotificationProps, NotificationType } from "./types";

const baseProps = (
  overrides: Partial<NotificationProps> = {},
): NotificationProps => ({
  id: "n1",
  type: "info",
  title: "Title",
  message: "Message body",
  autoClose: false,
  ...overrides,
});

const renderInProvider = (notification: NotificationProps) =>
  render(
    <NotificationProvider>
      <NotificationBanner notification={notification} />
    </NotificationProvider>,
  );

describe("NotificationBanner", () => {
  test("renders title, message, and role=alert", () => {
    const { getByRole, getByText } = renderInProvider(
      baseProps({ title: "Hello", message: "world" }),
    );
    expect(getByRole("alert")).toBeInTheDocument();
    expect(getByText("Hello")).toBeInTheDocument();
    expect(getByText("world")).toBeInTheDocument();
  });

  test.each<{ type: NotificationType; iconTitle: string }>([
    { type: "success", iconTitle: "Success" },
    { type: "error", iconTitle: "Error" },
    { type: "warning", iconTitle: "Warning" },
    { type: "info", iconTitle: "Information" },
  ])("renders correct icon for type=$type", ({ type, iconTitle }) => {
    const { getByText } = renderInProvider(baseProps({ type }));
    expect(getByText(iconTitle)).toBeInTheDocument();
  });

  test("renders progress bar when autoClose is true", () => {
    const { container } = renderInProvider(baseProps({ autoClose: true }));
    expect(container.querySelector(".animate-shrink")).not.toBeNull();
  });

  test("does NOT render progress bar when autoClose is false", () => {
    const { container } = renderInProvider(baseProps({ autoClose: false }));
    expect(container.querySelector(".animate-shrink")).toBeNull();
  });

  test("close button triggers exit animation (adds translate-x-full class)", () => {
    const { getByRole } = renderInProvider(baseProps({ autoClose: false }));
    const alert = getByRole("alert");
    expect(alert.className).not.toMatch(/translate-x-full/);

    // alert 内に button は 1 つしかないため role だけで一意
    fireEvent.click(getByRole("button"));

    expect(alert.className).toMatch(/translate-x-full/);
    expect(alert.className).toMatch(/opacity-0/);
  });

  test("close button eventually removes notification from provider state", async () => {
    const seen: { ids: string[] } = { ids: [] };
    const Probe: React.FC = () => {
      const { notifications } = useNotification();
      seen.ids = notifications.map((n) => n.id);
      return null;
    };

    /**
     * NotificationBanner は props の notification を描画し、removeNotification
     * に id を渡して消す構造。Harness で useNotification.addNotification を 1 回
     * 呼び、state 側に同じ id の notification を積んでおく。
     * render-phase に setState するのは違反なので useEffect でマウント後に実行。
     */
    const Harness: React.FC = () => {
      const { addNotification, notifications } = useNotification();
      // 厳密に 1 回だけ add する (remove → 0 → useEffect 再発火による再 add を防ぐ)
      const addedRef = useRef(false);
      useEffect(() => {
        if (addedRef.current) return;
        addedRef.current = true;
        addNotification({
          type: "info",
          title: "T",
          message: "M",
          autoClose: false,
        });
      }, [addNotification]);
      const n = notifications[0];
      return n ? <NotificationBanner notification={n} /> : null;
    };

    const { getByRole, queryByRole } = render(
      <NotificationProvider>
        <Harness />
        <Probe />
      </NotificationProvider>,
    );

    // useEffect の tick を待って notification が積まれるのを見届ける
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen.ids.length).toBe(1);
    expect(queryByRole("alert")).not.toBeNull();

    fireEvent.click(getByRole("button"));

    // handleClose は setTimeout(..., 300) で removeNotification を呼ぶ
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(seen.ids.length).toBe(0);
  });

  test("autoClose schedules removal via setTimeout (verified by mocking setTimeout)", () => {
    const originalSetTimeout = globalThis.setTimeout;
    const calls: Array<{ delay: number; fn: () => void }> = [];
    const fakeSetTimeout = mock(
      (fn: () => void, delay: number): ReturnType<typeof setTimeout> => {
        calls.push({ delay, fn });
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
    );
    globalThis.setTimeout = fakeSetTimeout as unknown as typeof setTimeout;

    try {
      renderInProvider(baseProps({ autoClose: true }));
      // useEffect で NOTIFICATION_DURATION - ANIMATION_DURATION = 4700ms が登録される
      expect(calls.some((c) => c.delay === 4700)).toBe(true);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });
});
