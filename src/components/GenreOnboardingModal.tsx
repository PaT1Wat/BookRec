import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type GenreTag = {
  tagID: number;
  tagName: string;
};

type Props = {
  userId: string;
  open: boolean;
  onDone: () => void;
};

export default function GenreOnboardingModal({ userId, open, onDone }: Props) {
  const { toast } = useToast();

  const [tags, setTags] = useState<GenreTag[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchTags = async () => {
      const { data, error } = await supabase
        .from("tag")
        .select("tagID, tagName, tagType")
        .eq("tagType", "genre")
        .order("tagID", { ascending: true });

      if (error) {
        console.error("fetch tags error:", error);
        return;
      }

      setTags(data ?? []);
    };

    fetchTags();
  }, [open]);

  if (!open) return null;

  const toggle = (tagID: number) => {
    setSelected((prev) =>
      prev.includes(tagID)
        ? prev.filter((id) => id !== tagID)
        : [...prev, tagID]
    );
  };

  const handleSave = async () => {
    if (selected.length < 1) {
      toast({
        title: "เลือกอย่างน้อย 1 แนว",
        description: "เพื่อให้ระบบแนะนำหนังสือได้แม่นยำ",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    await supabase.from("user_tags").delete().eq("user_id", userId);

    const rows = selected.map((tagID) => ({
      user_id: userId,
      tagID,
    }));

    const { error } = await supabase.from("user_tags").insert(rows);

    setLoading(false);

    if (error) {
      toast({
        title: "บันทึกไม่สำเร็จ",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "บันทึกเรียบร้อย 🎉",
      description: "ระบบจะใช้แนวที่คุณสนใจเพื่อแนะนำหนังสือ",
    });

    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl">
        <h2 className="text-xl font-bold">เลือกแนวหนังสือที่คุณสนใจ</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          เลือกอย่างน้อย 1 แนว เพื่อให้ระบบแนะนำแม่นขึ้น
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => {
            const active = selected.includes(tag.tagID);

            return (
              <button
                key={tag.tagID}
                type="button"
                onClick={() => toggle(tag.tagID)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-muted"
                }`}
              >
                {tag.tagName}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            เลือกแล้ว {selected.length} แนว
          </span>

          <Button onClick={handleSave} disabled={loading}>
            {loading ? "กำลังบันทึก..." : "เริ่มใช้งาน"}
          </Button>
        </div>
      </div>
    </div>
  );
}