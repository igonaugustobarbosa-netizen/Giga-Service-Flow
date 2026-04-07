import * as React from "react";
import { cn } from "@/src/lib/utils";

export function Tooltip({ children, content, className }: { children: React.ReactNode; content: string; className?: string }) {
  return (
    <div className={cn("group relative inline-block", className)}>
      {children}
      <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white group-hover:block">
        {content}
      </div>
    </div>
  );
}
