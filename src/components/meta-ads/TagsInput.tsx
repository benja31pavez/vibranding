import { useState } from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

export function TagsInput({
  value, onChange, placeholder,
}: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setText("");
  };
  return (
    <div className="rounded-md border bg-transparent p-2 space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
              {t}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder ?? "Escribe y presiona Enter"}
        className="h-8 border-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
