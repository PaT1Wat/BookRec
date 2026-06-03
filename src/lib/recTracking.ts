import { supabase } from "@/integrations/supabase/client";

export async function logImpression(
  userId: string,
  bookIds: string[],
  section: string
) {
  if (!userId || bookIds.length === 0) return;
  console.log("logImpression called", { userId, bookIds, section }); // ✅
  try {
    const result = await (supabase as any).from("rec_impression").insert(
      bookIds.map((bookID) => ({
        user_id: userId,
        bookID: Number(bookID),
        section,
        shown_at: new Date().toISOString(),
      }))
    );
    console.log("logImpression result", result); // ✅
  } catch (e) {
    console.error("logImpression failed", e); // ✅ เปลี่ยนเป็น error
  }
}

export async function logClick(
  userId: string,
  bookId: string,
  section: string
) {
  if (!userId) return;
  console.log("logClick called", { userId, bookId, section }); // ✅
  try {
    const { data } = await (supabase as any)
      .from("rec_impression")
      .select("id")
      .eq("user_id", userId)
      .eq("bookID", Number(bookId))
      .eq("section", section)
      .eq("clicked", false)
      .order("shown_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log("logClick found row", data); // ✅
    if (data?.id) {
      const updateResult = await (supabase as any)
        .from("rec_impression")
        .update({
          clicked: true,
          clicked_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      console.log("logClick update result", updateResult); // ✅
    }
  } catch (e) {
    console.error("logClick failed", e); // ✅ เปลี่ยนเป็น error
  }
}