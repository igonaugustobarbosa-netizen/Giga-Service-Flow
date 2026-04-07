import * as React from "react";
import { cn } from "@/src/lib/utils";

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => {
    return (
      <label className={cn("relative inline-flex cursor-pointer items-center", className)}>
        <input
          type="checkbox"
          className="peer sr-only"
          ref={ref}
          {...props}
        />
        <div className="peer h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring peer-focus:ring-offset-2"></div>
        <div className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-background transition-transform peer-checked:translate-x-full"></div>
      </label>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
