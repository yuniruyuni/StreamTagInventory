import { expect, test } from "bun:test";
import { render } from "@testing-library/react";

// 簡単なテストコンポーネント
const TestComponent = () => <div>テスト</div>;

test("基本的なレンダリングテスト", () => {
  const { container } = render(<TestComponent />);
  expect(container.textContent).toBe("テスト");
});
