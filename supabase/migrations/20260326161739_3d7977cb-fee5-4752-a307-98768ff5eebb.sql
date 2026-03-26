UPDATE events SET custom_fields = jsonb_set(
  custom_fields::jsonb,
  '{0,option_featured}',
  '{"Ultra": true}'::jsonb
) WHERE slug = 'tredozio-trail-2027';