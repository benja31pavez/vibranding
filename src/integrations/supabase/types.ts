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
      ad_insights_daily: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number
          client_id: string
          cpm: number | null
          created_at: string
          ctr: number | null
          currency: string | null
          date: string
          entity_id: string
          id: string
          impressions: number
          level: string
          messaging_conversations_started: number
          reach: number
          spend: number
          updated_at: string
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          client_id: string
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          currency?: string | null
          date: string
          entity_id: string
          id?: string
          impressions?: number
          level?: string
          messaging_conversations_started?: number
          reach?: number
          spend?: number
          updated_at?: string
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          client_id?: string
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          currency?: string | null
          date?: string
          entity_id?: string
          id?: string
          impressions?: number
          level?: string
          messaging_conversations_started?: number
          reach?: number
          spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_insights_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      attributions: {
        Row: {
          ad_id: string | null
          client_id: string
          conversation_id: string | null
          created_at: string
          ctwa_clid: string
          first_seen_at: string
          headline: string | null
          id: string
          source_type: string | null
          source_url: string | null
        }
        Insert: {
          ad_id?: string | null
          client_id: string
          conversation_id?: string | null
          created_at?: string
          ctwa_clid: string
          first_seen_at?: string
          headline?: string | null
          id?: string
          source_type?: string | null
          source_url?: string | null
        }
        Update: {
          ad_id?: string | null
          client_id?: string
          conversation_id?: string | null
          created_at?: string
          ctwa_clid?: string
          first_seen_at?: string
          headline?: string | null
          id?: string
          source_type?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attributions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_settings: {
        Row: {
          client_id: string | null
          created_at: string
          display_name: string
          enabled: boolean
          hours: Json
          id: string
          intro: string | null
          notification_email: string | null
          owner_user_id: string
          slot_minutes: number
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          display_name?: string
          enabled?: boolean
          hours?: Json
          id?: string
          intro?: string | null
          notification_email?: string | null
          owner_user_id: string
          slot_minutes?: number
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          display_name?: string
          enabled?: boolean
          hours?: Json
          id?: string
          intro?: string | null
          notification_email?: string | null
          owner_user_id?: string
          slot_minutes?: number
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          client_id: string | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          duration_minutes: number
          id: string
          notes: string | null
          owner_user_id: string
          scheduled_at: string
          settings_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          owner_user_id: string
          scheduled_at: string
          settings_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          owner_user_id?: string
          scheduled_at?: string
          settings_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_settings_id_fkey"
            columns: ["settings_id"]
            isOneToOne: false
            referencedRelation: "booking_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_knowledge: {
        Row: {
          account_id: string
          answer: string | null
          answered_at: string | null
          client_id: string
          context_snippet: string | null
          created_at: string
          id: string
          origin: string
          question: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          answer?: string | null
          answered_at?: string | null
          client_id: string
          context_snippet?: string | null
          created_at?: string
          id?: string
          origin?: string
          question: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          answer?: string | null
          answered_at?: string | null
          client_id?: string
          context_snippet?: string | null
          created_at?: string
          id?: string
          origin?: string
          question?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_knowledge_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_knowledge_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_knowledge_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
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
      client_leads: {
        Row: {
          client_id: string
          contact: string | null
          conversation_id: string | null
          created_at: string
          email: string | null
          id: string
          message: string | null
          metadata: Json
          name: string
          source: string
        }
        Insert: {
          client_id: string
          contact?: string | null
          conversation_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          name: string
          source: string
        }
        Update: {
          client_id?: string
          contact?: string | null
          conversation_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          name?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          business_description: string | null
          created_at: string
          id: string
          instagram_handle: string | null
          name: string
          notes: string | null
          org_id: string
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
          org_id: string
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
          org_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_outcomes: {
        Row: {
          client_id: string
          conversation_id: string
          created_at: string
          id: string
          marked_at: string
          marked_by: string | null
          status: string
          updated_at: string
          value_clp: number | null
        }
        Insert: {
          client_id: string
          conversation_id: string
          created_at?: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          status?: string
          updated_at?: string
          value_clp?: number | null
        }
        Update: {
          client_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          status?: string
          updated_at?: string
          value_clp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_outcomes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_outcomes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_comments: {
        Row: {
          author: string
          author_name: string | null
          author_role: string
          author_user_id: string | null
          body: string
          client_id: string
          created_at: string
          deliverable_id: string
          id: string
          kind: string
          read_by_agency: boolean
        }
        Insert: {
          author?: string
          author_name?: string | null
          author_role?: string
          author_user_id?: string | null
          body?: string
          client_id: string
          created_at?: string
          deliverable_id: string
          id?: string
          kind?: string
          read_by_agency?: boolean
        }
        Update: {
          author?: string
          author_name?: string | null
          author_role?: string
          author_user_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          deliverable_id?: string
          id?: string
          kind?: string
          read_by_agency?: boolean
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
      deliverable_review_links: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          deliverable_id: string
          expires_at: string
          id: string
          revoked: boolean
          token: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          deliverable_id: string
          expires_at: string
          id?: string
          revoked?: boolean
          token: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          deliverable_id?: string
          expires_at?: string
          id?: string
          revoked?: boolean
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_review_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_review_links_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          attachments: Json
          checklist: Json
          checklist_enabled: boolean
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
          checklist_enabled?: boolean
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
          checklist_enabled?: boolean
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
      ig_automation_events: {
        Row: {
          client_id: string
          comment_id: string
          comment_text: string | null
          commenter_id: string | null
          commenter_username: string | null
          conversation_id: string | null
          created_at: string
          dm_error: string | null
          dm_status: string
          id: string
          ig_media_id: string | null
          matched: boolean
          reply_error: string | null
          reply_status: string
          trigger_id: string | null
        }
        Insert: {
          client_id: string
          comment_id: string
          comment_text?: string | null
          commenter_id?: string | null
          commenter_username?: string | null
          conversation_id?: string | null
          created_at?: string
          dm_error?: string | null
          dm_status?: string
          id?: string
          ig_media_id?: string | null
          matched?: boolean
          reply_error?: string | null
          reply_status?: string
          trigger_id?: string | null
        }
        Update: {
          client_id?: string
          comment_id?: string
          comment_text?: string | null
          commenter_id?: string | null
          commenter_username?: string | null
          conversation_id?: string | null
          created_at?: string
          dm_error?: string | null
          dm_status?: string
          id?: string
          ig_media_id?: string | null
          matched?: boolean
          reply_error?: string | null
          reply_status?: string
          trigger_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ig_automation_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_automation_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_automation_events_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "ig_comment_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_comment_triggers: {
        Row: {
          client_id: string
          created_at: string
          dm_message: string
          failed_count: number
          id: string
          ig_media_id: string | null
          is_active: boolean
          keywords: string[]
          last_triggered_at: string | null
          match_type: string
          name: string
          priority: number
          public_reply: string | null
          sent_count: number
          triggered_count: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          dm_message: string
          failed_count?: number
          id?: string
          ig_media_id?: string | null
          is_active?: boolean
          keywords?: string[]
          last_triggered_at?: string | null
          match_type?: string
          name?: string
          priority?: number
          public_reply?: string | null
          sent_count?: number
          triggered_count?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          dm_message?: string
          failed_count?: number
          id?: string
          ig_media_id?: string | null
          is_active?: boolean
          keywords?: string[]
          last_triggered_at?: string | null
          match_type?: string
          name?: string
          priority?: number
          public_reply?: string | null
          sent_count?: number
          triggered_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ig_comment_triggers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_dm_triggers: {
        Row: {
          client_id: string
          created_at: string
          failed_count: number
          id: string
          is_active: boolean
          keywords: string[]
          kind: string
          last_triggered_at: string | null
          match_type: string
          message: string
          name: string
          priority: number
          sent_count: number
          triggered_count: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          failed_count?: number
          id?: string
          is_active?: boolean
          keywords?: string[]
          kind?: string
          last_triggered_at?: string | null
          match_type?: string
          message: string
          name?: string
          priority?: number
          sent_count?: number
          triggered_count?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          failed_count?: number
          id?: string
          is_active?: boolean
          keywords?: string[]
          kind?: string
          last_triggered_at?: string | null
          match_type?: string
          message?: string
          name?: string
          priority?: number
          sent_count?: number
          triggered_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ig_dm_triggers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_audience_snapshots: {
        Row: {
          breakdown: string
          breakdown_total: number | null
          client_id: string
          coverage: number | null
          created_at: string
          date: string
          followers_total: number | null
          id: string
          key: string
          updated_at: string
          value: number
        }
        Insert: {
          breakdown: string
          breakdown_total?: number | null
          client_id: string
          coverage?: number | null
          created_at?: string
          date: string
          followers_total?: number | null
          id?: string
          key: string
          updated_at?: string
          value?: number
        }
        Update: {
          breakdown?: string
          breakdown_total?: number | null
          client_id?: string
          coverage?: number | null
          created_at?: string
          date?: string
          followers_total?: number | null
          id?: string
          key?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "instagram_audience_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_grid_versions: {
        Row: {
          captured_at: string
          client_id: string
          created_at: string
          followers: number | null
          following: number | null
          id: string
          is_baseline: boolean
          label: string
          notes: string | null
          source: string
          updated_at: string
        }
        Insert: {
          captured_at?: string
          client_id: string
          created_at?: string
          followers?: number | null
          following?: number | null
          id?: string
          is_baseline?: boolean
          label: string
          notes?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          captured_at?: string
          client_id?: string
          created_at?: string
          followers?: number | null
          following?: number | null
          id?: string
          is_baseline?: boolean
          label?: string
          notes?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_grid_versions_client_id_fkey"
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
          archived_at: string | null
          caption: string | null
          carousel_urls: string[]
          client_id: string
          close_friends_only: boolean
          cover_url: string | null
          created_at: string
          format: Database["public"]["Enums"]["post_format"]
          id: string
          ig_media_id: string | null
          image_url: string | null
          is_trial_reel: boolean
          likes_count: number
          location: string | null
          music: string | null
          objective: string | null
          position: number
          published_at: string | null
          scheduled_at: string | null
          type: Database["public"]["Enums"]["ig_post_type"]
          updated_at: string
          version_id: string | null
        }
        Insert: {
          archived_at?: string | null
          caption?: string | null
          carousel_urls?: string[]
          client_id: string
          close_friends_only?: boolean
          cover_url?: string | null
          created_at?: string
          format?: Database["public"]["Enums"]["post_format"]
          id?: string
          ig_media_id?: string | null
          image_url?: string | null
          is_trial_reel?: boolean
          likes_count?: number
          location?: string | null
          music?: string | null
          objective?: string | null
          position?: number
          published_at?: string | null
          scheduled_at?: string | null
          type: Database["public"]["Enums"]["ig_post_type"]
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          archived_at?: string | null
          caption?: string | null
          carousel_urls?: string[]
          client_id?: string
          close_friends_only?: boolean
          cover_url?: string | null
          created_at?: string
          format?: Database["public"]["Enums"]["post_format"]
          id?: string
          ig_media_id?: string | null
          image_url?: string | null
          is_trial_reel?: boolean
          likes_count?: number
          location?: string | null
          music?: string | null
          objective?: string | null
          position?: number
          published_at?: string | null
          scheduled_at?: string | null
          type?: Database["public"]["Enums"]["ig_post_type"]
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_posts_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "instagram_grid_versions"
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
          current_synced_at: string | null
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
          current_synced_at?: string | null
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
          current_synced_at?: string | null
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
      job_runs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          job_name: string
          request_id: number | null
          response_body: Json | null
          rows_written: number | null
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          job_name: string
          request_id?: number | null
          response_body?: Json | null
          rows_written?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          job_name?: string
          request_id?: number | null
          response_body?: Json | null
          rows_written?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      landing_contact_submissions: {
        Row: {
          client_id: string
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          landing_id: string
          message: string
          name: string
          phone: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          landing_id: string
          message: string
          name: string
          phone?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          landing_id?: string
          message?: string
          name?: string
          phone?: string | null
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
          client_id: string | null
          created_at: string
          event_name: string
          id: string
          item_id: string | null
          lang: string | null
          path: string | null
          referrer: string | null
          source_id: string | null
          source_type: string
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          event_name: string
          id?: string
          item_id?: string | null
          lang?: string | null
          path?: string | null
          referrer?: string | null
          source_id?: string | null
          source_type: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          event_name?: string
          id?: string
          item_id?: string | null
          lang?: string | null
          path?: string | null
          referrer?: string | null
          source_id?: string | null
          source_type?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          client_id: string
          contact_enabled: boolean
          created_at: string
          cta_text: string | null
          cta_url: string | null
          dark_mode: boolean
          faq: Json
          faq_enabled: boolean
          footer: Json
          gallery: Json
          hero_aspect: string
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string
          id: string
          location: Json
          location_enabled: boolean
          published: boolean
          section_order: string[] | null
          seo_description: string | null
          seo_title: string | null
          services: Json
          slug: string
          template: string
          testimonials: Json
          testimonials_enabled: boolean
          theme_color: string
          updated_at: string
          view_count: number
          whatsapp_cta_text: string | null
          whatsapp_enabled: boolean
          whatsapp_message: string | null
          whatsapp_number: string | null
        }
        Insert: {
          client_id: string
          contact_enabled?: boolean
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          dark_mode?: boolean
          faq?: Json
          faq_enabled?: boolean
          footer?: Json
          gallery?: Json
          hero_aspect?: string
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string
          id?: string
          location?: Json
          location_enabled?: boolean
          published?: boolean
          section_order?: string[] | null
          seo_description?: string | null
          seo_title?: string | null
          services?: Json
          slug: string
          template?: string
          testimonials?: Json
          testimonials_enabled?: boolean
          theme_color?: string
          updated_at?: string
          view_count?: number
          whatsapp_cta_text?: string | null
          whatsapp_enabled?: boolean
          whatsapp_message?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          client_id?: string
          contact_enabled?: boolean
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          dark_mode?: boolean
          faq?: Json
          faq_enabled?: boolean
          footer?: Json
          gallery?: Json
          hero_aspect?: string
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string
          id?: string
          location?: Json
          location_enabled?: boolean
          published?: boolean
          section_order?: string[] | null
          seo_description?: string | null
          seo_title?: string | null
          services?: Json
          slug?: string
          template?: string
          testimonials?: Json
          testimonials_enabled?: boolean
          theme_color?: string
          updated_at?: string
          view_count?: number
          whatsapp_cta_text?: string | null
          whatsapp_enabled?: boolean
          whatsapp_message?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      lead_meta: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          source: string
          source_id: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          source: string
          source_id: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          source?: string
          source_id?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_meta_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_accounts: {
        Row: {
          ad_account_id: string | null
          auth_type: string
          business_name: string | null
          client_id: string
          connected: boolean
          created_at: string
          currency: string | null
          id: string
          ig_account_id: string | null
          last_ig_sync_at: string | null
          last_ingest_at: string | null
          last_ingest_reason: string | null
          last_ingest_rows: number | null
          last_sync_error: string | null
          last_synced_at: string | null
          last_validated_at: string | null
          page_id: string | null
          scopes: string[]
          timezone_name: string | null
          token_expires_at: string | null
          token_secret_id: string | null
          token_valid: boolean | null
          updated_at: string
        }
        Insert: {
          ad_account_id?: string | null
          auth_type?: string
          business_name?: string | null
          client_id: string
          connected?: boolean
          created_at?: string
          currency?: string | null
          id?: string
          ig_account_id?: string | null
          last_ig_sync_at?: string | null
          last_ingest_at?: string | null
          last_ingest_reason?: string | null
          last_ingest_rows?: number | null
          last_sync_error?: string | null
          last_synced_at?: string | null
          last_validated_at?: string | null
          page_id?: string | null
          scopes?: string[]
          timezone_name?: string | null
          token_expires_at?: string | null
          token_secret_id?: string | null
          token_valid?: boolean | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string | null
          auth_type?: string
          business_name?: string | null
          client_id?: string
          connected?: boolean
          created_at?: string
          currency?: string | null
          id?: string
          ig_account_id?: string | null
          last_ig_sync_at?: string | null
          last_ingest_at?: string | null
          last_ingest_reason?: string | null
          last_ingest_rows?: number | null
          last_sync_error?: string | null
          last_synced_at?: string | null
          last_validated_at?: string | null
          page_id?: string | null
          scopes?: string[]
          timezone_name?: string | null
          token_expires_at?: string | null
          token_secret_id?: string | null
          token_valid?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
          meta_account_id: string | null
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
          meta_account_id?: string | null
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
          meta_account_id?: string | null
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
          {
            foreignKeyName: "meta_ads_ads_meta_account_id_fkey"
            columns: ["meta_account_id"]
            isOneToOne: false
            referencedRelation: "meta_accounts"
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
          meta_account_id: string | null
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
          meta_account_id?: string | null
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
          meta_account_id?: string | null
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
          {
            foreignKeyName: "meta_ads_adsets_meta_account_id_fkey"
            columns: ["meta_account_id"]
            isOneToOne: false
            referencedRelation: "meta_accounts"
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
          meta_account_id: string | null
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
          meta_account_id?: string | null
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
          meta_account_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "meta_ads_campaigns_meta_account_id_fkey"
            columns: ["meta_account_id"]
            isOneToOne: false
            referencedRelation: "meta_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      multilink_items: {
        Row: {
          click_count: number
          client_id: string
          created_at: string
          end_at: string | null
          featured: boolean
          icon: string | null
          id: string
          is_active: boolean
          kind: string
          multilink_id: string
          sort_order: number
          start_at: string | null
          subtitle: string | null
          thumbnail_url: string | null
          title: string
          url: string
          video_url: string | null
          wa_message: string | null
          wa_number: string | null
        }
        Insert: {
          click_count?: number
          client_id: string
          created_at?: string
          end_at?: string | null
          featured?: boolean
          icon?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          multilink_id: string
          sort_order?: number
          start_at?: string | null
          subtitle?: string | null
          thumbnail_url?: string | null
          title?: string
          url?: string
          video_url?: string | null
          wa_message?: string | null
          wa_number?: string | null
        }
        Update: {
          click_count?: number
          client_id?: string
          created_at?: string
          end_at?: string | null
          featured?: boolean
          icon?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          multilink_id?: string
          sort_order?: number
          start_at?: string | null
          subtitle?: string | null
          thumbnail_url?: string | null
          title?: string
          url?: string
          video_url?: string | null
          wa_message?: string | null
          wa_number?: string | null
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
          background: Json
          bio: string | null
          button_shape: string
          button_style: string
          client_id: string
          created_at: string
          custom_domain: string | null
          custom_domain_verified: boolean
          font_family: string
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
          background?: Json
          bio?: string | null
          button_shape?: string
          button_style?: string
          client_id: string
          created_at?: string
          custom_domain?: string | null
          custom_domain_verified?: boolean
          font_family?: string
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
          background?: Json
          bio?: string | null
          button_shape?: string
          button_style?: string
          client_id?: string
          created_at?: string
          custom_domain?: string | null
          custom_domain_verified?: boolean
          font_family?: string
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
      objective_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          items: Json
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objective_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
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
          metric_source: string
          metric_synced_at: string | null
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
          metric_source?: string
          metric_synced_at?: string | null
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
          metric_source?: string
          metric_synced_at?: string | null
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
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string
          id: string
          meta_token_expires_at: string | null
          meta_token_scopes: string[]
          meta_token_secret_id: string | null
          meta_token_updated_at: string | null
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_token_expires_at?: string | null
          meta_token_scopes?: string[]
          meta_token_secret_id?: string | null
          meta_token_updated_at?: string | null
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_token_expires_at?: string | null
          meta_token_scopes?: string[]
          meta_token_secret_id?: string | null
          meta_token_updated_at?: string | null
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
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
      post_insights_daily: {
        Row: {
          client_id: string
          created_at: string
          date: string
          engagement: number
          id: string
          media_type: string | null
          permalink: string | null
          platform: string
          post_id: string
          reach: number
          saves: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          date: string
          engagement?: number
          id?: string
          media_type?: string | null
          permalink?: string | null
          platform?: string
          post_id: string
          reach?: number
          saves?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          date?: string
          engagement?: number
          id?: string
          media_type?: string | null
          permalink?: string | null
          platform?: string
          post_id?: string
          reach?: number
          saves?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_insights_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_accounts: {
        Row: {
          access_token_secret_id: string | null
          ai_business_context: string | null
          ai_debounce_seconds: number
          ai_enabled: boolean
          ai_max_history: number
          ai_model: string
          ai_system_prompt: string
          business_hours: Json
          business_name: string | null
          catalog: Json
          client_id: string
          connected: boolean
          created_at: string
          display_phone_number: string | null
          id: string
          last_synced_at: string | null
          phone_number_id: string | null
          profile_photo_url: string | null
          social_links: Json
          timezone: string | null
          updated_at: string
          verify_token_secret_id: string | null
          waba_id: string | null
          website_url: string | null
        }
        Insert: {
          access_token_secret_id?: string | null
          ai_business_context?: string | null
          ai_debounce_seconds?: number
          ai_enabled?: boolean
          ai_max_history?: number
          ai_model?: string
          ai_system_prompt?: string
          business_hours?: Json
          business_name?: string | null
          catalog?: Json
          client_id: string
          connected?: boolean
          created_at?: string
          display_phone_number?: string | null
          id?: string
          last_synced_at?: string | null
          phone_number_id?: string | null
          profile_photo_url?: string | null
          social_links?: Json
          timezone?: string | null
          updated_at?: string
          verify_token_secret_id?: string | null
          waba_id?: string | null
          website_url?: string | null
        }
        Update: {
          access_token_secret_id?: string | null
          ai_business_context?: string | null
          ai_debounce_seconds?: number
          ai_enabled?: boolean
          ai_max_history?: number
          ai_model?: string
          ai_system_prompt?: string
          business_hours?: Json
          business_name?: string | null
          catalog?: Json
          client_id?: string
          connected?: boolean
          created_at?: string
          display_phone_number?: string | null
          id?: string
          last_synced_at?: string | null
          phone_number_id?: string | null
          profile_photo_url?: string | null
          social_links?: Json
          timezone?: string | null
          updated_at?: string
          verify_token_secret_id?: string | null
          waba_id?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      whatsapp_bot_rules: {
        Row: {
          actions: Json
          client_id: string
          created_at: string
          flow_steps: Json
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
          flow_steps?: Json
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
          flow_steps?: Json
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
          account_id: string | null
          ai_paused: boolean
          channel: string
          client_id: string
          contact_name: string | null
          contact_username: string | null
          contact_wa_id: string
          created_at: string
          human_followup_at: string | null
          human_followup_reason: string | null
          id: string
          ig_account_id: string | null
          is_lead: boolean
          last_bot_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          lead_source_detail: string | null
          lead_source_id: string | null
          lead_source_type: string | null
          needs_human_followup: boolean
          pending_response_at: string | null
          status: string
          tags: string[]
          unread_count: number
          updated_at: string
          welcome_sent_at: string | null
        }
        Insert: {
          account_id?: string | null
          ai_paused?: boolean
          channel?: string
          client_id: string
          contact_name?: string | null
          contact_username?: string | null
          contact_wa_id: string
          created_at?: string
          human_followup_at?: string | null
          human_followup_reason?: string | null
          id?: string
          ig_account_id?: string | null
          is_lead?: boolean
          last_bot_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_source_detail?: string | null
          lead_source_id?: string | null
          lead_source_type?: string | null
          needs_human_followup?: boolean
          pending_response_at?: string | null
          status?: string
          tags?: string[]
          unread_count?: number
          updated_at?: string
          welcome_sent_at?: string | null
        }
        Update: {
          account_id?: string | null
          ai_paused?: boolean
          channel?: string
          client_id?: string
          contact_name?: string | null
          contact_username?: string | null
          contact_wa_id?: string
          created_at?: string
          human_followup_at?: string | null
          human_followup_reason?: string | null
          id?: string
          ig_account_id?: string | null
          is_lead?: boolean
          last_bot_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_source_detail?: string | null
          lead_source_id?: string | null
          lead_source_type?: string | null
          needs_human_followup?: boolean
          pending_response_at?: string | null
          status?: string
          tags?: string[]
          unread_count?: number
          updated_at?: string
          welcome_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_flow_runs: {
        Row: {
          awaiting_input: boolean
          client_id: string
          conversation_id: string
          created_at: string
          current_step_id: string | null
          finished_at: string | null
          id: string
          last_error: string | null
          next_run_at: string | null
          retry_count: number
          rule_id: string | null
          started_at: string
          status: string
          updated_at: string
          variables: Json
        }
        Insert: {
          awaiting_input?: boolean
          client_id: string
          conversation_id: string
          created_at?: string
          current_step_id?: string | null
          finished_at?: string | null
          id?: string
          last_error?: string | null
          next_run_at?: string | null
          retry_count?: number
          rule_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          awaiting_input?: boolean
          client_id?: string
          conversation_id?: string
          created_at?: string
          current_step_id?: string | null
          finished_at?: string | null
          id?: string
          last_error?: string | null
          next_run_at?: string | null
          retry_count?: number
          rule_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_flow_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_flow_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_flow_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          channel: string
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
          channel?: string
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
          channel?: string
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
      whatsapp_accounts_safe: {
        Row: {
          ai_business_context: string | null
          ai_debounce_seconds: number | null
          ai_enabled: boolean | null
          ai_max_history: number | null
          ai_model: string | null
          ai_system_prompt: string | null
          business_hours: Json | null
          business_name: string | null
          catalog: Json | null
          client_id: string | null
          connected: boolean | null
          created_at: string | null
          display_phone_number: string | null
          has_access_token: boolean | null
          has_verify_token: boolean | null
          id: string | null
          last_synced_at: string | null
          phone_number_id: string | null
          profile_photo_url: string | null
          social_links: Json | null
          timezone: string | null
          updated_at: string | null
          waba_id: string | null
          website_url: string | null
        }
        Insert: {
          ai_business_context?: string | null
          ai_debounce_seconds?: number | null
          ai_enabled?: boolean | null
          ai_max_history?: number | null
          ai_model?: string | null
          ai_system_prompt?: string | null
          business_hours?: Json | null
          business_name?: string | null
          catalog?: Json | null
          client_id?: string | null
          connected?: boolean | null
          created_at?: string | null
          display_phone_number?: string | null
          has_access_token?: never
          has_verify_token?: never
          id?: string | null
          last_synced_at?: string | null
          phone_number_id?: string | null
          profile_photo_url?: string | null
          social_links?: Json | null
          timezone?: string | null
          updated_at?: string | null
          waba_id?: string | null
          website_url?: string | null
        }
        Update: {
          ai_business_context?: string | null
          ai_debounce_seconds?: number | null
          ai_enabled?: boolean | null
          ai_max_history?: number | null
          ai_model?: string | null
          ai_system_prompt?: string | null
          business_hours?: Json | null
          business_name?: string | null
          catalog?: Json | null
          client_id?: string | null
          connected?: boolean | null
          created_at?: string | null
          display_phone_number?: string | null
          has_access_token?: never
          has_verify_token?: never
          id?: string | null
          last_synced_at?: string | null
          phone_number_id?: string | null
          profile_photo_url?: string | null
          social_links?: Json | null
          timezone?: string | null
          updated_at?: string | null
          waba_id?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      client_analytics: {
        Args: { _client_id: string; _from: string; _to: string }
        Returns: Json
      }
      client_analytics_guard: { Args: { _client_id: string }; Returns: boolean }
      content_performance: {
        Args: { _client_id: string; _from: string; _to: string }
        Returns: Json
      }
      ensure_org: { Args: never; Returns: string }
      get_booking_settings_by_slug: {
        Args: { _slug: string }
        Returns: {
          client_id: string
          display_name: string
          enabled: boolean
          hours: Json
          id: string
          intro: string
          owner_user_id: string
          slot_minutes: number
          timezone: string
        }[]
      }
      ig_dm_trigger_bump: {
        Args: {
          _failed: number
          _sent: number
          _trigger_id: string
          _triggered: number
        }
        Returns: undefined
      }
      ig_swap_sync_version: {
        Args: { _label: string; _new_id: string; _old_id: string }
        Returns: string
      }
      ig_trigger_bump: {
        Args: {
          _failed: number
          _sent: number
          _trigger_id: string
          _triggered: number
        }
        Returns: undefined
      }
      increment_landing_view: { Args: { _id: string }; Returns: undefined }
      increment_multilink_click: { Args: { _id: string }; Returns: undefined }
      increment_multilink_view: { Args: { _id: string }; Returns: undefined }
      is_org_manager: { Args: { _org_id: string }; Returns: boolean }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      job_health: {
        Args: never
        Returns: {
          active: boolean
          failed_24h: number
          job_name: string
          last_run: string
          last_success: string
          schedule: string
          total_24h: number
        }[]
      }
      job_rows_written: { Args: { _body: Json }; Returns: number }
      list_taken_slots: {
        Args: { _from: string; _settings_id: string; _to: string }
        Returns: {
          duration_minutes: number
          scheduled_at: string
        }[]
      }
      log_landing_event: {
        Args: {
          _event_name: string
          _item_id?: string
          _lang?: string
          _path?: string
          _referrer?: string
          _source_id?: string
          _source_type?: string
          _user_agent?: string
          _utm_campaign?: string
          _utm_medium?: string
          _utm_source?: string
        }
        Returns: undefined
      }
      manages_client: { Args: { _client_id: string }; Returns: boolean }
      meta_get_secret: { Args: { _account_id: string }; Returns: string }
      meta_set_secret: {
        Args: { _account_id: string; _secret: string }
        Returns: string
      }
      org_meta_get_secret: { Args: { _org_id: string }; Returns: string }
      org_meta_set_secret: {
        Args: {
          _expires_at?: string
          _org_id: string
          _scopes?: string[]
          _secret: string
        }
        Returns: string
      }
      org_meta_token_status: { Args: never; Returns: Json }
      owns_client: { Args: { _client_id: string }; Returns: boolean }
      reconcile_job_runs: { Args: never; Returns: undefined }
      review_link_comment: {
        Args: { _body: string; _kind: string; _name?: string; _token: string }
        Returns: Json
      }
      review_link_get: { Args: { _token: string }; Returns: Json }
      run_http_cron_job: {
        Args: { _job_name: string; _url: string }
        Returns: undefined
      }
      run_whatsapp_ai_dispatch: {
        Args: { _job_name: string; _url: string }
        Returns: undefined
      }
      safe_jsonb: { Args: { _text: string }; Returns: Json }
      set_job_schedule: {
        Args: { _job_name: string; _schedule: string }
        Returns: boolean
      }
      submit_landing_contact: {
        Args: {
          _email: string
          _honeypot?: string
          _ip_hash: string
          _landing_id: string
          _message: string
          _name: string
          _phone: string
        }
        Returns: Json
      }
      user_client_id: { Args: never; Returns: string }
      user_orgs: {
        Args: never
        Returns: {
          org_id: string
          role: string
        }[]
      }
      wa_get_secret: {
        Args: { _account_id: string; _kind: string }
        Returns: string
      }
      wa_set_secret: {
        Args: { _account_id: string; _kind: string; _secret: string }
        Returns: string
      }
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
