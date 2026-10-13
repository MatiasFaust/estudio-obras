"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: React.ReactNode;
}

/** Select con lista de opciones simple (valor "" = sin selección) */
export function SimpleSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar",
  className,
  id,
  disabled,
  "aria-invalid": invalid,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Select
      value={value === "" ? null : value}
      onValueChange={(v) => onChange((v as string | null) ?? "")}
      items={options}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("w-full", className)} aria-invalid={invalid} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
