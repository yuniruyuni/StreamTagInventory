import { expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { TwitchAuthContext } from "./context";

test("TwitchAuthContext defaults are sensible", () => {
  expect(TwitchAuthContext).toBeDefined();

  const TestComponent = () => {
    const authContext = React.useContext(TwitchAuthContext);
    return (
      <div>
        <span data-testid="token">{authContext.token}</span>
        <span data-testid="user">{authContext.user?.login ?? "no-user"}</span>
        <button type="button" onClick={() => authContext.logout()}>
          Logout
        </button>
      </div>
    );
  };

  const { getByTestId, getByRole } = render(<TestComponent />);

  expect(getByTestId("token").textContent).toBe("");
  expect(getByTestId("user").textContent).toBe("no-user");
  const button = getByRole("button", { name: "Logout" });
  expect(button).not.toBeNull();
  // default logout は no-op。click で throw しないことだけ確認。
  expect(() => fireEvent.click(button)).not.toThrow();
});
