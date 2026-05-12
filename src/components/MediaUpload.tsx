import { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadClientMedia } from "@/lib/uploadMedia";
import { toast } from "sonner";

export function MediaUpload({
  clientId,
  value,
  onChange,
  shape = "square",
  showUrl = true,
  placeholder = "URL o sube imagen",
}: {
  clientId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  shape?: "square" | "circle";
  showUrl?: boolean;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadClientMedia(file, clientId);
      onChange(url);
    } catch (e: any) {
      toast.error(e.message ?? "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div
          className={`relative bg-muted overflow-hidden flex-shrink-0 ${
            shape === "circle" ? "rounded-full w-16 h-16" : "rounded-lg w-20 h-20"
          }`}
        >
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Upload className="w-4 h-4" />
            </div>
          )}
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
              aria-label="Quitar"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Subiendo…</>
            ) : (
              <><Upload className="w-3 h-3 mr-1" /> Subir imagen</>
            )}
          </Button>
          {showUrl && (
            <Input
              placeholder={placeholder}
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value || null)}
              className="text-xs h-8"
            />
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
