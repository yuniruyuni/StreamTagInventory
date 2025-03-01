import { expect, test } from "bun:test";
import { renderComponent, setupTestEnvironment } from "./test-utils";

// テスト環境のセットアップ
setupTestEnvironment();

// 簡単なテストコンポーネント
const TestComponent = () => <div>テスト</div>;

test("基本的なレンダリングテスト", () => {
  const root = renderComponent(<TestComponent />);
  expect(root.textContent).toBe("テスト");
});
