import { useState, useRef } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
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

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("book-covers").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("book-covers").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">รูปปก</label>
        <button
          type="button"
          onClick={() => setUseUrl(!useUrl)}
          className="text-xs text-primary hover:underline"
        >
          {useUrl ? "อัปโหลดไฟล์แทน" : "ใช้ URL แทน"}
        </button>
      </div>

      {useUrl ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/cover.jpg"
        />
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
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

      {value && (
        <div className="relative inline-block">
          <img src={value} alt="ปกหนังสือ" className="h-32 w-auto rounded-lg object-cover" />
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
