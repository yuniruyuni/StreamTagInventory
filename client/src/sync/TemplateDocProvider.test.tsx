import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { act, render, waitFor } from "@testing-library/react";
import { type ReactNode, useContext } from "react";
import type * as Y from "yjs";
import { TwitchAuthContext } from "~/TwitchAuth";
import type { TemplateDocContextValue } from "./TemplateDocContext";
import { TemplateDocContext } from "./TemplateDocContext";

interface MockPersistence {
  namespace: string;
  doc: Y.Doc;
  whenSynced: Promise<void>;
  resolve: () => void;
  destroy: ReturnType<typeof mock>;
}

interface MockSyncProvider {
  opts: { doc: Y.Doc };
  destroy: ReturnType<typeof mock>;
}

const persistenceInstances: MockPersistence[] = [];
const syncProviderInstances: MockSyncProvider[] = [];

mock.module("y-indexeddb", () => {
  return {
    IndexeddbPersistence: class implements MockPersistence {
      namespace: string;
      doc: Y.Doc;
      whenSynced: Promise<void>;
      resolve!: () => void;
      destroy = mock(() => {});

      constructor(namespace: string, doc: Y.Doc) {
        this.namespace = namespace;
        this.doc = doc;
        this.whenSynced = new Promise<void>((resolve) => {
          this.resolve = resolve;
        });
        persistenceInstances.push(this);
      }
    },
  };
});

mock.module("./tRpcSyncProvider", () => {
  return {
    TRpcSyncProvider: class implements MockSyncProvider {
      opts: { doc: Y.Doc };
      destroy = mock(() => {});

      constructor(opts: { doc: Y.Doc }) {
        this.opts = opts;
        syncProviderInstances.push(this);
      }
    },
  };
});

mock.module("~/trpc/client", () => {
  return {
    trpc: {
      useUtils: () => ({
        client: {
          templates: {
            sync: {
              mutate: mock(async () => ({
                serverUpdate: "",
                serverStateVector: "",
              })),
            },
          },
        },
      }),
    },
  };
});

const USER = {
  id: "u1",
  twitchUserId: "tw-u1",
  login: "user1",
  displayName: "User 1",
};

const originalIndexedDB = window.indexedDB;

beforeEach(() => {
  persistenceInstances.length = 0;
  syncProviderInstances.length = 0;
  Object.defineProperty(window, "indexedDB", {
    configurable: true,
    value: {},
  });
});

afterEach(() => {
  Object.defineProperty(window, "indexedDB", {
    configurable: true,
    value: originalIndexedDB,
  });
});

function renderProvider(children: ReactNode) {
  const { TemplateDocProvider } =
    require("./TemplateDocProvider") as typeof import("./TemplateDocProvider");

  return render(
    <TwitchAuthContext.Provider
      value={{
        token: "token",
        user: USER,
        logout: async () => {},
      }}
    >
      <TemplateDocProvider>{children}</TemplateDocProvider>
    </TwitchAuthContext.Provider>,
  );
}

function Probe() {
  const value = useContext(TemplateDocContext);
  return (
    <output data-ready={String(value.isReady)} data-status={value.syncStatus}>
      {formatValue(value)}
    </output>
  );
}

function formatValue(value: TemplateDocContextValue): string {
  if (!value.doc) return "no-doc";
  return value.isReady ? "ready" : "loading";
}

test("waits for IndexedDB restore before starting remote sync", async () => {
  const { getByText } = renderProvider(<Probe />);

  await waitFor(() => expect(persistenceInstances).toHaveLength(1));
  expect(persistenceInstances[0].namespace).toBe("templates:u1");
  expect(getByText("loading")).toHaveAttribute("data-ready", "false");
  expect(syncProviderInstances).toHaveLength(0);

  await act(async () => {
    persistenceInstances[0].resolve();
    await Promise.resolve();
  });

  await waitFor(() =>
    expect(getByText("ready")).toHaveAttribute("data-ready", "true"),
  );
  expect(syncProviderInstances).toHaveLength(1);
  expect(syncProviderInstances[0].opts.doc).toBe(persistenceInstances[0].doc);
});

test("does not start remote sync after unmount during IndexedDB restore", async () => {
  const { unmount } = renderProvider(<Probe />);

  await waitFor(() => expect(persistenceInstances).toHaveLength(1));
  const persistence = persistenceInstances[0];
  unmount();

  await act(async () => {
    persistence.resolve();
    await Promise.resolve();
  });

  expect(persistence.destroy).toHaveBeenCalledTimes(1);
  expect(syncProviderInstances).toHaveLength(0);
});
