import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Save, Search } from "lucide-react";
import { useBooks } from "@/context/BooksContext";
import { useAuth } from "@/context/AuthContext";
import { type Book } from "@/data/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import CoverUpload from "@/components/CoverUpload";
import { supabase } from "@/integrations/supabase/client";

/* =======================
   ✅ FormData
======================= */
type FormData = {
  title: string;
  titleEn: string;
  authorName: string;
  publisherName: string;
  price: number;
  rating: number;
  reviewCount: number;
  coverUrl: string;
  type: string;
  genres: string[];
  tags: string;
  description: string;
  isNew: boolean;
  isPopular: boolean;
};

const emptyForm: FormData = {
  title: "",
  titleEn: "",
  authorName: "",
  publisherName: "",
  price: 0,
  rating: 0,
  reviewCount: 0,
  coverUrl: "",
  type: "manga",
  genres: [],
  tags: "",
  description: "",
  isNew: false,
  isPopular: false,
};

const GENRE_LIST = [
  "แอ็กชัน", "ผจญภัย", "แฟนตาซี", "โรแมนติก",
  "ดราม่า", "คอมเมดี้", "สยองขวัญ", "สืบสวน",
  "ไซไฟ", "ชีวิตประจำวัน", "BL ( Boy Love )", "GL ( Girl Love )",
];

