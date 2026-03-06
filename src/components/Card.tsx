import clsx from "clsx";
import React from "react";

type CardProps = {
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        data-testid="template-card"
        {...rest}
        className={clsx("card relative rounded-lg flex flex-col", className)}
      >
        {children}
      </div>
    );
  },
);

type CardBodyProps = {
  className?: string;
  children: React.ReactNode;
};

export const CardBody: React.FC<CardBodyProps> = ({ className, children }) => {
  return (
    <div
      className={clsx("p-6 flex flex-col flex-auto gap-2 text-sm", className)}
    >
      {children}
    </div>
  );
};

type CardActionsProps = {
  className?: string;
  children: React.ReactNode;
};

export const CardActions: React.FC<CardActionsProps> = ({
  className,
  children,
}) => {
  return (
    <div className={clsx("flex items-center gap-2", className)}>{children}</div>
  );
};
