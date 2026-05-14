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
      deliverable_dividers: {
        Row: {
          client_id: string
          created_at: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      deliverable_folders: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      deliverables: {
        Row: {
          attachments: Json
          checklist: Json
          client_id: string
          created_at: string
          description: string | null
          due_date: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          folder_id: string | null
          id: string
          instagram_post_id: string | null
          mime_type: string | null
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          title: string
          type: Database["public"]["Enums"]["deliverable_type"]
          updated_at: string
        }
        Insert: {
          attachments?: Json
          checklist?: Json
          client_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          folder_id?: string | null
          id?: string
          instagram_post_id?: string | null
          mime_type?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          type?: Database["public"]["Enums"]["deliverable_type"]
          updated_at?: string
        }
        Update: {
          attachments?: Json
          checklist?: Json
          client_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          folder_id?: string | null
          id?: string
          instagram_post_id?: string | null
          mime_type?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          type?: Database["public"]["Enums"]["deliverable_type"]
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
          {
            foreignKeyName: "deliverables_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "deliverable_folders"
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
          media_urls: string[]
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
          media_urls?: string[]
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
          media_urls?: string[]
          position?: number
          title?: string | null
          type?: Database["public"]["Enums"]["ig_post_type"]
          updated_at?: string
        }
        Relationships: []
      }
      instagram_post_comments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          position: number
          post_id: string
          text: string
          username: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          position?: number
          post_id: string
          text?: string
          username?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          position?: number
          post_id?: string
          text?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "instagram_posts"
            referencedColumns: ["id"]
          },
        ]
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
          likes_count: number
          location: string | null
          music: string | null
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
          likes_count?: number
          location?: string | null
          music?: string | null
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
          likes_count?: number
          location?: string | null
          music?: string | null
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
          current_contact_email: string | null
          current_contact_phone: string | null
          current_display_name: string | null
          current_followers: number | null
          current_following: number | null
          current_link: string | null
          current_posts_count: number | null
          current_show_contact_button: boolean
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
          proposed_contact_email: string | null
          proposed_contact_phone: string | null
          proposed_display_name: string | null
          proposed_followers: number | null
          proposed_following: number | null
          proposed_link: string | null
          proposed_posts_count: number | null
          proposed_show_contact_button: boolean
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
          current_contact_email?: string | null
          current_contact_phone?: string | null
          current_display_name?: string | null
          current_followers?: number | null
          current_following?: number | null
          current_link?: string | null
          current_posts_count?: number | null
          current_show_contact_button?: boolean
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
          proposed_contact_email?: string | null
          proposed_contact_phone?: string | null
          proposed_display_name?: string | null
          proposed_followers?: number | null
          proposed_following?: number | null
          proposed_link?: string | null
          proposed_posts_count?: number | null
          proposed_show_contact_button?: boolean
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
          current_contact_email?: string | null
          current_contact_phone?: string | null
          current_display_name?: string | null
          current_followers?: number | null
          current_following?: number | null
          current_link?: string | null
          current_posts_count?: number | null
          current_show_contact_button?: boolean
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
          proposed_contact_email?: string | null
          proposed_contact_phone?: string | null
          proposed_display_name?: string | null
          proposed_followers?: number | null
          proposed_following?: number | null
          proposed_link?: string | null
          proposed_posts_count?: number | null
          proposed_show_contact_button?: boolean
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
      meta_ads_accounts: {
        Row: {
          ad_account_id: string | null
          business_name: string | null
          client_id: string
          created_at: string
          id: string
          instagram_actor_id: string | null
          last_synced_at: string | null
          page_id: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id?: string | null
          business_name?: string | null
          client_id: string
          created_at?: string
          id?: string
          instagram_actor_id?: string | null
          last_synced_at?: string | null
          page_id?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string | null
          business_name?: string | null
          client_id?: string
          created_at?: string
          id?: string
          instagram_actor_id?: string | null
          last_synced_at?: string | null
          page_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_ads_ads: {
        Row: {
          adset_id: string
          carousel_urls: string[]
          client_id: string
          created_at: string
          cta: Database["public"]["Enums"]["meta_cta"] | null
          description: string | null
          fb_ad_id: string | null
          format: string
          headline: string | null
          id: string
          image_url: string | null
          link_url: string | null
          name: string
          placement: Database["public"]["Enums"]["meta_placement"]
          position: number
          primary_text: string | null
          status: Database["public"]["Enums"]["meta_status"]
          updated_at: string
          video_url: string | null
        }
        Insert: {
          adset_id: string
          carousel_urls?: string[]
          client_id: string
          created_at?: string
          cta?: Database["public"]["Enums"]["meta_cta"] | null
          description?: string | null
          fb_ad_id?: string | null
          format?: string
          headline?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          name?: string
          placement?: Database["public"]["Enums"]["meta_placement"]
          position?: number
          primary_text?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          adset_id?: string
          carousel_urls?: string[]
          client_id?: string
          created_at?: string
          cta?: Database["public"]["Enums"]["meta_cta"] | null
          description?: string | null
          fb_ad_id?: string | null
          format?: string
          headline?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          name?: string
          placement?: Database["public"]["Enums"]["meta_placement"]
          position?: number
          primary_text?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_ads_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "meta_ads_adsets"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads_adsets: {
        Row: {
          age_max: number | null
          age_min: number | null
          audience_summary: string | null
          billing_event: string | null
          campaign_id: string
          client_id: string
          countries: string | null
          created_at: string
          daily_budget: number | null
          fb_adset_id: string | null
          genders: string | null
          id: string
          lifetime_budget: number | null
          name: string
          optimization_goal: string | null
          position: number
          status: Database["public"]["Enums"]["meta_status"]
          updated_at: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          audience_summary?: string | null
          billing_event?: string | null
          campaign_id: string
          client_id: string
          countries?: string | null
          created_at?: string
          daily_budget?: number | null
          fb_adset_id?: string | null
          genders?: string | null
          id?: string
          lifetime_budget?: number | null
          name?: string
          optimization_goal?: string | null
          position?: number
          status?: Database["public"]["Enums"]["meta_status"]
          updated_at?: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          audience_summary?: string | null
          billing_event?: string | null
          campaign_id?: string
          client_id?: string
          countries?: string | null
          created_at?: string
          daily_budget?: number | null
          fb_adset_id?: string | null
          genders?: string | null
          id?: string
          lifetime_budget?: number | null
          name?: string
          optimization_goal?: string | null
          position?: number
          status?: Database["public"]["Enums"]["meta_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_adsets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_ads_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads_campaigns: {
        Row: {
          client_id: string
          created_at: string
          currency: string | null
          daily_budget: number | null
          fb_campaign_id: string | null
          id: string
          lifetime_budget: number | null
          name: string
          notes: string | null
          objective: Database["public"]["Enums"]["meta_campaign_objective"]
          position: number
          start_time: string | null
          status: Database["public"]["Enums"]["meta_status"]
          stop_time: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          currency?: string | null
          daily_budget?: number | null
          fb_campaign_id?: string | null
          id?: string
          lifetime_budget?: number | null
          name?: string
          notes?: string | null
          objective?: Database["public"]["Enums"]["meta_campaign_objective"]
          position?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          stop_time?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          currency?: string | null
          daily_budget?: number | null
          fb_campaign_id?: string | null
          id?: string
          lifetime_budget?: number | null
          name?: string
          notes?: string | null
          objective?: Database["public"]["Enums"]["meta_campaign_objective"]
          position?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          stop_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_ads_insights: {
        Row: {
          campaign_id: string
          clicks: number
          client_id: string
          conversions: number
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          date_start: string | null
          date_stop: string | null
          id: string
          impressions: number
          notes: string | null
          purchase_value: number | null
          reach: number
          roas: number | null
          spend: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          clicks?: number
          client_id: string
          conversions?: number
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date_start?: string | null
          date_stop?: string | null
          id?: string
          impressions?: number
          notes?: string | null
          purchase_value?: number | null
          reach?: number
          roas?: number | null
          spend?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          clicks?: number
          client_id?: string
          conversions?: number
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date_start?: string | null
          date_stop?: string | null
          id?: string
          impressions?: number
          notes?: string | null
          purchase_value?: number | null
          reach?: number
          roas?: number | null
          spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_insights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_ads_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          category: Database["public"]["Enums"]["objective_category"]
          client_id: string
          created_at: string
          current_value: number | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["objective_priority"]
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["objective_category"]
          client_id: string
          created_at?: string
          current_value?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["objective_priority"]
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["objective_category"]
          client_id?: string
          created_at?: string
          current_value?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["objective_priority"]
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          target_value?: number | null
          title?: string
          unit?: string | null
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
      deliverable_type:
        | "post"
        | "reel"
        | "story"
        | "design"
        | "meeting"
        | "report"
        | "other"
      ig_post_type: "current" | "proposed"
      meta_campaign_objective:
        | "OUTCOME_AWARENESS"
        | "OUTCOME_TRAFFIC"
        | "OUTCOME_ENGAGEMENT"
        | "OUTCOME_LEADS"
        | "OUTCOME_APP_PROMOTION"
        | "OUTCOME_SALES"
      meta_cta:
        | "LEARN_MORE"
        | "SHOP_NOW"
        | "SIGN_UP"
        | "SUBSCRIBE"
        | "CONTACT_US"
        | "BOOK_TRAVEL"
        | "DOWNLOAD"
        | "GET_OFFER"
        | "APPLY_NOW"
        | "SEND_MESSAGE"
        | "WATCH_MORE"
      meta_placement:
        | "feed"
        | "stories"
        | "reels"
        | "marketplace"
        | "search"
        | "audience_network"
      meta_status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED" | "DRAFT"
      objective_category:
        | "growth"
        | "engagement"
        | "sales"
        | "branding"
        | "other"
      objective_priority: "low" | "medium" | "high"
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
      deliverable_type: [
        "post",
        "reel",
        "story",
        "design",
        "meeting",
        "report",
        "other",
      ],
      ig_post_type: ["current", "proposed"],
      meta_campaign_objective: [
        "OUTCOME_AWARENESS",
        "OUTCOME_TRAFFIC",
        "OUTCOME_ENGAGEMENT",
        "OUTCOME_LEADS",
        "OUTCOME_APP_PROMOTION",
        "OUTCOME_SALES",
      ],
      meta_cta: [
        "LEARN_MORE",
        "SHOP_NOW",
        "SIGN_UP",
        "SUBSCRIBE",
        "CONTACT_US",
        "BOOK_TRAVEL",
        "DOWNLOAD",
        "GET_OFFER",
        "APPLY_NOW",
        "SEND_MESSAGE",
        "WATCH_MORE",
      ],
      meta_placement: [
        "feed",
        "stories",
        "reels",
        "marketplace",
        "search",
        "audience_network",
      ],
      meta_status: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED", "DRAFT"],
      objective_category: [
        "growth",
        "engagement",
        "sales",
        "branding",
        "other",
      ],
      objective_priority: ["low", "medium", "high"],
      payment_status: ["pending", "paid", "overdue", "cancelled"],
      post_format: ["photo", "carousel", "reel"],
      task_status: ["pending", "in_progress", "done"],
    },
  },
} as const
