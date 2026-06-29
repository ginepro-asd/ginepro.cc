DO $$
DECLARE
  admin_user_id UUID := '589cdebd-c7bd-4784-9f81-c8f07e9a5a6e';
  admin_email TEXT := 'domenico.diiorio@ginepro.cc';
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    email_change_confirm_status,
    reauthentication_token,
    phone_change,
    phone_change_token,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    admin_user_id,
    'authenticated',
    'authenticated',
    admin_email,
    crypt('admin-local-123', gen_salt('bf', 10)),
    now(),
    '',
    '',
    '',
    '',
    '',
    0,
    '',
    '',
    '',
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"full_name": "Domenico Di Iorio", "email_verified": true}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    confirmation_token = EXCLUDED.confirmation_token,
    recovery_token = EXCLUDED.recovery_token,
    email_change_token_new = EXCLUDED.email_change_token_new,
    email_change = EXCLUDED.email_change,
    email_change_token_current = EXCLUDED.email_change_token_current,
    email_change_confirm_status = EXCLUDED.email_change_confirm_status,
    reauthentication_token = EXCLUDED.reauthentication_token,
    phone_change = EXCLUDED.phone_change,
    phone_change_token = EXCLUDED.phone_change_token,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = now();

  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    admin_user_id::text,
    admin_user_id,
    jsonb_build_object(
      'sub', admin_user_id::text,
      'email', admin_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

INSERT INTO public.events (
  slug,
  nome,
  descrizione,
  data_evento,
  luogo,
  prezzo,
  custom_fields,
  scadenza_iscrizioni,
  attivo,
  hero_image,
  payment_methods,
  is_tesseramento,
  is_coppia,
  pettorale_start,
  location_lat,
  location_lng,
  location_label,
  visibile_in_landing,
  service_fee,
  chiusura_ore_prima,
  richiedi_societa
) VALUES (
  'demo-trail-2026',
  'GINEPRO Demo Trail',
  'Evento demo locale per provare iscrizioni, quote variabili e landing pubblica.',
  '2026-09-20',
  'Faenza (RA)',
  1500,
  '[
    {
      "key": "percorso",
      "label": "Percorso",
      "type": "select",
      "required": true,
      "options": ["5 km camminata", "11 km trail"],
      "option_prices": {
        "5 km camminata": 1000,
        "11 km trail": 1500
      },
      "option_max_spots": {
        "5 km camminata": 100,
        "11 km trail": 80
      }
    }
  ]'::jsonb,
  '2026-09-19 23:59:00+02',
  true,
  '/images/castel-raniero-hero.png',
  ARRAY['stripe', 'contanti'],
  false,
  false,
  1,
  44.2856,
  11.8798,
  'Faenza (RA)',
  true,
  0,
  24,
  false
), (
  'tesseramento-2026',
  'Tesseramento GINEPRO 2026',
  'Evento demo locale per provare il flusso di tesseramento GINEPRO.',
  '2026-12-31',
  'Faenza (RA)',
  1500,
  '[]'::jsonb,
  '2026-12-30 23:59:00+01',
  true,
  null,
  ARRAY['stripe', 'contanti'],
  true,
  false,
  null,
  44.2856,
  11.8798,
  'Faenza (RA)',
  true,
  0,
  24,
  false
)
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  descrizione = EXCLUDED.descrizione,
  data_evento = EXCLUDED.data_evento,
  luogo = EXCLUDED.luogo,
  prezzo = EXCLUDED.prezzo,
  custom_fields = EXCLUDED.custom_fields,
  scadenza_iscrizioni = EXCLUDED.scadenza_iscrizioni,
  attivo = EXCLUDED.attivo,
  hero_image = EXCLUDED.hero_image,
  payment_methods = EXCLUDED.payment_methods,
  is_tesseramento = EXCLUDED.is_tesseramento,
  is_coppia = EXCLUDED.is_coppia,
  pettorale_start = EXCLUDED.pettorale_start,
  location_lat = EXCLUDED.location_lat,
  location_lng = EXCLUDED.location_lng,
  location_label = EXCLUDED.location_label,
  visibile_in_landing = EXCLUDED.visibile_in_landing,
  service_fee = EXCLUDED.service_fee,
  chiusura_ore_prima = EXCLUDED.chiusura_ore_prima,
  richiedi_societa = EXCLUDED.richiedi_societa,
  updated_at = now();

INSERT INTO public.societa (nome, note)
SELECT 'GINEPRO', 'Societa demo locale'
WHERE NOT EXISTS (
  SELECT 1 FROM public.societa WHERE lower(nome) = lower('GINEPRO')
);
