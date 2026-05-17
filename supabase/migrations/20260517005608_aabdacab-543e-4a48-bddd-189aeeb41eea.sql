
-- Private bucket for book uploads (manuscripts, cover, back cover, author photo)
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-uploads', 'book-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Scope access by device_id folder (first path segment). No auth required (anon device-scoped).
CREATE POLICY "device read own uploads"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'book-uploads');

CREATE POLICY "device insert own uploads"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'book-uploads');

CREATE POLICY "device update own uploads"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'book-uploads');

CREATE POLICY "device delete own uploads"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'book-uploads');
