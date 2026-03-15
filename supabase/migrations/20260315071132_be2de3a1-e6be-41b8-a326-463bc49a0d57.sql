
CREATE POLICY "Anyone can upload regulations"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'regulations');

CREATE POLICY "Anyone can read regulations"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'regulations');

CREATE POLICY "Anyone can update regulations"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'regulations');

CREATE POLICY "Anyone can delete regulations"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'regulations');
