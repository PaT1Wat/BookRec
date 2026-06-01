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
  onSkip?: () => void;
};

export default function GenreOnboardingModal({ userId, open, onDone, onSkip }: Props) {
  const { toast } = useToast();

  const [tags, setTags] = useState<GenreTag[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      const [{ data: allTags }, { data: userTags }] = await Promise.all([
        supabase
          .from("tag")
          .select("tagID, tagName, tagType")
          .eq("tagType", "genre")
          .order("tagID", { ascending: true }),

        supabase
          .from("user_tags")
          .select("tagID")
          .eq("user_id", userId),
      ]);

      setTags(allTags ?? []);

      const existingIds = (userTags ?? []).map((t: any) => t.tagID);
      setSelected(existingIds);
    };

    fetchData();
  }, [open, userId]);

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

    const rows = selected.map((tagID) => ({ user_id: userId, tagID }));
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

    try {
      localStorage.removeItem(`skippedGenreOnboarding:${userId}`);
    } catch {}

    // ✅ ล้าง cache recs ทั้งหมดของ user นี้ใน localStorage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`recs:${userId}`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}

    // ✅ dispatch recs:invalidate ให้ Index.tsx re-fetch recommendations ใหม่
    window.dispatchEvent(
      new CustomEvent("recs:invalidate", { detail: { userId } })
    );

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

          <div className="flex gap-2">
            {onSkip && (
              <Button variant="outline" type="button" onClick={onSkip}>
                ข้าม
              </Button>
            )}
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}