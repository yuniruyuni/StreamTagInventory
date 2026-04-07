import clsx from "clsx";
import React from "react";

type CardProps = {
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>;

export const Card = React.forwardRef<HTMLElement, CardProps>(
  ({ className, children, ...rest }, ref) => {
    return (
      <article
        ref={ref}
        {...rest}
        className={clsx("card relative rounded-lg flex flex-col", className)}
      >
        {children}
      </article>
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
