import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Save, Search, Users, BookOpen, Eye, EyeOff, Star, MessageSquare, AlertTriangle } from "lucide-react";
import { useBooks } from "@/context/BooksContext";
import { useAuth } from "@/context/AuthContext";
import { type Book } from "@/data/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import CoverUpload from "@/components/CoverUpload";
import { supabase } from "@/integrations/supabase/client";

type FormData = {
  title: string; titleEn: string; authorName: string; publisherName: string;
  price: number; coverUrl: string;
  type: string; genres: string[]; tags: string; description: string;
  isNew: boolean; isHidden: boolean;
  publishDate?: string;
};

type UserRow = {
  id: string; email: string; display_name: string | null;
  role: string; created_at: string; avatar_url?: string | null;
  reviewCount?: number; favoriteCount?: number;
};

type ReviewWithBook = {
  reviewID: number; rating: number; comment: string | null;
  createdAt: string; user_id: string;
  display_name?: string | null;
  book?: { bookID: number; title: string; coverImage: string | null };
};

const emptyForm: FormData = {
  title: "", titleEn: "", authorName: "", publisherName: "",
  price: 0, coverUrl: "", type: "manga",
  genres: [], tags: "", description: "",
  isNew: false, isHidden: false, publishDate: "",
};

const GENRE_LIST = [
  "แอ็กชัน", "ผจญภัย", "แฟนตาซี", "โรแมนติก", "ดราม่า", "คอมเมดี้",
  "สยองขวัญ", "สืบสวน", "ไซไฟ", "ชีวิตประจำวัน", "BL ( Boy Love )", "GL ( Girl Love )",
];

