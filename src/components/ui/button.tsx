import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const baseButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonVariantProps = VariantProps<typeof baseButtonVariants>;

/** Clase de color de fondo propia (`bg-…`, `hover:bg-…`): el botón respeta ese color. */
const OWN_BACKGROUND = /(^|[\s:])bg-/;

/**
 * Clases del botón. En la plataforma interna (bajo `.app-brand`) el primario sin color propio
 * lleva el degradado de marca del landing (`.btn-brand`, ver `components/app/identity.css`).
 */
function buttonVariants({
  className,
  ...props
}: ButtonVariantProps & { className?: string } = {}): string {
  const isPrimary = (props.variant ?? "default") === "default";
  const brand = isPrimary && !OWN_BACKGROUND.test(className ?? "");
  return cn(baseButtonVariants(props), brand && "btn-brand", className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={buttonVariants({ variant, size, className })} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
