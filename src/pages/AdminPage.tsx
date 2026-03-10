import { useState } from "react";
import { Plus, Pencil, Trash2, X, Save, Search } from "lucide-react";
import { useBooks } from "@/context/BooksContext";
import { genres as allGenres, type Book, type BookType, type Genre } from "@/data/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type FormData = Omit<Book, "id">;

const emptyForm: FormData = {
  title: "",
  titleEn: "",
  author: "",
  publisher: "",
  type: "manga",
  genres: [],
  tags: [],
  description: "",
  coverUrl: "",
  price: 0,
  rating: 0,
  reviewCount: 0,
  isNew: false,
  isPopular: false,
};

const AdminPage = () => {
  const { books, addBook, updateBook, deleteBook } = useBooks();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [tagsInput, setTagsInput] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = books.filter(
    b =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setTagsInput("");
    setShowForm(true);
  };

  const openEdit = (book: Book) => {
    setEditingId(book.id);
    const { id, ...rest } = book;
    setForm(rest);
    setTagsInput(book.tags.join(", "));
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.title || !form.author) {
      toast({ title: "กรุณากรอกชื่อเรื่องและผู้แต่ง", variant: "destructive" });
      return;
    }
    const data = { ...form, tags: tagsInput.split(",").map(t => t.trim()).filter(Boolean) };
    if (editingId) {
      updateBook(editingId, data);
      toast({ title: "แก้ไขหนังสือสำเร็จ ✅" });
    } else {
      addBook(data);
      toast({ title: "เพิ่มหนังสือสำเร็จ ✅" });
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    deleteBook(id);
    setDeleteConfirm(null);
    toast({ title: "ลบหนังสือสำเร็จ 🗑️" });
  };

  const toggleGenre = (g: Genre) => {
    setForm(prev => ({
      ...prev,
      genres: prev.genres.includes(g) ? prev.genres.filter(x => x !== g) : [...prev.genres, g],
    }));
  };

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">🛠️ จัดการหนังสือ</h1>
          <p className="text-sm text-muted-foreground mt-1">เพิ่ม แก้ไข ลบหนังสือในระบบ ({books.length} เล่ม)</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" /> เพิ่มหนังสือ
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อเรื่องหรือผู้แต่ง..."
          className="pl-9"
        />
      </div>

      {/* Book list */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">ปก</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">ชื่อเรื่อง</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">ผู้แต่ง</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">ประเภท</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">ราคา</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(book => (
              <tr key={book.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <img src={book.coverUrl} alt={book.title} className="h-14 w-10 rounded object-cover" />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{book.title}</p>
                  {book.titleEn && <p className="text-xs text-muted-foreground">{book.titleEn}</p>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{book.author}</td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {book.type === "manga" ? "มังงะ" : "นิยาย"}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-foreground font-medium">฿{book.price}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(book)}>
                      <Pencil className="h-4 w-4 text-primary" />
                    </Button>
                    {deleteConfirm === book.id ? (
                      <div className="flex items-center gap-1">
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(book.id)}>ยืนยัน</Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>ยกเลิก</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(book.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">ไม่พบหนังสือ</div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 scrollbar-thin">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-display text-foreground">
                {editingId ? "✏️ แก้ไขหนังสือ" : "📘 เพิ่มหนังสือใหม่"}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">ชื่อเรื่อง (ไทย) *</label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">ชื่อเรื่อง (EN)</label>
                <Input value={form.titleEn || ""} onChange={e => setForm({ ...form, titleEn: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">ผู้แต่ง *</label>
                <Input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">สำนักพิมพ์</label>
                <Input value={form.publisher} onChange={e => setForm({ ...form, publisher: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">ราคา (บาท)</label>
                <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">คะแนน (0-5)</label>
                <Input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={e => setForm({ ...form, rating: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">จำนวนรีวิว</label>
                <Input type="number" value={form.reviewCount} onChange={e => setForm({ ...form, reviewCount: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">URL รูปปก</label>
                <Input value={form.coverUrl} onChange={e => setForm({ ...form, coverUrl: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">ประเภท</label>
              <div className="flex gap-2">
                {(["manga", "novel"] as BookType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      form.type === t ? "gradient-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {t === "manga" ? "มังงะ" : "นิยาย"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">แนว (เลือกได้หลายแนว)</label>
              <div className="flex flex-wrap gap-2">
                {allGenres.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGenre(g)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      form.genres.includes(g)
                        ? "gradient-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-primary/10"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">แท็ก (คั่นด้วย comma)</label>
              <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="เช่น อสูร, ดาบ, ครอบครัว" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">เรื่องย่อ</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex gap-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.isNew || false} onChange={e => setForm({ ...form, isNew: e.target.checked })} className="accent-primary" />
                มาใหม่
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.isPopular || false} onChange={e => setForm({ ...form, isPopular: e.target.checked })} className="accent-primary" />
                ยอดนิยม
              </label>
            </div>

            {form.coverUrl && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">ตัวอย่างปก</p>
                <img src={form.coverUrl} alt="preview" className="h-32 w-auto rounded-lg object-cover" />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>ยกเลิก</Button>
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" /> {editingId ? "บันทึกการแก้ไข" : "เพิ่มหนังสือ"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
