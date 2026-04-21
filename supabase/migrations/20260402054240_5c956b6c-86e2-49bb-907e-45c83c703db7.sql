
-- Create reviews table
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (book_id, user_id)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews
CREATE POLICY "Anyone can view reviews" ON public.reviews
  FOR SELECT TO public USING (true);

-- Authenticated users can insert their own review
CREATE POLICY "Users can insert own review" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own review
CREATE POLICY "Users can update own review" ON public.reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Users can delete their own review
CREATE POLICY "Users can delete own review" ON public.reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to recalculate book rating and review_count
CREATE OR REPLACE FUNCTION public.update_book_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _book_id uuid;
BEGIN
  _book_id := COALESCE(NEW.book_id, OLD.book_id);
  UPDATE public.books
  SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews WHERE book_id = _book_id), 0),
      review_count = (SELECT COUNT(*) FROM public.reviews WHERE book_id = _book_id)
  WHERE id = _book_id;
  RETURN NULL;
END;
$$;

-- Triggers to auto-update book rating
CREATE TRIGGER on_review_insert AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_book_rating();
CREATE TRIGGER on_review_update AFTER UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_book_rating();
CREATE TRIGGER on_review_delete AFTER DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_book_rating();

-- Enable realtime for reviews
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
