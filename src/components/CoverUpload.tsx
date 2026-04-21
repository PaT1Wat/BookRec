import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CoverUploadProps {
  value: string;
  onChange: (url: string) => void;
}

const CoverUpload = ({ value, onChange }: CoverUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [useUrl, setUseUrl] = useState(!value || value.startsWith("http"));
  const fileRef = useRef<HTMLInputElement>(null);

  /* =======================
     📤 Upload
  ======================= */
  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }

    // 🔥 จำกัดขนาด (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("ไฟล์ต้องไม่เกิน 2MB");
      return;
    }

    setUploading(true);

    try {
      const ext = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const filePath = `covers/${fileName}`;

      /* 🔥 upload */
      const { error: uploadError } = await supabase.storage
        .from("book-covers")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      /* 🔥 get public url */
      const { data } = supabase.storage
        .from("book-covers")
        .getPublicUrl(filePath);

      onChange(data.publicUrl);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* LABEL */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          รูปปก
        </label>

        <button
          type="button"
          onClick={() => setUseUrl(!useUrl)}
          className="text-xs text-primary hover:underline"
        >
          {useUrl ? "อัปโหลดไฟล์แทน" : "ใช้ URL แทน"}
        </button>
      </div>

      {/* URL MODE */}
      {useUrl ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/cover.jpg"
        />
      ) : (
        /* UPLOAD MODE */
        <div
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-muted/50"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="อัปโหลดรูปปกหนังสือ"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />

          {uploading ? (
            <span className="animate-pulse">กำลังอัปโหลด...</span>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span>คลิกเพื่อเลือกรูปภาพ</span>
            </>
          )}
        </div>
      )}

      {/* PREVIEW */}
      {value && (
        <div className="relative inline-block">
          <img
            src={value}
            alt="cover preview"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
            }}
            className="h-32 w-auto rounded-lg object-cover"
          />

          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -right-2 -top-2 h-6 w-6"
            onClick={() => onChange("")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default CoverUpload;