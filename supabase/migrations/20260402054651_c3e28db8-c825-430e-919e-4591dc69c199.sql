
CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  rec_type text NOT NULL DEFAULT 'lightfm',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendations_user ON public.recommendations(user_id);
CREATE INDEX idx_recommendations_book ON public.recommendations(book_id);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view recommendations" ON public.recommendations
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage recommendations" ON public.recommendations
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
