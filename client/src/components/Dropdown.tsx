import clsx from "clsx";
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type DropdownProps = {
  align?: "end" | "start";
  children: React.ReactNode;
  className?: string;
};

const DropdownContext = React.createContext<{
  forceClosed: boolean;
}>({
  forceClosed: false,
});

export const Dropdown: React.FC<DropdownProps> = ({
  align = "start",
  children,
  className,
}) => {
  const [forceClosed, setForceClosed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const focusTrigger = useCallback(() => {
    const trigger = rootRef.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    trigger?.focus();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handleFocusOut = (event: FocusEvent) => {
      if (!root.contains(event.relatedTarget as Node | null)) {
        setForceClosed(false);
      }
    };
    const handleClick = () => setForceClosed(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setForceClosed(true);
        focusTrigger();
      } else if (event.key === "Enter" || event.key === " ") {
        setForceClosed(false);
      }
    };

    root.addEventListener("focusout", handleFocusOut);
    root.addEventListener("click", handleClick, { capture: true });
    root.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      root.removeEventListener("focusout", handleFocusOut);
      root.removeEventListener("click", handleClick, { capture: true });
      root.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [focusTrigger]);

  return (
    <DropdownContext.Provider value={{ forceClosed }}>
      <div
        ref={rootRef}
        className={clsx(
          "relative",
          align === "end" && "[&>:nth-child(2)]:right-0",
          className,
        )}
      >
        {children}
      </div>
    </DropdownContext.Provider>
  );
};

type DropdownContentProps = {
  children: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">;

export const DropdownContent: React.FC<DropdownContentProps> = ({
  children,
  className,
  style,
  ...rest
}) => {
  const { forceClosed } = useContext(DropdownContext);

  return (
    <div
      {...rest}
      style={{ ...style, display: forceClosed ? "none" : style?.display }}
      className={clsx(
        "dropdown-content absolute z-[1] hidden [*:focus-within>&]:block",
        className,
      )}
    >
      {children}
    </div>
  );
};
