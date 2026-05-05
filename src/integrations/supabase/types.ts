export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_email_sends: {
        Row: {
          error: string | null
          event_email_id: string
          id: string
          registration_id: string
          sent_at: string
          status: string
        }
        Insert: {
          error?: string | null
          event_email_id: string
          id?: string
          registration_id: string
          sent_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          event_email_id?: string
          id?: string
          registration_id?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_email_sends_event_email_id_fkey"
            columns: ["event_email_id"]
            isOneToOne: false
            referencedRelation: "event_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_sends_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_emails: {
        Row: {
          body_html: string | null
          created_at: string
          event_id: string
          id: string
          orario_map: Json | null
          sent_at: string | null
          slug: string
          subject: string
          trigger_type: string
        }
        Insert: {
          body_html?: string | null
          created_at?: string
          event_id: string
          id?: string
          orario_map?: Json | null
          sent_at?: string | null
          slug: string
          subject: string
          trigger_type?: string
        }
        Update: {
          body_html?: string | null
          created_at?: string
          event_id?: string
          id?: string
          orario_map?: Json | null
          sent_at?: string | null
          slug?: string
          subject?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_emails_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          attivo: boolean
          chiusura_ore_prima: number
          created_at: string
          custom_fields: Json | null
          data_evento: string | null
          descrizione: string | null
          external_url: string | null
          hero_image: string | null
          id: string
          is_coppia: boolean
          is_tesseramento: boolean
          location_label: string | null
          location_lat: number | null
          location_lng: number | null
          luogo: string | null
          nome: string
          payment_methods: string[] | null
          pettorale_start: number | null
          prezzo: number
          regulation_url: string | null
          richiedi_societa: boolean
          satispay_account_id: string | null
          satispay_api_token: string | null
          satispay_api_url: string | null
          scadenza_iscrizioni: string | null
          service_fee: number
          slug: string
          updated_at: string
          visibile_in_landing: boolean
        }
        Insert: {
          attivo?: boolean
          chiusura_ore_prima?: number
          created_at?: string
          custom_fields?: Json | null
          data_evento?: string | null
          descrizione?: string | null
          external_url?: string | null
          hero_image?: string | null
          id?: string
          is_coppia?: boolean
          is_tesseramento?: boolean
          location_label?: string | null
          location_lat?: number | null
          location_lng?: number | null
          luogo?: string | null
          nome: string
          payment_methods?: string[] | null
          pettorale_start?: number | null
          prezzo?: number
          regulation_url?: string | null
          richiedi_societa?: boolean
          satispay_account_id?: string | null
          satispay_api_token?: string | null
          satispay_api_url?: string | null
          scadenza_iscrizioni?: string | null
          service_fee?: number
          slug: string
          updated_at?: string
          visibile_in_landing?: boolean
        }
        Update: {
          attivo?: boolean
          chiusura_ore_prima?: number
          created_at?: string
          custom_fields?: Json | null
          data_evento?: string | null
          descrizione?: string | null
          external_url?: string | null
          hero_image?: string | null
          id?: string
          is_coppia?: boolean
          is_tesseramento?: boolean
          location_label?: string | null
          location_lat?: number | null
          location_lng?: number | null
          luogo?: string | null
          nome?: string
          payment_methods?: string[] | null
          pettorale_start?: number | null
          prezzo?: number
          regulation_url?: string | null
          richiedi_societa?: boolean
          satispay_account_id?: string | null
          satispay_api_token?: string | null
          satispay_api_url?: string | null
          scadenza_iscrizioni?: string | null
          service_fee?: number
          slug?: string
          updated_at?: string
          visibile_in_landing?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "events_satispay_account_id_fkey"
            columns: ["satispay_account_id"]
            isOneToOne: false
            referencedRelation: "satispay_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_certificates: {
        Row: {
          ai_warning: string | null
          disciplines: string[] | null
          expiry_date: string | null
          file_path: string
          id: string
          participant_id: string
          registration_id: string | null
          uploaded_at: string
        }
        Insert: {
          ai_warning?: string | null
          disciplines?: string[] | null
          expiry_date?: string | null
          file_path: string
          id?: string
          participant_id: string
          registration_id?: string | null
          uploaded_at?: string
        }
        Update: {
          ai_warning?: string | null
          disciplines?: string[] | null
          expiry_date?: string | null
          file_path?: string
          id?: string
          participant_id?: string
          registration_id?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_certificates_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_certificates_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_cards: {
        Row: {
          card_number: string
          created_at: string
          id: string
          participant_id: string
          registration_id: string
          year: number
        }
        Insert: {
          card_number: string
          created_at?: string
          id?: string
          participant_id: string
          registration_id: string
          year?: number
        }
        Update: {
          card_number?: string
          created_at?: string
          id?: string
          participant_id?: string
          registration_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "membership_cards_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_cards_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_clicks: {
        Row: {
          clicked_at: string
          id: string
          newsletter_id: string
          participant_id: string
        }
        Insert: {
          clicked_at?: string
          id?: string
          newsletter_id: string
          participant_id: string
        }
        Update: {
          clicked_at?: string
          id?: string
          newsletter_id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_clicks_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_clicks_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_sends: {
        Row: {
          id: string
          newsletter_id: string
          participant_id: string
          sent_at: string
          success: boolean
        }
        Insert: {
          id?: string
          newsletter_id: string
          participant_id: string
          sent_at?: string
          success?: boolean
        }
        Update: {
          id?: string
          newsletter_id?: string
          participant_id?: string
          sent_at?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_sends_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_sends_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_unsubscribes: {
        Row: {
          id: string
          newsletter_id: string
          participant_id: string
          unsubscribed_at: string
        }
        Insert: {
          id?: string
          newsletter_id: string
          participant_id: string
          unsubscribed_at?: string
        }
        Update: {
          id?: string
          newsletter_id?: string
          participant_id?: string
          unsubscribed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_unsubscribes_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_unsubscribes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletters: {
        Row: {
          body_html: string | null
          created_at: string
          cta_url: string
          id: string
          sent_at: string | null
          slug: string
          subject: string
        }
        Insert: {
          body_html?: string | null
          created_at?: string
          cta_url: string
          id?: string
          sent_at?: string | null
          slug: string
          subject: string
        }
        Update: {
          body_html?: string | null
          created_at?: string
          cta_url?: string
          id?: string
          sent_at?: string | null
          slug?: string
          subject?: string
        }
        Relationships: []
      }
      participants: {
        Row: {
          auth_user_id: string | null
          birth_date: string | null
          birth_place: string | null
          codice_fiscale: string | null
          cognome: string
          created_at: string
          email: string
          fidal_data: Json | null
          id: string
          identification_type: string
          newsletter: boolean
          nome: string
          photo_thumb_url: string | null
          photo_url: string | null
          signature_url: string | null
          societa_id: string | null
          telefono: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          birth_date?: string | null
          birth_place?: string | null
          codice_fiscale?: string | null
          cognome: string
          created_at?: string
          email: string
          fidal_data?: Json | null
          id?: string
          identification_type?: string
          newsletter?: boolean
          nome: string
          photo_thumb_url?: string | null
          photo_url?: string | null
          signature_url?: string | null
          societa_id?: string | null
          telefono: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          birth_date?: string | null
          birth_place?: string | null
          codice_fiscale?: string | null
          cognome?: string
          created_at?: string
          email?: string
          fidal_data?: Json | null
          id?: string
          identification_type?: string
          newsletter?: boolean
          nome?: string
          photo_thumb_url?: string | null
          photo_url?: string | null
          signature_url?: string | null
          societa_id?: string | null
          telefono?: string
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          birth_date: string | null
          birth_place: string | null
          codice_fiscale: string | null
          cognome: string
          created_at: string
          custom_data: Json | null
          email: string
          event_id: string | null
          id: string
          identification_type: string
          nome: string
          participant_id: string | null
          payment_id: string | null
          payment_method: string
          payment_status: string
          societa_id: string | null
          societa_nome: string | null
          telefono: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          birth_place?: string | null
          codice_fiscale?: string | null
          cognome: string
          created_at?: string
          custom_data?: Json | null
          email: string
          event_id?: string | null
          id?: string
          identification_type: string
          nome: string
          participant_id?: string | null
          payment_id?: string | null
          payment_method: string
          payment_status?: string
          societa_id?: string | null
          societa_nome?: string | null
          telefono: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          birth_place?: string | null
          codice_fiscale?: string | null
          cognome?: string
          created_at?: string
          custom_data?: Json | null
          email?: string
          event_id?: string | null
          id?: string
          identification_type?: string
          nome?: string
          participant_id?: string | null
          payment_id?: string | null
          payment_method?: string
          payment_status?: string
          societa_id?: string | null
          societa_nome?: string | null
          telefono?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      satispay_accounts: {
        Row: {
          api_token: string
          api_url: string
          created_at: string
          id: string
          is_default: boolean
          nome: string
          note: string | null
          updated_at: string
        }
        Insert: {
          api_token: string
          api_url: string
          created_at?: string
          id?: string
          is_default?: boolean
          nome: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          api_token?: string
          api_url?: string
          created_at?: string
          id?: string
          is_default?: boolean
          nome?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      societa: {
        Row: {
          created_at: string
          id: string
          nome: string
          note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
