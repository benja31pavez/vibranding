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
      client_contracts: {
        Row: {
          agency_snapshot: Json
          clauses_snapshot: Json
          client_id: string
          client_snapshot: Json
          created_at: string
          currency: string
          effective_date: string | null
          id: string
          notes: string | null
          payment_due_days: number
          services_snapshot: Json
          signed_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          title: string
          total_monthly: number
          total_one_time: number
          updated_at: string
        }
        Insert: {
          agency_snapshot?: Json
          clauses_snapshot?: Json
          client_id: string
          client_snapshot?: Json
          created_at?: string
          currency?: string
          effective_date?: string | null
          id?: string
          notes?: string | null
          payment_due_days?: number
          services_snapshot?: Json
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string
          total_monthly?: number
          total_one_time?: number
          updated_at?: string
        }
        Update: {
          agency_snapshot?: Json
          clauses_snapshot?: Json
          client_id?: string
          client_snapshot?: Json
          created_at?: string
          currency?: string
          effective_date?: string | null
          id?: string
          notes?: string | null
          payment_due_days?: number
          services_snapshot?: Json
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string
          total_monthly?: number
          total_one_time?: number
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          business_description: string | null
          created_at: string
          id: string
          instagram_handle: string | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_description?: string | null
          created_at?: string
          id?: string
          instagram_handle?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_description?: string | null
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
      deliverable_comments: {
        Row: {
          author: string
          body: string
          client_id: string
          created_at: string
          deliverable_id: string
          id: string
          kind: string
        }
        Insert: {
          author?: string
          body?: string
          client_id: string
          created_at?: string
          deliverable_id: string
          id?: string
          kind?: string
        }
        Update: {
          author?: string
          body?: string
          client_id?: string
          created_at?: string
          deliverable_id?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_comments_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
        ]
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
      landing_contact_submissions: {
        Row: {
          client_id: string
          created_at: string
          email: string
          id: string
          landing_id: string
          message: string
          name: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email: string
          id?: string
          landing_id: string
          message: string
          name: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          landing_id?: string
          message?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_contact_submissions_landing_id_fkey"
            columns: ["landing_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          lang: string | null
          path: string | null
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          lang?: string | null
          path?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          lang?: string | null
          path?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      landing_pages: {
        Row: {
          client_id: string
          contact_enabled: boolean
          created_at: string
          cta_text: string | null
          cta_url: string | null
          gallery: Json
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string
          id: string
          published: boolean
          services: Json
          slug: string
          theme_color: string
          updated_at: string
          view_count: number
        }
        Insert: {
          client_id: string
          contact_enabled?: boolean
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          gallery?: Json
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string
          id?: string
          published?: boolean
          services?: Json
          slug: string
          theme_color?: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          client_id?: string
          contact_enabled?: boolean
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          gallery?: Json
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string
          id?: string
          published?: boolean
          services?: Json
          slug?: string
          theme_color?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
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
          carousel_cards: Json
          carousel_urls: string[]
          client_id: string
          created_at: string
          cta: Database["public"]["Enums"]["meta_cta"] | null
          description: string | null
          display_url: string | null
          fb_ad_id: string | null
          fb_adset_id: string | null
          fb_creative_id: string | null
          format: string
          headline: string | null
          id: string
          image_url: string | null
          instagram_actor_id: string | null
          link_url: string | null
          multi_share_end_card: boolean
          name: string
          optimize_carousel_order: boolean
          page_id: string | null
          placement: Database["public"]["Enums"]["meta_placement"]
          position: number
          primary_text: string | null
          status: Database["public"]["Enums"]["meta_status"]
          updated_at: string
          utm_params: Json | null
          video_url: string | null
        }
        Insert: {
          adset_id: string
          carousel_cards?: Json
          carousel_urls?: string[]
          client_id: string
          created_at?: string
          cta?: Database["public"]["Enums"]["meta_cta"] | null
          description?: string | null
          display_url?: string | null
          fb_ad_id?: string | null
          fb_adset_id?: string | null
          fb_creative_id?: string | null
          format?: string
          headline?: string | null
          id?: string
          image_url?: string | null
          instagram_actor_id?: string | null
          link_url?: string | null
          multi_share_end_card?: boolean
          name?: string
          optimize_carousel_order?: boolean
          page_id?: string | null
          placement?: Database["public"]["Enums"]["meta_placement"]
          position?: number
          primary_text?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          updated_at?: string
          utm_params?: Json | null
          video_url?: string | null
        }
        Update: {
          adset_id?: string
          carousel_cards?: Json
          carousel_urls?: string[]
          client_id?: string
          created_at?: string
          cta?: Database["public"]["Enums"]["meta_cta"] | null
          description?: string | null
          display_url?: string | null
          fb_ad_id?: string | null
          fb_adset_id?: string | null
          fb_creative_id?: string | null
          format?: string
          headline?: string | null
          id?: string
          image_url?: string | null
          instagram_actor_id?: string | null
          link_url?: string | null
          multi_share_end_card?: boolean
          name?: string
          optimize_carousel_order?: boolean
          page_id?: string | null
          placement?: Database["public"]["Enums"]["meta_placement"]
          position?: number
          primary_text?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          updated_at?: string
          utm_params?: Json | null
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
          behaviors: string | null
          bid_amount: number | null
          billing_event: string | null
          campaign_id: string
          cities: string | null
          client_id: string
          countries: string | null
          created_at: string
          custom_audiences: string[]
          daily_budget: number | null
          demographics: string | null
          device_platforms: string[]
          end_time: string | null
          excluded_audiences: string[]
          fb_adset_id: string | null
          genders: string | null
          id: string
          interests: string | null
          languages: string | null
          lifetime_budget: number | null
          lookalike_audiences: string[]
          name: string
          optimization_goal: string | null
          placement_mode: string
          placements: string[]
          position: number
          start_time: string | null
          status: Database["public"]["Enums"]["meta_status"]
          updated_at: string
          user_os: string[]
          wifi_only: boolean
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          audience_summary?: string | null
          behaviors?: string | null
          bid_amount?: number | null
          billing_event?: string | null
          campaign_id: string
          cities?: string | null
          client_id: string
          countries?: string | null
          created_at?: string
          custom_audiences?: string[]
          daily_budget?: number | null
          demographics?: string | null
          device_platforms?: string[]
          end_time?: string | null
          excluded_audiences?: string[]
          fb_adset_id?: string | null
          genders?: string | null
          id?: string
          interests?: string | null
          languages?: string | null
          lifetime_budget?: number | null
          lookalike_audiences?: string[]
          name?: string
          optimization_goal?: string | null
          placement_mode?: string
          placements?: string[]
          position?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          updated_at?: string
          user_os?: string[]
          wifi_only?: boolean
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          audience_summary?: string | null
          behaviors?: string | null
          bid_amount?: number | null
          billing_event?: string | null
          campaign_id?: string
          cities?: string | null
          client_id?: string
          countries?: string | null
          created_at?: string
          custom_audiences?: string[]
          daily_budget?: number | null
          demographics?: string | null
          device_platforms?: string[]
          end_time?: string | null
          excluded_audiences?: string[]
          fb_adset_id?: string | null
          genders?: string | null
          id?: string
          interests?: string | null
          languages?: string | null
          lifetime_budget?: number | null
          lookalike_audiences?: string[]
          name?: string
          optimization_goal?: string | null
          placement_mode?: string
          placements?: string[]
          position?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          updated_at?: string
          user_os?: string[]
          wifi_only?: boolean
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
          bid_strategy: string | null
          buying_type: string
          cbo_enabled: boolean
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
          spend_cap: number | null
          start_time: string | null
          status: Database["public"]["Enums"]["meta_status"]
          stop_time: string | null
          updated_at: string
        }
        Insert: {
          bid_strategy?: string | null
          buying_type?: string
          cbo_enabled?: boolean
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
          spend_cap?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          stop_time?: string | null
          updated_at?: string
        }
        Update: {
          bid_strategy?: string | null
          buying_type?: string
          cbo_enabled?: boolean
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
          spend_cap?: number | null
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
      multilink_items: {
        Row: {
          click_count: number
          client_id: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          multilink_id: string
          sort_order: number
          title: string
          url: string
        }
        Insert: {
          click_count?: number
          client_id: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          multilink_id: string
          sort_order?: number
          title?: string
          url?: string
        }
        Update: {
          click_count?: number
          client_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          multilink_id?: string
          sort_order?: number
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "multilink_items_multilink_id_fkey"
            columns: ["multilink_id"]
            isOneToOne: false
            referencedRelation: "multilinks"
            referencedColumns: ["id"]
          },
        ]
      }
      multilinks: {
        Row: {
          avatar_url: string | null
          bio: string | null
          client_id: string
          created_at: string
          id: string
          published: boolean
          slug: string
          theme_color: string
          theme_mode: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          client_id: string
          created_at?: string
          id?: string
          published?: boolean
          slug: string
          theme_color?: string
          theme_mode?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          client_id?: string
          created_at?: string
          id?: string
          published?: boolean
          slug?: string
          theme_color?: string
          theme_mode?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
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
      portfolio_clients: {
        Row: {
          created_at: string
          description: string | null
          id: string
          industry: string | null
          is_visible: boolean
          logo_url: string | null
          name: string
          sort_order: number
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          is_visible?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          is_visible?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      portfolio_works: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_visible: boolean
          link_url: string | null
          portfolio_client_id: string
          sort_order: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          link_url?: string | null
          portfolio_client_id: string
          sort_order?: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          link_url?: string | null
          portfolio_client_id?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_works_portfolio_client_id_fkey"
            columns: ["portfolio_client_id"]
            isOneToOne: false
            referencedRelation: "portfolio_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_settings: {
        Row: {
          agency_address: string | null
          agency_email: string | null
          agency_legal_name: string | null
          agency_tax_id: string | null
          carousel_price: number
          clause_esim: string | null
          clause_extra: string | null
          clause_late_payment: string | null
          clause_meta_api: string | null
          created_at: string
          currency: string
          id: string
          jurisdiction: string | null
          notes: string | null
          pack_description: string | null
          pack_price: number
          payment_due_days: number
          photo_price: number
          reel_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_address?: string | null
          agency_email?: string | null
          agency_legal_name?: string | null
          agency_tax_id?: string | null
          carousel_price?: number
          clause_esim?: string | null
          clause_extra?: string | null
          clause_late_payment?: string | null
          clause_meta_api?: string | null
          created_at?: string
          currency?: string
          id?: string
          jurisdiction?: string | null
          notes?: string | null
          pack_description?: string | null
          pack_price?: number
          payment_due_days?: number
          photo_price?: number
          reel_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_address?: string | null
          agency_email?: string | null
          agency_legal_name?: string | null
          agency_tax_id?: string | null
          carousel_price?: number
          clause_esim?: string | null
          clause_extra?: string | null
          clause_late_payment?: string | null
          clause_meta_api?: string | null
          created_at?: string
          currency?: string
          id?: string
          jurisdiction?: string | null
          notes?: string | null
          pack_description?: string | null
          pack_price?: number
          payment_due_days?: number
          photo_price?: number
          reel_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_pricing: {
        Row: {
          created_at: string
          id: string
          included_text: string | null
          is_active: boolean
          monthly_price: number
          one_time_price: number
          service_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          included_text?: string | null
          is_active?: boolean
          monthly_price?: number
          one_time_price?: number
          service_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          included_text?: string | null
          is_active?: boolean
          monthly_price?: number
          one_time_price?: number
          service_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_accounts: {
        Row: {
          access_token: string | null
          ai_business_context: string | null
          ai_debounce_seconds: number
          ai_enabled: boolean
          ai_max_history: number
          ai_model: string
          ai_system_prompt: string
          client_id: string
          connected: boolean
          created_at: string
          display_phone_number: string | null
          id: string
          last_synced_at: string | null
          phone_number_id: string | null
          updated_at: string
          verify_token: string
          waba_id: string | null
        }
        Insert: {
          access_token?: string | null
          ai_business_context?: string | null
          ai_debounce_seconds?: number
          ai_enabled?: boolean
          ai_max_history?: number
          ai_model?: string
          ai_system_prompt?: string
          client_id: string
          connected?: boolean
          created_at?: string
          display_phone_number?: string | null
          id?: string
          last_synced_at?: string | null
          phone_number_id?: string | null
          updated_at?: string
          verify_token?: string
          waba_id?: string | null
        }
        Update: {
          access_token?: string | null
          ai_business_context?: string | null
          ai_debounce_seconds?: number
          ai_enabled?: boolean
          ai_max_history?: number
          ai_model?: string
          ai_system_prompt?: string
          client_id?: string
          connected?: boolean
          created_at?: string
          display_phone_number?: string | null
          id?: string
          last_synced_at?: string | null
          phone_number_id?: string | null
          updated_at?: string
          verify_token?: string
          waba_id?: string | null
        }
        Relationships: []
      }
      whatsapp_bot_rules: {
        Row: {
          actions: Json
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          keywords: string[]
          mark_as_lead: boolean
          match_type: string
          name: string
          priority: number
          response_text: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          mark_as_lead?: boolean
          match_type?: string
          name?: string
          priority?: number
          response_text?: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          mark_as_lead?: boolean
          match_type?: string
          name?: string
          priority?: number
          response_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          account_id: string
          ai_paused: boolean
          client_id: string
          contact_name: string | null
          contact_wa_id: string
          created_at: string
          id: string
          is_lead: boolean
          last_bot_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          pending_response_at: string | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          account_id: string
          ai_paused?: boolean
          client_id: string
          contact_name?: string | null
          contact_wa_id: string
          created_at?: string
          id?: string
          is_lead?: boolean
          last_bot_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          pending_response_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          ai_paused?: boolean
          client_id?: string
          contact_name?: string | null
          contact_wa_id?: string
          created_at?: string
          id?: string
          is_lead?: boolean
          last_bot_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          pending_response_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          client_id: string
          conversation_id: string
          created_at: string
          direction: string
          from_bot: boolean
          id: string
          media_url: string | null
          status: string | null
          timestamp: string
          type: string
          wa_message_id: string | null
        }
        Insert: {
          body?: string | null
          client_id: string
          conversation_id: string
          created_at?: string
          direction: string
          from_bot?: boolean
          id?: string
          media_url?: string | null
          status?: string | null
          timestamp?: string
          type?: string
          wa_message_id?: string | null
        }
        Update: {
          body?: string | null
          client_id?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          from_bot?: boolean
          id?: string
          media_url?: string | null
          status?: string | null
          timestamp?: string
          type?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_landing_view: { Args: { _id: string }; Returns: undefined }
      increment_multilink_click: { Args: { _id: string }; Returns: undefined }
      increment_multilink_view: { Args: { _id: string }; Returns: undefined }
      owns_client: { Args: { _client_id: string }; Returns: boolean }
    }
    Enums: {
      account_type: "personal" | "business"
      contract_status: "draft" | "sent" | "signed" | "cancelled"
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
        | "BOOK_NOW"
        | "GET_QUOTE"
        | "GET_DIRECTIONS"
        | "CALL_NOW"
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
      task_status: "pending" | "in_progress" | "in_review" | "done"
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
      contract_status: ["draft", "sent", "signed", "cancelled"],
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
        "BOOK_NOW",
        "GET_QUOTE",
        "GET_DIRECTIONS",
        "CALL_NOW",
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
      task_status: ["pending", "in_progress", "in_review", "done"],
    },
  },
} as const
