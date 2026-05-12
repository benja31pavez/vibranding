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
      clients: {
        Row: {
          created_at: string
          id: string
          instagram_handle: string | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instagram_handle?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instagram_handle?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deliverables: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_highlights: {
        Row: {
          client_id: string
          cover_url: string | null
          created_at: string
          id: string
          position: number
          title: string | null
          type: Database["public"]["Enums"]["ig_post_type"]
          updated_at: string
        }
        Insert: {
          client_id: string
          cover_url?: string | null
          created_at?: string
          id?: string
          position?: number
          title?: string | null
          type: Database["public"]["Enums"]["ig_post_type"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          position?: number
          title?: string | null
          type?: Database["public"]["Enums"]["ig_post_type"]
          updated_at?: string
        }
        Relationships: []
      }
      instagram_posts: {
        Row: {
          caption: string | null
          carousel_urls: string[]
          client_id: string
          close_friends_only: boolean
          cover_url: string | null
          created_at: string
          format: Database["public"]["Enums"]["post_format"]
          id: string
          image_url: string | null
          is_trial_reel: boolean
          objective: string | null
          position: number
          scheduled_at: string | null
          type: Database["public"]["Enums"]["ig_post_type"]
          updated_at: string
        }
        Insert: {
          caption?: string | null
          carousel_urls?: string[]
          client_id: string
          close_friends_only?: boolean
          cover_url?: string | null
          created_at?: string
          format?: Database["public"]["Enums"]["post_format"]
          id?: string
          image_url?: string | null
          is_trial_reel?: boolean
          objective?: string | null
          position?: number
          scheduled_at?: string | null
          type: Database["public"]["Enums"]["ig_post_type"]
          updated_at?: string
        }
        Update: {
          caption?: string | null
          carousel_urls?: string[]
          client_id?: string
          close_friends_only?: boolean
          cover_url?: string | null
          created_at?: string
          format?: Database["public"]["Enums"]["post_format"]
          id?: string
          image_url?: string | null
          is_trial_reel?: boolean
          objective?: string | null
          position?: number
          scheduled_at?: string | null
          type?: Database["public"]["Enums"]["ig_post_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_profiles: {
        Row: {
          client_id: string
          created_at: string
          current_account_type: Database["public"]["Enums"]["account_type"]
          current_avatar_url: string | null
          current_bio: string | null
          current_category: string | null
          current_display_name: string | null
          current_followers: number | null
          current_following: number | null
          current_link: string | null
          current_posts_count: number | null
          current_song: string | null
          current_song_enabled: boolean
          current_threads_enabled: boolean
          current_threads_handle: string | null
          current_username: string | null
          current_verified: boolean
          id: string
          proposed_account_type: Database["public"]["Enums"]["account_type"]
          proposed_avatar_url: string | null
          proposed_bio: string | null
          proposed_category: string | null
          proposed_display_name: string | null
          proposed_followers: number | null
          proposed_following: number | null
          proposed_link: string | null
          proposed_posts_count: number | null
          proposed_song: string | null
          proposed_song_enabled: boolean
          proposed_threads_enabled: boolean
          proposed_threads_handle: string | null
          proposed_username: string | null
          proposed_verified: boolean
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          current_account_type?: Database["public"]["Enums"]["account_type"]
          current_avatar_url?: string | null
          current_bio?: string | null
          current_category?: string | null
          current_display_name?: string | null
          current_followers?: number | null
          current_following?: number | null
          current_link?: string | null
          current_posts_count?: number | null
          current_song?: string | null
          current_song_enabled?: boolean
          current_threads_enabled?: boolean
          current_threads_handle?: string | null
          current_username?: string | null
          current_verified?: boolean
          id?: string
          proposed_account_type?: Database["public"]["Enums"]["account_type"]
          proposed_avatar_url?: string | null
          proposed_bio?: string | null
          proposed_category?: string | null
          proposed_display_name?: string | null
          proposed_followers?: number | null
          proposed_following?: number | null
          proposed_link?: string | null
          proposed_posts_count?: number | null
          proposed_song?: string | null
          proposed_song_enabled?: boolean
          proposed_threads_enabled?: boolean
          proposed_threads_handle?: string | null
          proposed_username?: string | null
          proposed_verified?: boolean
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          current_account_type?: Database["public"]["Enums"]["account_type"]
          current_avatar_url?: string | null
          current_bio?: string | null
          current_category?: string | null
          current_display_name?: string | null
          current_followers?: number | null
          current_following?: number | null
          current_link?: string | null
          current_posts_count?: number | null
          current_song?: string | null
          current_song_enabled?: boolean
          current_threads_enabled?: boolean
          current_threads_handle?: string | null
          current_username?: string | null
          current_verified?: boolean
          id?: string
          proposed_account_type?: Database["public"]["Enums"]["account_type"]
          proposed_avatar_url?: string | null
          proposed_bio?: string | null
          proposed_category?: string | null
          proposed_display_name?: string | null
          proposed_followers?: number | null
          proposed_following?: number | null
          proposed_link?: string | null
          proposed_posts_count?: number | null
          proposed_song?: string | null
          proposed_song_enabled?: boolean
          proposed_threads_enabled?: boolean
          proposed_threads_handle?: string | null
          proposed_username?: string | null
          proposed_verified?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          currency: string
          description: string | null
          due_date: string | null
          id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_settings: {
        Row: {
          carousel_price: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          pack_description: string | null
          pack_price: number
          photo_price: number
          reel_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          carousel_price?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          pack_description?: string | null
          pack_price?: number
          photo_price?: number
          reel_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          carousel_price?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          pack_description?: string | null
          pack_price?: number
          photo_price?: number
          reel_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owns_client: { Args: { _client_id: string }; Returns: boolean }
    }
    Enums: {
      account_type: "personal" | "business"
      ig_post_type: "current" | "proposed"
      payment_status: "pending" | "paid" | "overdue" | "cancelled"
      post_format: "photo" | "carousel" | "reel"
      task_status: "pending" | "in_progress" | "done"
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
      account_type: ["personal", "business"],
      ig_post_type: ["current", "proposed"],
      payment_status: ["pending", "paid", "overdue", "cancelled"],
      post_format: ["photo", "carousel", "reel"],
      task_status: ["pending", "in_progress", "done"],
    },
  },
} as const