const Dropdown = ({ label, value, options, placeholder, onChange }: {
  label: string; value: string; options: string[]; placeholder: string;
  onChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = options.filter(o => o.toLowerCase().includes((search || value).toLowerCase()));
  return (
    <div className="space-y-1 relative">
      <label className="text-sm font-medium">{label}</label>
      <Input placeholder={placeholder} value={value} autoComplete="off"
        onChange={e => { onChange(e.target.value); setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && (
        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border bg-white shadow-lg">
          {filtered.length > 0 ? filtered.map(o => (
            <li key={o} onMouseDown={() => { onChange(o); setSearch(""); setOpen(false); }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-muted">{o}</li>
          )) : (
            <li className="px-3 py-2 text-sm text-muted-foreground">ไม่พบ — ใช้ชื่อที่พิมพ์ได้เลย</li>
          )}
        </ul>
      )}
    </div>
  );
};

const AdminPage = () => {
  const { allBooks, addBook, updateBook, deleteBook } = useBooks();
  const { isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"users" | "books">("books");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "hasData" | "deletable" | "hidden">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const BOOKS_PER_PAGE = 30;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<string | null>(null);
  const [unarchiveConfirm, setUnarchiveConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [authors, setAuthors] = useState<string[]>([]);
  const [publishers, setPublishers] = useState<string[]>([]);
  const [bookInteractions, setBookInteractions] = useState<Map<number, boolean>>(new Map());

  const [users, setUsers] = useState<UserRow[]>([]);
  const [allReviews, setAllReviews] = useState<ReviewWithBook[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");
  const [userSubTab, setUserSubTab] = useState<"members" | "reviews">("members");

  const [reviewPage, setReviewPage] = useState(1);
  const REVIEWS_PER_PAGE = 15;
  const [deleteReviewConfirm, setDeleteReviewConfirm] = useState<number | null>(null);

  useEffect(() => {
    const map = new Map<number, boolean>();
    allBooks.forEach((book: any) => {
      const bookId = Number(book.bookID ?? book.id);
      const hasData =
        (book.favoriteCount ?? 0) > 0 ||
        (book.reviewActionCount ?? 0) > 0 ||
        (book.viewCount ?? 0) > 0 ||
        (book.reviewCount ?? 0) > 0;
      if (hasData) map.set(bookId, true);
    });
    setBookInteractions(map);
  }, [allBooks]);

  useEffect(() => {
    const fetchMeta = async () => {
      const [{ data: pubData }, { data: authData }] = await Promise.all([
        supabase.from("publisher" as any).select('"publisherName"'),
        supabase.from("author" as any).select('"authorName"'),
      ]);
      if (pubData) setPublishers([...new Set((pubData as any[]).map(p => p.publisherName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")));
      if (authData) setAuthors([...new Set((authData as any[]).map(b => b.authorName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")));
    };
    fetchMeta();
  }, [allBooks]);

  useEffect(() => {
    if (activeTab !== "users") return;
    setUsersLoading(true);
    const fetchUsers = async () => {
      const db = supabase as any;
      const [{ data: usersData }, { data: reviewsData }, { data: favsData }] = await Promise.all([
        db.from("user").select("id, email, display_name, role, created_at"),
        db.from("review").select("reviewID, rating, comment, createdAt, user_id, bookID"),
        db.from("favorite").select("user_id, bookID"),
      ]);
      const reviewCountMap = new Map<string, number>();
      const favCountMap = new Map<string, number>();
      (reviewsData ?? []).forEach((r: any) => reviewCountMap.set(r.user_id, (reviewCountMap.get(r.user_id) ?? 0) + 1));
      (favsData ?? []).forEach((f: any) => favCountMap.set(f.user_id, (favCountMap.get(f.user_id) ?? 0) + 1));
      const enriched: UserRow[] = (usersData ?? []).map((u: any) => ({
        ...u, reviewCount: reviewCountMap.get(u.id) ?? 0, favoriteCount: favCountMap.get(u.id) ?? 0,
      })).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setUsers(enriched);

      const bookMap = new Map(allBooks.map(b => [Number((b as any).bookID ?? b.id), b]));
      const userNameMap = new Map((usersData ?? []).map((u: any) => [u.id, u.display_name || u.email]));
      const enrichedReviews: ReviewWithBook[] = (reviewsData ?? []).map((r: any) => {
        const book = bookMap.get(r.bookID);
        return {
          ...r, display_name: userNameMap.get(r.user_id) ?? "ไม่ทราบชื่อ",
          book: book ? { bookID: Number((book as any).bookID ?? book.id), title: book.title, coverImage: (book as any).coverUrl ?? null } : undefined,
        };
      }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllReviews(enrichedReviews);
      setUsersLoading(false);
    };
    fetchUsers();
  }, [activeTab, allBooks]);

  if (authLoading) return <div className="p-10 text-center">กำลังโหลด...</div>;
  if (!isAdmin) return <div className="p-10 text-center text-red-500">❌ คุณไม่มีสิทธิ์เข้าหน้านี้</div>;

  const getBookId = (b: any) => Number((b as any).bookID ?? b.id);

  // ✅ FIX: count active (non-hidden) books only for clearer badge labels
  const activeBooks = allBooks.filter(b => !(b.isHidden ?? false));
  const countHasData   = activeBooks.filter(b => bookInteractions.get(getBookId(b)) ?? false).length;
  const countDeletable = activeBooks.filter(b => !(bookInteractions.get(getBookId(b)) ?? false)).length;
  const countHidden    = allBooks.filter(b => b.isHidden ?? false).length;

  // ✅ FIX: sort so hidden books appear at the bottom in "all" view
  const filtered = allBooks
    .filter(book => {
      const matchSearch = (book.title || "").toLowerCase().includes(search.toLowerCase());
      const hasInteraction = bookInteractions.get(getBookId(book)) ?? false;
      const isHidden = book.isHidden ?? false;
      const matchStatus =
        statusFilter === "all"       ? true
        : statusFilter === "hasData"   ? hasInteraction && !isHidden
        : statusFilter === "deletable" ? !hasInteraction && !isHidden
        : isHidden;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      // hidden always go to bottom in "all" view
      if (statusFilter !== "all") return 0;
      return (a.isHidden ? 1 : 0) - (b.isHidden ? 1 : 0);
    });

  const totalPages = Math.ceil(filtered.length / BOOKS_PER_PAGE);
  const paginatedBooks = filtered.slice((currentPage - 1) * BOOKS_PER_PAGE, currentPage * BOOKS_PER_PAGE);

  const filteredReviews = allReviews.filter(r =>
    !reviewSearch ||
    r.book?.title?.toLowerCase().includes(reviewSearch.toLowerCase()) ||
    r.display_name?.toLowerCase().includes(reviewSearch.toLowerCase())
  );
  const totalReviewPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE);
  const paginatedReviews = filteredReviews.slice(
    (reviewPage - 1) * REVIEWS_PER_PAGE, reviewPage * REVIEWS_PER_PAGE
  );

  const toggleGenre = (g: string) => setForm(prev => ({
    ...prev, genres: prev.genres.includes(g) ? prev.genres.filter(x => x !== g) : [...prev.genres, g],
  }));

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (book: Book) => {
    setEditingId(book.id);
    setForm({
      title: book.title || "", titleEn: book.titleEn || "",
      authorName: book.authorName || "", publisherName: book.publisherName || "",
      price: book.price ?? 0, coverUrl: book.coverUrl || "", type: book.type || "manga",
      genres: book.genres || [], tags: (book.tags || []).join(", "),
      description: book.description || "", isNew: book.isNew ?? false, isHidden: book.isHidden ?? false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "กรุณากรอกชื่อเรื่อง (ไทย)", variant: "destructive" }); return; }
    if (!form.titleEn.trim()) { toast({ title: "กรุณากรอกชื่อเรื่อง (EN)", variant: "destructive" }); return; }
    if (!form.authorName.trim()) { toast({ title: "กรุณากรอกชื่อผู้แต่ง", variant: "destructive" }); return; }
    if (!form.publisherName.trim()) { toast({ title: "กรุณากรอกชื่อสำนักพิมพ์", variant: "destructive" }); return; }
    if (!form.price || form.price <= 0) { toast({ title: "กรุณากรอกราคา", variant: "destructive" }); return; }
    if (!form.coverUrl.trim()) { toast({ title: "กรุณาใส่รูปปก", variant: "destructive" }); return; }
    if (form.genres.length === 0) { toast({ title: "กรุณาเลือกแนวอย่างน้อย 1 แนว", variant: "destructive" }); return; }
    if (!form.description.trim()) { toast({ title: "กรุณากรอกเรื่องย่อ", variant: "destructive" }); return; }

    setSaving(true);
    const tagsArray = form.tags.split(",").map(t => t.trim()).filter(Boolean);
    const allTags = [...new Set([...form.genres, ...tagsArray])];
    try {
      const payload = {
        ...form, tags: allTags, rating: 0, reviewCount: 0, isPopular: false,
        ...(editingId ? {} : { publishDate: new Date().toISOString(), isNew: true }),
      };
      if (editingId) { await updateBook(editingId, payload); toast({ title: "แก้ไขหนังสือสำเร็จ ✅" }); }
      else { await addBook(payload); toast({ title: "เพิ่มหนังสือสำเร็จ ✅" }); }
      setShowForm(false); setForm(emptyForm); setEditingId(null);
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteBook(id); setDeleteConfirm(null); toast({ title: "ลบหนังสือสำเร็จ 🗑️" }); }
    catch (err: any) { toast({ title: "เกิดข้อผิดพลาด", description: err?.message, variant: "destructive" }); }
  };

  const handleArchive = async (book: Book) => {
    try {
      await updateBook(book.id, {
        title: book.title, titleEn: book.titleEn, description: book.description,
        coverUrl: book.coverUrl, authorName: book.authorName || book.author,
        publisherName: book.publisherName || book.publisher, price: book.price,
        rating: 0, reviewCount: 0, type: book.type, tags: book.tags, isNew: false, isPopular: false,
        isHidden: true,
      });
      setArchiveConfirm(null);
      toast({ title: "ซ่อนหนังสือสำเร็จ 👁️" });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err?.message, variant: "destructive" });
    }
  };

  const handleUnhide = async (book: Book) => {
    try {
      await updateBook(book.id, {
        title: book.title, titleEn: book.titleEn, description: book.description,
        coverUrl: book.coverUrl, authorName: book.authorName || book.author,
        publisherName: book.publisherName || book.publisher, price: book.price,
        rating: 0, reviewCount: 0, type: book.type, tags: book.tags,
        isNew: book.isNew ?? false, isPopular: false, isHidden: false,
      });
      setUnarchiveConfirm(null);
      toast({ title: "ยกเลิกการซ่อนหนังสือสำเร็จ ✅" });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err?.message, variant: "destructive" });
    }
  };

  const handleDeleteReview = async (reviewID: number) => {
    try {
      const db = supabase as any;
      const { error } = await db.from("review").delete().eq("reviewID", reviewID);
      if (error) throw error;
      setAllReviews(prev => prev.filter(r => r.reviewID !== reviewID));
      setDeleteReviewConfirm(null);
      toast({ title: "ลบรีวิวสำเร็จ 🗑️" });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err?.message, variant: "destructive" });
    }
  };

  // ✅ FIX: "ทั้งหมด" badge shows active books count (not including hidden)
  const filterBtns = [
    { key: "all",       label: "ทั้งหมด",  count: activeBooks.length, color: "blue" },
    { key: "hasData",   label: "มีข้อมูล", count: countHasData,       color: "amber" },
    { key: "deletable", label: "ลบได้",    count: countDeletable,     color: "green" },
    { key: "hidden",    label: "ซ่อนไว้",  count: countHidden,        color: "gray" },
  ] as const;

  return (
    <div className="container py-8">

      <div className="mb-6">
        <h1 className="text-3xl font-bold">⚙️ จัดการระบบ</h1>
        <div className="mt-4 flex gap-2 border-b border-border">
          {[
            { key: "books", label: "📚 จัดการหนังสือ", count: allBooks.length },
            { key: "users", label: "👥 จัดการผู้ใช้",  count: users.length || undefined },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══ TAB: จัดการหนังสือ ══ */}
      {activeTab === "books" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              ทั้งหมด {activeBooks.length} เล่ม
              {countHidden > 0 && (
                <span className="ml-2 text-muted-foreground/60">({countHidden} ซ่อนอยู่)</span>
              )}
            </p>
            <Button onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" /> เพิ่มหนังสือ
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {filterBtns.map(btn => (
              <button key={btn.key}
                onClick={() => { setStatusFilter(btn.key); setCurrentPage(1); }}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === btn.key
                    ? "bg-primary text-white border-primary"
                    : "border-border bg-secondary hover:bg-muted"
                }`}>
                {btn.label}
                <span className="ml-1.5 rounded-full bg-black/10 px-1.5 py-0.5 text-xs">{btn.count}</span>
              </button>
            ))}
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="ค้นหาชื่อหนังสือ..." className="pl-9" />
          </div>

          <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Trash2 className="h-3.5 w-3.5 text-red-400" /> ลบได้ (ไม่มีข้อมูล)</span>
            <span className="flex items-center gap-1"><EyeOff className="h-3.5 w-3.5 text-amber-500" /> ซ่อน (มีรีวิว/ชื่นชอบ — ลบไม่ได้)</span>
            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5 text-blue-500" /> ยกเลิกซ่อน</span>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left">ปก</th>
                  <th className="px-4 py-3 text-left">ชื่อหนังสือ</th>
                  <th className="px-4 py-3 text-left">ผู้แต่ง</th>
                  <th className="px-4 py-3 text-center">สถานะ</th>
                  <th className="px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBooks.map(book => {
                  const bookNumId = getBookId(book);
                  const hasInteraction = bookInteractions.get(bookNumId) ?? false;
                  const isHidden = book.isHidden ?? false;
                  return (
                    // ✅ FIX: hidden books have distinct muted row style
                    <tr key={book.id}
                      className={`border-t transition-colors ${
                        isHidden
                          ? "bg-muted/20 opacity-60"
                          : "hover:bg-muted/30"
                      }`}>
                      <td className="px-4 py-3">
                        <img src={book.coverUrl || "/placeholder.svg"} alt={book.title}
                          className={`h-14 w-10 object-cover rounded ${isHidden ? "grayscale" : ""}`} />
                      </td>
                      <td className="px-4 py-3">
                        <p className={`font-medium ${isHidden ? "text-muted-foreground line-through" : ""}`}>
                          {book.title}
                        </p>
                        {isHidden && <span className="text-xs text-amber-600 font-medium">ซ่อนอยู่</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{book.authorName || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        {isHidden ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-600 border border-gray-200">
                            <EyeOff className="h-3 w-3" /> ซ่อนอยู่
                          </span>
                        ) : hasInteraction ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 border border-amber-200">
                            <AlertTriangle className="h-3 w-3" /> มีข้อมูล
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 border border-green-200">
                            ✓ ลบได้
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(book)} title="แก้ไข">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isHidden ? (
                            unarchiveConfirm === book.id ? (
                              <>
                                <Button size="sm" variant="outline"
                                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleUnhide(book)}>ยืนยันเปิดใช้</Button>
                                <Button size="sm" variant="ghost" onClick={() => setUnarchiveConfirm(null)}>ยกเลิก</Button>
                              </>
                            ) : (
                              <Button size="icon" variant="ghost" title="ยกเลิกซ่อนหนังสือ"
                                onClick={() => setUnarchiveConfirm(book.id)}>
                                <Eye className="h-4 w-4 text-blue-500" />
                              </Button>
                            )
                          ) : hasInteraction ? (
                            archiveConfirm === book.id ? (
                              <>
                                <Button size="sm" variant="outline"
                                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                                  onClick={() => handleArchive(book)}>ยืนยันซ่อน</Button>
                                <Button size="sm" variant="ghost" onClick={() => setArchiveConfirm(null)}>ยกเลิก</Button>
                              </>
                            ) : (
                              <Button size="icon" variant="ghost" title="ซ่อนหนังสือ"
                                onClick={() => setArchiveConfirm(book.id)}>
                                <EyeOff className="h-4 w-4 text-amber-500" />
                              </Button>
                            )
                          ) : (
                            deleteConfirm === book.id ? (
                              <>
                                <Button size="sm" variant="destructive" onClick={() => handleDelete(book.id)}>ยืนยัน</Button>
                                <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)}>ยกเลิก</Button>
                              </>
                            ) : (
                              <Button size="icon" variant="ghost" title="ลบหนังสือ"
                                onClick={() => setDeleteConfirm(book.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-10 text-center text-muted-foreground">ไม่พบข้อมูล</div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}>ก่อนหน้า</Button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === "..." ? (
                      <span key={`e-${idx}`} className="px-2 py-1 text-sm text-muted-foreground">...</span>
                    ) : (
                      <button key={p} onClick={() => setCurrentPage(p as number)}
                        className={`min-w-[32px] rounded-md px-2 py-1 text-sm transition-colors ${
                          currentPage === p ? "bg-primary text-white" : "border border-border hover:bg-muted"
                        }`}>{p}</button>
                    )
                  )}
              </div>
              <Button variant="outline" size="sm" disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}>ถัดไป</Button>
            </div>
          )}
          {filtered.length > 0 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              แสดง {(currentPage - 1) * BOOKS_PER_PAGE + 1}–{Math.min(currentPage * BOOKS_PER_PAGE, filtered.length)} จาก {filtered.length} รายการ
            </p>
          )}
        </>
      )}

      {/* ══ TAB: จัดการผู้ใช้ ══ */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {usersLoading ? (
            <div className="py-10 text-center text-muted-foreground animate-pulse">กำลังโหลดข้อมูล...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "ผู้ใช้ทั้งหมด",    value: users.length,                                        icon: Users,         color: "text-blue-500",   bg: "bg-blue-50" },
                  { label: "รีวิวทั้งหมด",      value: allReviews.length,                                  icon: Star,          color: "text-amber-500",  bg: "bg-amber-50" },
                  { label: "หนังสือที่มีรีวิว", value: new Set(allReviews.map(r => r.book?.bookID)).size,  icon: BookOpen,      color: "text-green-500",  bg: "bg-green-50" },
                  { label: "Admin",              value: users.filter(u => u.role === "admin").length,       icon: MessageSquare, color: "text-purple-500", bg: "bg-purple-50" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className={`inline-flex rounded-lg p-2 ${s.bg} mb-2`}>
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                    </div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-1 border-b border-border">
                {[
                  { key: "members", label: "👥 รายชื่อผู้ใช้", count: users.length },
                  { key: "reviews", label: "💬 รีวิวทั้งหมด",  count: allReviews.length },
                ].map(t => (
                  <button key={t.key} onClick={() => setUserSubTab(t.key as any)}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      userSubTab === t.key
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}>
                    {t.label}
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t.count}</span>
                  </button>
                ))}
              </div>

              {userSubTab === "members" && (
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="px-4 py-3 text-left">ผู้ใช้</th>
                        <th className="px-4 py-3 text-left">อีเมล</th>
                        <th className="px-4 py-3 text-center">สิทธิ์</th>
                        <th className="px-4 py-3 text-center">รีวิว</th>
                        <th className="px-4 py-3 text-center">ชื่นชอบ</th>
                        <th className="px-4 py-3 text-left">สมัครเมื่อ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-t hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{u.display_name || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                            }`}>{u.role}</span>
                          </td>
                          <td className="px-4 py-3 text-center">{u.reviewCount ?? 0}</td>
                          <td className="px-4 py-3 text-center">{u.favoriteCount ?? 0}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && (
                    <div className="py-10 text-center text-muted-foreground">ไม่พบข้อมูลผู้ใช้</div>
                  )}
                </div>
              )}

              {userSubTab === "reviews" && (
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={reviewSearch}
                        onChange={e => { setReviewSearch(e.target.value); setReviewPage(1); }}
                        placeholder="ค้นหาหนังสือหรือผู้ใช้..."
                        className="pl-9 h-9 text-sm" />
                    </div>
                    <p className="text-sm text-muted-foreground">{filteredReviews.length} รายการ</p>
                  </div>

                  <div className="space-y-2">
                    {paginatedReviews.map(r => (
                      <div key={r.reviewID} className="flex gap-3 rounded-xl border bg-card p-3 items-start">
                        {r.book?.coverImage && (
                          <img src={r.book.coverImage} alt={r.book.title}
                            className="h-12 w-8 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{r.book?.title ?? "ไม่ทราบชื่อ"}</span>
                            <span className="text-xs text-muted-foreground">โดย {r.display_name}</span>
                            <div className="flex gap-0.5 ml-auto">
                              {[1, 2, 3, 4, 5].map(s => (
                                <Star key={s} className={`h-3 w-3 ${s <= (r.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                              ))}
                            </div>
                          </div>
                          {r.comment && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.comment}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }) : ""}
                          </p>
                        </div>
                        <div className="flex-shrink-0 flex items-center">
                          {deleteReviewConfirm === r.reviewID ? (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteReview(r.reviewID)}>ยืนยัน</Button>
                              <Button size="sm" variant="ghost" onClick={() => setDeleteReviewConfirm(null)}>ยกเลิก</Button>
                            </div>
                          ) : (
                            <Button size="icon" variant="ghost" title="ลบรีวิว"
                              onClick={() => setDeleteReviewConfirm(r.reviewID)}>
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredReviews.length === 0 && (
                      <div className="py-10 text-center text-muted-foreground">ไม่พบรีวิว</div>
                    )}
                  </div>

                  {totalReviewPages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Button variant="outline" size="sm" disabled={reviewPage === 1}
                        onClick={() => setReviewPage(p => p - 1)}>ก่อนหน้า</Button>
                      <div className="flex gap-1">
                        {Array.from({ length: totalReviewPages }, (_, i) => i + 1)
                          .filter(p => p === 1 || p === totalReviewPages || Math.abs(p - reviewPage) <= 1)
                          .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                            if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...");
                            acc.push(p);
                            return acc;
                          }, [])
                          .map((p, idx) =>
                            p === "..." ? (
                              <span key={`e-${idx}`} className="px-2 py-1 text-sm text-muted-foreground">...</span>
                            ) : (
                              <button key={p} onClick={() => setReviewPage(p as number)}
                                className={`min-w-[32px] rounded-md px-2 py-1 text-sm transition-colors ${
                                  reviewPage === p ? "bg-primary text-white" : "border border-border hover:bg-muted"
                                }`}>{p}</button>
                            )
                          )}
                      </div>
                      <Button variant="outline" size="sm" disabled={reviewPage === totalReviewPages}
                        onClick={() => setReviewPage(p => p + 1)}>ถัดไป</Button>
                    </div>
                  )}
                  {filteredReviews.length > 0 && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      แสดง {(reviewPage - 1) * REVIEWS_PER_PAGE + 1}–{Math.min(reviewPage * REVIEWS_PER_PAGE, filteredReviews.length)} จาก {filteredReviews.length} รายการ
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Book Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold">{editingId ? "✏️ แก้ไขหนังสือ" : "📘 เพิ่มหนังสือใหม่"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">ชื่อเรื่อง (ไทย) *</label>
                  <Input placeholder="ชื่อภาษาไทย" value={form.title}
                    onChange={e => { const v = e.target.value; if (/^[ก-๙0-9\s]*$/.test(v)) setForm({ ...form, title: v }); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">ชื่อเรื่อง (EN)*</label>
                  <Input placeholder="ชื่อภาษาอังกฤษ" value={form.titleEn}
                    onChange={e => { const v = e.target.value; if (/^[a-zA-Z0-9\s]*$/.test(v)) setForm({ ...form, titleEn: v }); }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Dropdown label="ผู้แต่ง *" value={form.authorName} options={authors} placeholder="ชื่อผู้แต่ง"
                  onChange={v => setForm({ ...form, authorName: v })} />
                <Dropdown label="สำนักพิมพ์" value={form.publisherName} options={publishers} placeholder="ชื่อสำนักพิมพ์"
                  onChange={v => setForm({ ...form, publisherName: v })} />
              </div>
              <div className="space-y-1 w-1/2">
                <label className="text-sm font-medium">ราคา (บาท)</label>
                <Input type="number" min={0} value={form.price}
                  onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">รูปปก</label>
                <CoverUpload value={form.coverUrl} onChange={url => setForm({ ...form, coverUrl: url })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ประเภท</label>
                <div className="flex gap-2">
                  {[{ value: "manga", label: "มังงะ" }, { value: "novel", label: "นิยาย" }, { value: "light-novel", label: "ไลท์โนเวล" }].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setForm({ ...form, type: opt.value })}
                      className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                        form.type === opt.value ? "bg-primary text-white" : "bg-secondary hover:bg-muted"
                      }`}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">แนว</label>
                <div className="flex flex-wrap gap-2">
                  {GENRE_LIST.map(g => (
                    <button key={g} type="button" onClick={() => toggleGenre(g)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        form.genres.includes(g) ? "bg-primary text-white" : "bg-secondary hover:bg-muted"
                      }`}>{g}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">แท็ก (คั่นด้วย comma)</label>
                <Input placeholder="เช่น อสูร, ดาบ, ครอบครัว" value={form.tags}
                  onChange={e => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">เรื่องย่อ</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="เรื่องย่อ..." rows={3}
                  className="w-full border rounded-md p-2 text-sm min-h-[80px] resize-y" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-6 border-t sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setShowForm(false)}>ยกเลิก</Button>
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