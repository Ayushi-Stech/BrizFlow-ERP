import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";

const TONES: Record<string, string> = {
  ACTIVE: "bg-success/12 text-success border-success/25",
  CONFIRMED: "bg-success/12 text-success border-success/25",
  LEAD: "bg-warning/15 text-warning-foreground border-warning/35",
  DRAFT: "bg-warning/15 text-warning-foreground border-warning/35",
  INACTIVE: "bg-muted text-muted-foreground border-border",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/25",
  RETAIL: "bg-secondary text-secondary-foreground border-border",
  WHOLESALE: "bg-primary/10 text-primary border-primary/25",
  DISTRIBUTOR: "bg-accent text-accent-foreground border-primary/20",
  IN: "bg-success/12 text-success border-success/25",
  OUT: "bg-destructive/10 text-destructive border-destructive/25",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        TONES[value] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      {titleCase(value)}
    </span>
  );
}
