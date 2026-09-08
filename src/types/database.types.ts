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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analysis: {
        Row: {
          alignment_mode: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          region: string | null
          show_base100: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          alignment_mode?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          region?: string | null
          show_base100?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          alignment_mode?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          region?: string | null
          show_base100?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      analysis_indicators: {
        Row: {
          analysis_id: string
          indicator_id: string
          sort_order: number
        }
        Insert: {
          analysis_id: string
          indicator_id: string
          sort_order?: number
        }
        Update: {
          analysis_id?: string
          indicator_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "analysis_indicators_analysis_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_macro_events: {
        Row: {
          analysis_id: string
          macro_event_id: string
          marker_color: string | null
          marker_mode: string | null
        }
        Insert: {
          analysis_id: string
          macro_event_id: string
          marker_color?: string | null
          marker_mode?: string | null
        }
        Update: {
          analysis_id?: string
          macro_event_id?: string
          marker_color?: string | null
          marker_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_macro_events_analysis_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_macro_events_event_fkey"
            columns: ["macro_event_id"]
            isOneToOne: false
            referencedRelation: "macro_events"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_periods: {
        Row: {
          analysis_id: string
          color: string
          end_date: string
          id: string
          name: string
          sort_order: number
          start_date: string
        }
        Insert: {
          analysis_id: string
          color: string
          end_date: string
          id: string
          name: string
          sort_order?: number
          start_date: string
        }
        Update: {
          analysis_id?: string
          color?: string
          end_date?: string
          id?: string
          name?: string
          sort_order?: number
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_periods_analysis_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_source_selections: {
        Row: {
          analysis_id: string
          date: string
          indicator_id: string
          post_id: string
        }
        Insert: {
          analysis_id: string
          date: string
          indicator_id: string
          post_id: string
        }
        Update: {
          analysis_id?: string
          date?: string
          indicator_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_source_selections_analysis_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_source_selections_post_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "approved_series_view"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "analysis_source_selections_post_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "serie_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_source_selections_post_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "validation_summary"
            referencedColumns: ["post_id"]
          },
        ]
      }
      macro_events: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          geo_region: string | null
          geo_scope: string | null
          id: string
          name: string
          source_url: string
          start_date: string
          topic: Database["public"]["Enums"]["macro_event_topic"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          geo_region?: string | null
          geo_scope?: string | null
          id?: string
          name: string
          source_url: string
          start_date: string
          topic: Database["public"]["Enums"]["macro_event_topic"]
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          geo_region?: string | null
          geo_scope?: string | null
          id?: string
          name?: string
          source_url?: string
          start_date?: string
          topic?: Database["public"]["Enums"]["macro_event_topic"]
        }
        Relationships: []
      }
      serie_data: {
        Row: {
          date: string
          id: string
          post_id: string
          value: number
        }
        Insert: {
          date: string
          id?: string
          post_id: string
          value: number
        }
        Update: {
          date?: string
          id?: string
          post_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "serie_data_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "approved_series_view"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "serie_data_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "serie_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serie_data_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "validation_summary"
            referencedColumns: ["post_id"]
          },
        ]
      }
      serie_posts: {
        Row: {
          created_at: string
          data_source: string
          frequency: string
          id: string
          indicator_id: string
          notes: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          data_source: string
          frequency: string
          id?: string
          indicator_id: string
          notes?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          data_source?: string
          frequency?: string
          id?: string
          indicator_id?: string
          notes?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      serie_validations: {
        Row: {
          created_at: string
          id: string
          post_id: string
          validated_at: string
          validated_by: string
          validation_notes: string | null
          validation_status: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          validated_at?: string
          validated_by: string
          validation_notes?: string | null
          validation_status: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          validated_at?: string
          validated_by?: string
          validation_notes?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "serie_validations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "approved_series_view"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "serie_validations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "serie_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serie_validations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "validation_summary"
            referencedColumns: ["post_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role: string
          user_id: string
        }
        Insert: {
          role: string
          user_id: string
        }
        Update: {
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      approved_series_view: {
        Row: {
          data_source: string | null
          date: string | null
          frequency: string | null
          indicator_id: string | null
          post_id: string | null
          value: number | null
        }
        Relationships: []
      }
      duplicate_data_detector: {
        Row: {
          data_source: string | null
          date: string | null
          first_submission: string | null
          indicator_id: string | null
          last_submission: string | null
          occurrence_count: number | null
          post_ids: string[] | null
          submitters: string[] | null
          value: number | null
        }
        Relationships: []
      }
      validation_summary: {
        Row: {
          approvals: number | null
          approved_by: string[] | null
          indicator_id: string | null
          post_id: string | null
          post_status: string | null
          rejected_by: string[] | null
          rejections: number | null
          submitted_at: string | null
          submitted_by: string | null
          total_validations: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      macro_event_topic: "politics" | "economy" | "nature" | "health" | "social"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      macro_event_topic: ["politics", "economy", "nature", "health", "social"],
    },
  },
} as const
