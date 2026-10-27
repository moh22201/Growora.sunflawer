import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const btn = cva(
  "inline-flex items-center justify-center gap-1.5 font-display uppercase tracking-tight border-2 border-wood-dark rounded-[5px] border-b-[5px] active:border-b-2 active:translate-y-[3px] transition-transform disabled:opacity-50 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        gold: "bg-primary text-primary-foreground hover:brightness-105",
        green: "bg-accent text-accent-foreground hover:brightness-105",
        blue: "bg-secondary text-secondary-foreground hover:brightness-105",
        wood: "bg-wood text-hud-foreground hover:brightness-110",
        danger: "bg-destructive text-destructive-foreground",
        ghost: "bg-muted text-card-foreground",
      },
      size: { sm: "text-[8px] px-2 py-1.5", md: "text-[10px] px-3 py-2", lg: "text-xs px-4 py-3" },
    },
    defaultVariants: { variant: "gold", size: "md" },
  },
);

export function PixelButton({ className, variant, size, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof btn>) {
  return <button className={cn(btn({ variant, size }), className)} {...p} />;
}

export function Sheet({ title, onClose, children, icon }: { title: string; onClose: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-2 sm:inset-y-0 sm:left-auto sm:right-0 sm:items-center">
      <div className="pixel-frame pointer-events-auto flex max-h-[58vh] w-full flex-col bg-card text-card-foreground animate-in fade-in slide-in-from-bottom-4 sm:max-h-[88%] sm:w-[420px]">
        <div className="flex items-center gap-2 border-b-2 border-wood bg-wood px-3 py-2 text-hud-foreground">
          {icon}
          <h2 className="flex-1 font-display text-[11px] leading-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-wood-dark">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-3 text-[15px]">{children}</div>
      </div>
    </div>
  );
}

export function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn("h-3 w-full overflow-hidden rounded-sm border-2 border-wood-dark bg-wood-dark/30", className)}>
      <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.min(100, pct * 100)}%` }} />
    </div>
  );
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("pixel-inset flex items-center gap-2 bg-muted/60 p-2", className)}>{children}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <PixelButton key={i.id} size="sm" variant={value === i.id ? "gold" : "ghost"} onClick={() => onChange(i.id)}>
          {i.label}
        </PixelButton>
      ))}
    </div>
  );
}

export function Field({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input {...p} className="pixel-inset w-full bg-input px-2 py-1.5 text-card-foreground outline-none focus:border-primary" />
    </label>
  );
}

export function DemoNote({ children }: { children: ReactNode }) {
  return <p className="rounded border-2 border-dashed border-wood bg-primary/20 px-2 py-1.5 text-sm">{children}</p>;
}