/* =======================
   🔽 Dropdown Component
======================= */
const Dropdown = ({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (val: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = options.filter(o =>
    o.toLowerCase().includes((search || value).toLowerCase())
  );

  return (
    <div className="space-y-1 relative">
      <label className="text-sm font-medium">{label}</label>
      <Input
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={e => {
          onChange(e.target.value);
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border bg-white shadow-lg">
          {filtered.length > 0 ? (
            filtered.map(o => (
              <li
                key={o}
                onMouseDown={() => {
                  onChange(o);
                  setSearch("");
                  setOpen(false);
                }}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
              >
                {o}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              ไม่พบ — ใช้ชื่อที่พิมพ์ได้เลย
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

/* =======================
   🏠 AdminPage
======================= */
const AdminPage = () => {
  const { books, addBook, updateBook, deleteBook } = useBooks();
  const { isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Dropdown data
  const [authors, setAuthors] = useState<string[]>([]);
  const [publishers, setPublishers] = useState<string[]>([]);

  /* =======================
     📦 Fetch authors & publishers
  ======================= */
  useEffect(() => {
  const fetchMeta = async () => {
    const [{ data: pubData }, { data: bookData }] = await Promise.all([
      supabase.from("publisher" as any).select('"publisherName"'),
      supabase.from("author" as any).select('"authorName"'),
    ]);

    if (pubData) {
      const uniquePublishers = [...new Set(
        (pubData as any[]).map(p => p.publisherName).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, "th"));
      setPublishers(uniquePublishers);
    }

    if (bookData) {
      const uniqueAuthors = [...new Set(
        (bookData as any[]).map(b => b.authorName).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, "th"));
      setAuthors(uniqueAuthors);
    }
  };
  fetchMeta();
}, [books]); // refetch เมื่อ books เปลี่ยน

  /* =======================
     🔒 Protect Admin
  ======================= */
  if (authLoading) return <div className="p-10 text-center">กำลังโหลด...</div>;
  if (!isAdmin) {
    return (
      <div className="p-10 text-center text-red-500">
        ❌ คุณไม่มีสิทธิ์เข้าหน้านี้
      </div>
    );
  }

  /* =======================
     🔍 Filter
  ======================= */
  const filtered = books.filter(b =>
    (b.title || "").toLowerCase().includes(search.toLowerCase())
  );

  /* =======================
     🏷️ Toggle Genre
  ======================= */
  const toggleGenre = (genre: string) => {
    setForm(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre],
    }));
  };

  /* =======================
     ➕ Add
  ======================= */
  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  /* =======================
     ✏️ Edit
  ======================= */
  const openEdit = (book: Book) => {
    setEditingId(book.id);
    setForm({
      title: book.title || "",
      titleEn: book.titleEn || "",
      authorName: book.authorName || "",
      publisherName: book.publisherName || "",
      price: book.price ?? 0,
      rating: book.rating ?? 0,
      reviewCount: book.reviewCount ?? 0,
      coverUrl: book.coverUrl || "",
      type: book.type || "manga",
      genres: book.genres || [],
      tags: (book.tags || []).join(", "),
      description: book.description || "",
      isNew: book.isNew ?? false,
      isPopular: book.isPopular ?? false,
    });
    setShowForm(true);
  };

  /* =======================
     💾 Save
  ======================= */
  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "กรุณากรอกชื่อเรื่อง", variant: "destructive" });
      return;
    }

    setSaving(true);

    const tagsArray = form.tags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    const allTags = [...new Set([...form.genres, ...tagsArray])];

    try {
      const payload = {
        title: form.title,
        titleEn: form.titleEn,
        description: form.description,
        coverUrl: form.coverUrl,
        authorName: form.authorName,
        publisherName: form.publisherName,
        price: form.price,
        rating: form.rating,
        reviewCount: form.reviewCount,
        type: form.type,
        isNew: form.isNew,
        isPopular: form.isPopular,
        tags: allTags,
      };

      if (editingId) {
        await updateBook(editingId, payload);
        toast({ title: "แก้ไขหนังสือสำเร็จ ✅" });
      } else {
        await addBook(payload);
        toast({ title: "เพิ่มหนังสือสำเร็จ ✅" });
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (err: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  /* =======================
     🗑️ Delete
  ======================= */
  const handleDelete = async (id: string) => {
    try {
      await deleteBook(id);
      setDeleteConfirm(null);
      toast({ title: "ลบหนังสือสำเร็จ 🗑️" });
    } catch (err: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container py-8">
      {/* HEADER */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🛠️ จัดการหนังสือ</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ทั้งหมด {books.length} เล่ม
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" /> เพิ่มหนังสือ
        </Button>
      </div>

      {/* SEARCH */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อหนังสือ..."
          className="pl-9"
        />
      </div>

      {/* TABLE */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left">ปก</th>
              <th className="px-4 py-3 text-left">ชื่อหนังสือ</th>
              <th className="px-4 py-3 text-left">ผู้แต่ง</th>
              <th className="px-4 py-3 text-left">สำนักพิมพ์</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(book => (
              <tr key={book.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3">
                  <img
                    src={book.coverUrl || "/placeholder.svg"}
                    alt={book.title || "book cover"}
                    className="h-14 w-10 object-cover rounded"
                  />
                </td>
                <td className="px-4 py-3 font-medium">{book.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{book.authorName || "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">{book.publisherName || "-"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(book)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {deleteConfirm === book.id ? (
                      <>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(book.id)}>
                          ยืนยัน
                        </Button>
                        <Button size="sm" onClick={() => setDeleteConfirm(null)}>
                          ยกเลิก
                        </Button>
                      </>
                    ) : (
                      <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm(book.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-10 text-center text-muted-foreground">
            ไม่พบข้อมูล
          </div>
        )}
      </div>

      {/* MODAL */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold">
                {editingId ? "✏️ แก้ไขหนังสือ" : "📘 เพิ่มหนังสือใหม่"}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">

              {/* ชื่อเรื่อง */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">ชื่อเรื่อง (ไทย) *</label>
                  <Input
                    placeholder="ชื่อภาษาไทย"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">ชื่อเรื่อง (EN)</label>
                  <Input
                    placeholder="ชื่อภาษาอังกฤษ"
                    value={form.titleEn}
                    onChange={e => setForm({ ...form, titleEn: e.target.value })}
                  />
                </div>
              </div>

              {/* ผู้แต่ง / สำนักพิมพ์ — Dropdown */}
              <div className="grid grid-cols-2 gap-3">
                <Dropdown
                  label="ผู้แต่ง *"
                  value={form.authorName}
                  options={authors}
                  placeholder="ชื่อผู้แต่ง"
                  onChange={val => setForm({ ...form, authorName: val })}
                />
                <Dropdown
                  label="สำนักพิมพ์"
                  value={form.publisherName}
                  options={publishers}
                  placeholder="ชื่อสำนักพิมพ์"
                  onChange={val => setForm({ ...form, publisherName: val })}
                />
              </div>

              {/* ราคา / คะแนน */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">ราคา (บาท)</label>
                  <Input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">คะแนน (0-5)</label>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={form.rating}
                    onChange={e => setForm({ ...form, rating: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* จำนวนรีวิว */}
              <div className="space-y-1">
                <label className="text-sm font-medium">จำนวนรีวิว</label>
                <Input
                  type="number"
                  min={0}
                  value={form.reviewCount}
                  onChange={e => setForm({ ...form, reviewCount: Number(e.target.value) })}
                  className="w-1/2"
                />
              </div>

              {/* รูปปก */}
              <div className="space-y-1">
                <label className="text-sm font-medium">รูปปก</label>
                <CoverUpload
                  value={form.coverUrl}
                  onChange={(url) => setForm({ ...form, coverUrl: url })}
                />
              </div>

              {/* ประเภท */}
              <div className="space-y-2">
                <label className="text-sm font-medium">ประเภท</label>
                <div className="flex gap-2">
                  {[
                    { value: "manga", label: "มังงะ" },
                    { value: "novel", label: "นิยาย" },
                    { value: "light-novel", label: "ไลท์โนเวล" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, type: opt.value })}
                      className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                        form.type === opt.value
                          ? "bg-primary text-white"
                          : "bg-secondary text-secondary-foreground hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* แนว */}
              <div className="space-y-2">
                <label className="text-sm font-medium">แนว (เลือกได้หลายแนว)</label>
                <div className="flex flex-wrap gap-2">
                  {GENRE_LIST.map(genre => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        form.genres.includes(genre)
                          ? "bg-primary text-white"
                          : "bg-secondary text-secondary-foreground hover:bg-muted"
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              {/* แท็ก */}
              <div className="space-y-1">
                <label className="text-sm font-medium">แท็ก (คั่นด้วย comma)</label>
                <Input
                  placeholder="เช่น อสูร, ดาบ, ครอบครัว"
                  value={form.tags}
                  onChange={e => setForm({ ...form, tags: e.target.value })}
                />
              </div>

              {/* เรื่องย่อ */}
              <div className="space-y-1">
                <label className="text-sm font-medium">เรื่องย่อ</label>
                <textarea
                  placeholder="เรื่องย่อ..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border rounded-md p-2 text-sm min-h-[80px] resize-y"
                  rows={3}
                />
              </div>

              {/* Checkbox */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isNew}
                    onChange={e => setForm({ ...form, isNew: e.target.checked })}
                    className="rounded"
                  />
                  มาใหม่
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPopular}
                    onChange={e => setForm({ ...form, isPopular: e.target.checked })}
                    className="rounded"
                  />
                  ยอดนิยม
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 p-6 border-t sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? "กำลังบันทึก..." : editingId ? "บันทึก" : "เพิ่มหนังสือ"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;