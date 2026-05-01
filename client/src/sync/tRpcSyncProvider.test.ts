import { describe, expect, test } from "bun:test";
import * as Y from "yjs";
import {
  createTemplateDoc,
  fromBase64,
  getTemplatesArray,
  templateToYMap,
  toBase64,
  yMapToTemplate,
} from "./templateDoc";
import { type SyncMutator, TRpcSyncProvider } from "./tRpcSyncProvider";

const T1 = {
  id: "t1",
  title: "First",
  category: { id: "1", name: "Cat A", box_art_url: "" },
  tags: ["a"],
};

const T2 = {
  id: "t2",
  title: "Second",
  category: { id: "2", name: "Cat B", box_art_url: "" },
  tags: ["b"],
};

/**
 * server を Y.Doc 1 つでエミュレートする mock。clientUpdate を server doc に
 * apply、server state vector に対する diff を serverUpdate として返す。
 */
function makeServerMock() {
  const serverDoc = createTemplateDoc();
  const calls: Array<{ csv: Uint8Array; cup?: Uint8Array }> = [];
  const sync: SyncMutator = {
    async mutate({ clientStateVector, clientUpdate }) {
      const csv = fromBase64(clientStateVector);
      const cup = clientUpdate ? fromBase64(clientUpdate) : undefined;
      calls.push({ csv, cup });
      if (cup && cup.byteLength > 0) {
        Y.applyUpdate(serverDoc, cup);
      }
      const serverDiff = Y.encodeStateAsUpdate(serverDoc, csv);
      return {
        serverUpdate: toBase64(serverDiff),
        serverStateVector: toBase64(Y.encodeStateVector(serverDoc)),
      };
    },
  };
  return { sync, serverDoc, calls };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe("TRpcSyncProvider", () => {
  test("constructor triggers initial sync (push existing local state)", async () => {
    const doc = createTemplateDoc();
    getTemplatesArray(doc).push([templateToYMap(T1)]);

    const { sync, serverDoc, calls } = makeServerMock();
    const provider = new TRpcSyncProvider({
      doc,
      sync,
      enableBackgroundTriggers: false,
    });

    await flushMicrotasks();
    await flushMicrotasks();

    expect(calls.length).toBe(1);
    const arr = getTemplatesArray(serverDoc);
    expect(arr.length).toBe(1);
    expect(yMapToTemplate(arr.get(0))).toEqual(T1);

    provider.destroy();
  });

  test("local update fires sync (after debounce) and server receives it", async () => {
    const doc = createTemplateDoc();
    const { sync, serverDoc } = makeServerMock();
    const provider = new TRpcSyncProvider({
      doc,
      sync,
      enableBackgroundTriggers: false,
      debounceMs: 5,
    });

    // Wait for initial sync
    await flushMicrotasks();
    await flushMicrotasks();

    getTemplatesArray(doc).push([templateToYMap(T2)]);

    // Wait for debounced sync
    await new Promise((r) => setTimeout(r, 30));

    expect(yMapToTemplate(getTemplatesArray(serverDoc).get(0))).toEqual(T2);

    provider.destroy();
  });

  test("reports syncing and synced status", async () => {
    const doc = createTemplateDoc();
    const { sync } = makeServerMock();
    const statuses: string[] = [];
    const provider = new TRpcSyncProvider({
      doc,
      sync,
      enableBackgroundTriggers: false,
      onStatusChange: (status, lastSyncedAt) => {
        statuses.push(`${status}:${lastSyncedAt ? "set" : "empty"}`);
      },
    });

    await flushMicrotasks();

    expect(statuses).toEqual(["syncing:empty", "synced:set"]);
    provider.destroy();
  });

  test("local update during an in-flight sync is sent by a follow-up sync", async () => {
    const doc = createTemplateDoc();
    const serverDoc = createTemplateDoc();
    let releaseFirstSync: (() => void) | undefined;
    const calls: Array<{ cup?: Uint8Array }> = [];
    const sync: SyncMutator = {
      async mutate({ clientStateVector, clientUpdate }) {
        const csv = fromBase64(clientStateVector);
        const cup = clientUpdate ? fromBase64(clientUpdate) : undefined;
        calls.push({ cup });
        if (calls.length === 1) {
          await new Promise<void>((resolve) => {
            releaseFirstSync = resolve;
          });
        }
        if (cup && cup.byteLength > 0) Y.applyUpdate(serverDoc, cup);
        return {
          serverUpdate: toBase64(Y.encodeStateAsUpdate(serverDoc, csv)),
          serverStateVector: toBase64(Y.encodeStateVector(serverDoc)),
        };
      },
    };

    const provider = new TRpcSyncProvider({
      doc,
      sync,
      enableBackgroundTriggers: false,
      debounceMs: 1,
    });

    await flushMicrotasks();
    getTemplatesArray(doc).push([templateToYMap(T1)]);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls.length).toBe(1);

    releaseFirstSync?.();
    await new Promise((r) => setTimeout(r, 30));

    expect(calls.length).toBe(2);
    expect(yMapToTemplate(getTemplatesArray(serverDoc).get(0))).toEqual(T1);

    provider.destroy();
  });

  test("server-side state propagates back to client on next sync", async () => {
    // 別 client が先に T1 を push 済の状況をエミュレート
    const { sync, serverDoc } = makeServerMock();
    getTemplatesArray(serverDoc).push([templateToYMap(T1)]);

    const doc = createTemplateDoc();
    const provider = new TRpcSyncProvider({
      doc,
      sync,
      enableBackgroundTriggers: false,
    });

    // 初回 sync が走り終わるまで待つ
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();

    const arr = getTemplatesArray(doc);
    expect(arr.length).toBe(1);
    expect(yMapToTemplate(arr.get(0))).toEqual(T1);

    provider.destroy();
  });

  test("REMOTE_ORIGIN update does not trigger another sync (no echo loop)", async () => {
    const { sync, serverDoc, calls } = makeServerMock();
    getTemplatesArray(serverDoc).push([templateToYMap(T1)]);

    const doc = createTemplateDoc();
    const provider = new TRpcSyncProvider({
      doc,
      sync,
      enableBackgroundTriggers: false,
      debounceMs: 5,
    });

    // 初回 sync で server diff を受け取る (= remote update が doc に当たる)
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();

    // この時点で initial sync 1 回のみ走っているはず。debounce 待ってもう 1 回 sync が
    // 走らないことを確認する (= remote origin update が echo loop していない)
    const callsAfterInitial = calls.length;
    await new Promise((r) => setTimeout(r, 30));
    expect(calls.length).toBe(callsAfterInitial);

    provider.destroy();
  });

  test("destroy stops listening to local updates", async () => {
    const doc = createTemplateDoc();
    const { sync, calls } = makeServerMock();
    const provider = new TRpcSyncProvider({
      doc,
      sync,
      enableBackgroundTriggers: false,
      debounceMs: 5,
    });

    await flushMicrotasks();
    await flushMicrotasks();
    const beforeDestroy = calls.length;

    provider.destroy();

    getTemplatesArray(doc).push([templateToYMap(T1)]);
    await new Promise((r) => setTimeout(r, 30));

    expect(calls.length).toBe(beforeDestroy);
  });

  test("onError is called when mutate rejects, sync state recovers for next call", async () => {
    let shouldFail = true;
    const errors: unknown[] = [];
    const sync: SyncMutator = {
      async mutate() {
        if (shouldFail) throw new Error("boom");
        return { serverUpdate: "", serverStateVector: "" };
      },
    };
    const doc = createTemplateDoc();
    const provider = new TRpcSyncProvider({
      doc,
      sync,
      onError: (e) => errors.push(e),
      enableBackgroundTriggers: false,
    });

    await flushMicrotasks();
    await flushMicrotasks();
    expect(errors.length).toBe(1);

    // 次のトリガーで自動リカバリ (pending フラグが leak していないことの確認)
    shouldFail = false;
    await provider.sync();
    expect(errors.length).toBe(1); // no new error

    provider.destroy();
  });
});
