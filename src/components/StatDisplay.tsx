import React from "react";
import { cn } from "@/lib/utils";

interface StatDisplayProps {
  icon?: string | React.ReactNode; // emoji string or React element (like Lucide icon)
  label?: string; // optional label, e.g., "Cash"
  value: string | number;
  className?: string;
  iconClassName?: string;
}

/**
 * Display a stat with optional icon, label, and value
 * Used throughout the UI for showing game stats like cash, fans, wins/losses
 */
function StatDisplay({
  icon,
  label,
  value,
  className,
  iconClassName,
}: StatDisplayProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-sm font-medium text-foreground",
        className
      )}
    >
      {icon && (
        <span
          className={cn(
            "inline-flex items-center justify-center text-base leading-none",
            iconClassName
          )}
        >
          {icon}
        </span>
      )}
      <span>
        {label && <span className="text-muted-foreground">{label} </span>}
        {value}
      </span>
    </div>
  );
}

export { StatDisplay };
