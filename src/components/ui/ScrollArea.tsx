import * as React from "react";
import { cn } from "@/src/lib/utils";

export function ScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-auto", className)}>
      {children}
    </div>
  );
}
