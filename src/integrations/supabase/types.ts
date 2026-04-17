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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      availability_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          address: string
          bathrooms: number | null
          bedrooms: number | null
          booking_date: string
          cancellation_reason: string | null
          consent_given: boolean
          created_at: string
          email: string
          entry_codes: string | null
          frequency: string | null
          has_pets: boolean | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          preferred_contact: string | null
          property_type: string | null
          quote_id: string | null
          selected_addons: Json | null
          service_type: string | null
          square_footage: string | null
          status: string
          time_slot: string
          total_price: number | null
          updated_at: string
        }
        Insert: {
          address: string
          bathrooms?: number | null
          bedrooms?: number | null
          booking_date: string
          cancellation_reason?: string | null
          consent_given?: boolean
          created_at?: string
          email: string
          entry_codes?: string | null
          frequency?: string | null
          has_pets?: boolean | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          preferred_contact?: string | null
          property_type?: string | null
          quote_id?: string | null
          selected_addons?: Json | null
          service_type?: string | null
          square_footage?: string | null
          status?: string
          time_slot: string
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          bathrooms?: number | null
          bedrooms?: number | null
          booking_date?: string
          cancellation_reason?: string | null
          consent_given?: boolean
          created_at?: string
          email?: string
          entry_codes?: string | null
          frequency?: string | null
          has_pets?: boolean | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          preferred_contact?: string | null
          property_type?: string | null
          quote_id?: string | null
          selected_addons?: Json | null
          service_type?: string | null
          square_footage?: string | null
          status?: string
          time_slot?: string
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          service_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          service_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          service_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          question: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question?: string
        }
        Relationships: []
      }
      gallery: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          display_order: number
          group_id: string | null
          id: string
          image_type: string
          image_url: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          display_order?: number
          group_id?: string | null
          id?: string
          image_type?: string
          image_url: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          display_order?: number
          group_id?: string | null
          id?: string
          image_type?: string
          image_url?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      homepage_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          label: string
          section_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string
          label?: string
          section_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          label?: string
          section_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_paid: number
          booking_id: string | null
          created_at: string
          created_by: string | null
          customer_email: string
          customer_name: string
          due_date: string | null
          id: string
          invoice_number: string | null
          issued_date: string
          notes: string | null
          payment_method: string | null
          payment_status: string
          quote_id: string | null
          services: Json
          subtotal: number
          tax_amount: number
          tax_rate: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email: string
          customer_name: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issued_date?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          quote_id?: string | null
          services?: Json
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string
          customer_name?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issued_date?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          quote_id?: string | null
          services?: Json
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          reference_type: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      page_content: {
        Row: {
          content: Json
          created_at: string
          id: string
          page_name: string
          section_key: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          page_name: string
          section_key: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          page_name?: string
          section_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_drafts: {
        Row: {
          addons: Json
          base_price: number
          breakdown: Json
          condition_multiplier: number
          discount: number
          id: string
          manual_adjustment: number
          notes: string | null
          prepared_at: string
          prepared_by: string | null
          quote_id: string
          scope: string | null
          service_type: string | null
          tax_rate: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          addons?: Json
          base_price?: number
          breakdown?: Json
          condition_multiplier?: number
          discount?: number
          id?: string
          manual_adjustment?: number
          notes?: string | null
          prepared_at?: string
          prepared_by?: string | null
          quote_id: string
          scope?: string | null
          service_type?: string | null
          tax_rate?: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          addons?: Json
          base_price?: number
          breakdown?: Json
          condition_multiplier?: number
          discount?: number
          id?: string
          manual_adjustment?: number
          notes?: string | null
          prepared_at?: string
          prepared_by?: string | null
          quote_id?: string
          scope?: string | null
          service_type?: string | null
          tax_rate?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_drafts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string
          quote_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          quote_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_notes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          address: string | null
          attachment_url: string | null
          bathrooms: number | null
          bedrooms: number | null
          close_reason: string | null
          condition_level: string | null
          consent_given: boolean
          created_at: string
          description: string
          email: string
          entry_codes: string | null
          floor_type: string | null
          frequency: string | null
          full_bathrooms: number | null
          half_bathrooms: number | null
          has_cabinets: boolean | null
          has_pets: boolean | null
          id: string
          is_empty_property: boolean | null
          kitchen_count: number | null
          living_rooms: number | null
          name: string
          office_rooms: number | null
          phone: string | null
          preferred_contact: string | null
          property_size: string | null
          property_type: string | null
          selected_addons: Json | null
          service_type: string | null
          square_footage: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          attachment_url?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          close_reason?: string | null
          condition_level?: string | null
          consent_given?: boolean
          created_at?: string
          description: string
          email: string
          entry_codes?: string | null
          floor_type?: string | null
          frequency?: string | null
          full_bathrooms?: number | null
          half_bathrooms?: number | null
          has_cabinets?: boolean | null
          has_pets?: boolean | null
          id?: string
          is_empty_property?: boolean | null
          kitchen_count?: number | null
          living_rooms?: number | null
          name: string
          office_rooms?: number | null
          phone?: string | null
          preferred_contact?: string | null
          property_size?: string | null
          property_type?: string | null
          selected_addons?: Json | null
          service_type?: string | null
          square_footage?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          attachment_url?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          close_reason?: string | null
          condition_level?: string | null
          consent_given?: boolean
          created_at?: string
          description?: string
          email?: string
          entry_codes?: string | null
          floor_type?: string | null
          frequency?: string | null
          full_bathrooms?: number | null
          half_bathrooms?: number | null
          has_cabinets?: boolean | null
          has_pets?: boolean | null
          id?: string
          is_empty_property?: boolean | null
          kitchen_count?: number | null
          living_rooms?: number | null
          name?: string
          office_rooms?: number | null
          phone?: string | null
          preferred_contact?: string | null
          property_size?: string | null
          property_type?: string | null
          selected_addons?: Json | null
          service_type?: string | null
          square_footage?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string
          display_order: number
          features: string[]
          icon: string
          id: string
          image_url: string | null
          is_active: boolean
          price_starting: string | null
          service_category: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          features?: string[]
          icon?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          price_starting?: string | null
          service_category?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          features?: string[]
          icon?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          price_starting?: string | null
          service_category?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          author_name: string
          author_role: string
          content: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          rating: number
          updated_at: string
        }
        Insert: {
          author_name: string
          author_role?: string
          content: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          rating?: number
          updated_at?: string
        }
        Update: {
          author_name?: string
          author_role?: string
          content?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      check_recent_submission: {
        Args: { p_email: string; p_table: string }
        Returns: boolean
      }
      get_booked_slots: {
        Args: { p_date: string }
        Returns: {
          time_slot: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "manager" | "staff"
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
      app_role: ["admin", "user", "manager", "staff"],
    },
  },
} as const
