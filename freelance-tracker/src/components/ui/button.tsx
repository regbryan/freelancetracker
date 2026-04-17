import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "text-white shadow-button hover:shadow-lg hover:-translate-y-[1px]",
        gradient: "text-white shadow-button hover:shadow-lg hover:-translate-y-[1px]",
        destructive: "text-white shadow-sm hover:shadow-md hover:-translate-y-[1px]",
        outline: "border border-border bg-surface shadow-sm hover:shadow-md hover:-translate-y-[1px]",
        secondary: "text-text-secondary shadow-sm hover:shadow-md hover:-translate-y-[1px]",
        ghost: "hover:bg-input-bg hover:text-text-primary",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2 rounded-[12px]",
        sm: "h-8 px-3 text-xs rounded-[10px]",
        lg: "h-12 px-8 rounded-[16px]",
        icon: "h-10 w-10 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

/* Subtle gradient backgrounds per variant */
const gradientStyles: Record<string, React.CSSProperties> = {
  default: {
    background: "linear-gradient(135deg, #305445 0%, #3e6b5a 60%, #5a8f7b 100%)",
  },
  gradient: {
    background: "linear-gradient(135deg, #305445 0%, #3e6b5a 60%, #5a8f7b 100%)",
  },
  destructive: {
    background: "linear-gradient(135deg, #ba1a1a 0%, #dc2626 60%, #ef4444 100%)",
  },
  outline: {
    background: "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)",
  },
  secondary: {
    background: "linear-gradient(180deg, #f8f9fa 0%, #eef0f3 100%)",
  },
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const variantKey = variant || "default"
    const mergedStyle = {
      ...(gradientStyles[variantKey] || {}),
      ...style,
    }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={mergedStyle}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
