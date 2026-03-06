-- Create storage bucket for photo thumbnails
INSERT INTO storage.buckets (id, name, public) VALUES ('photo-thumbs', 'photo-thumbs', true);

-- Allow public read access
CREATE POLICY "Public read access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'photo-thumbs');

-- Allow service role to manage
CREATE POLICY "Service role can manage thumbs" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'photo-thumbs');