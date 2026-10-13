// Generated from the live Supabase schema (project gxkttmxrdrerjhxhsisc). Do not edit by hand:
// run `npm run db:types` after a migration is applied, and commit the result.

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
      academies: {
        Row: {
          created_at: string
          features: Json
          id: string
          join_code: string | null
          location: string | null
          logo_url: string | null
          name: string
          province: string | null
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          join_code?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          province?: string | null
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          join_code?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          province?: string | null
        }
        Relationships: []
      }
      academy_terms: {
        Row: {
          academy_id: string
          created_at: string
          ends_on: string
          id: string
          name: string
          starts_on: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          ends_on: string
          id?: string
          name: string
          starts_on: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          name?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_terms_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_artefacts: {
        Row: {
          academy_id: string
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          created_at: string
          created_by: string
          data: Json
          feedback: string | null
          feedback_at: string | null
          feedback_by: string | null
          id: string
          inputs_fingerprint: string
          kind: string
          model_id: string
          output_tokens: number | null
          prompt_tokens: number | null
          prose: string | null
          status: string
          subject_id: string
          subject_type: string
          superseded_at: string | null
          thinking_tokens: number | null
          total_tokens: number | null
        }
        Insert: {
          academy_id: string
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          created_by: string
          data: Json
          feedback?: string | null
          feedback_at?: string | null
          feedback_by?: string | null
          id?: string
          inputs_fingerprint: string
          kind: string
          model_id: string
          output_tokens?: number | null
          prompt_tokens?: number | null
          prose?: string | null
          status?: string
          subject_id: string
          subject_type: string
          superseded_at?: string | null
          thinking_tokens?: number | null
          total_tokens?: number | null
        }
        Update: {
          academy_id?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          created_by?: string
          data?: Json
          feedback?: string | null
          feedback_at?: string | null
          feedback_by?: string | null
          id?: string
          inputs_fingerprint?: string
          kind?: string
          model_id?: string
          output_tokens?: number | null
          prompt_tokens?: number | null
          prose?: string | null
          status?: string
          subject_id?: string
          subject_type?: string
          superseded_at?: string | null
          thinking_tokens?: number | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_artefacts_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_artefacts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_artefacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_artefacts_feedback_by_fkey"
            columns: ["feedback_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          dismissed_at: string | null
          id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string | null
          id?: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string | null
          id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          coach_id: string
          created_at: string
          id: string
          team_id: string
          title: string
        }
        Insert: {
          body: string
          coach_id: string
          created_at?: string
          id?: string
          team_id: string
          title: string
        }
        Update: {
          body?: string
          coach_id?: string
          created_at?: string
          id?: string
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_notes: {
        Row: {
          academy_id: string
          author_id: string
          body: string
          created_at: string
          id: string
          source: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          academy_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
          source?: string
          subject_id: string
          subject_type: string
        }
        Update: {
          academy_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          source?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_notes_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_items: {
        Row: {
          academy_id: string
          active: boolean
          age_group: string
          category: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          active?: boolean
          age_group: string
          category: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          active?: boolean
          age_group?: string
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_items_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_links: {
        Row: {
          created_at: string
          item_id: string
          link_id: string
          link_type: string
        }
        Insert: {
          created_at?: string
          item_id: string
          link_id: string
          link_type: string
        }
        Update: {
          created_at?: string
          item_id?: string
          link_id?: string
          link_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_links_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "curriculum_items"
            referencedColumns: ["id"]
          },
        ]
      }
      development_milestone_templates: {
        Row: {
          academy_id: string | null
          age_group: string | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          position: string | null
          sort_order: number | null
          title: string
        }
        Insert: {
          academy_id?: string | null
          age_group?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          position?: string | null
          sort_order?: number | null
          title: string
        }
        Update: {
          academy_id?: string | null
          age_group?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          position?: string | null
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_milestone_templates_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      development_objective_links: {
        Row: {
          created_at: string
          link_id: string
          link_type: string
          objective_id: string
        }
        Insert: {
          created_at?: string
          link_id: string
          link_type: string
          objective_id: string
        }
        Update: {
          created_at?: string
          link_id?: string
          link_type?: string
          objective_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_objective_links_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "development_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      development_objectives: {
        Row: {
          academy_id: string
          closed_at: string | null
          created_at: string
          created_by: string
          detail: Json | null
          follow_up_fixture_id: string | null
          id: string
          objective: string
          phase: string | null
          problem: string
          problem_key: string | null
          source_fixture_id: string | null
          source_type: string
          status: string
          subject_id: string
          subject_type: string
          verdict: string | null
        }
        Insert: {
          academy_id: string
          closed_at?: string | null
          created_at?: string
          created_by: string
          detail?: Json | null
          follow_up_fixture_id?: string | null
          id?: string
          objective: string
          phase?: string | null
          problem: string
          problem_key?: string | null
          source_fixture_id?: string | null
          source_type?: string
          status?: string
          subject_id: string
          subject_type?: string
          verdict?: string | null
        }
        Update: {
          academy_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string
          detail?: Json | null
          follow_up_fixture_id?: string | null
          id?: string
          objective?: string
          phase?: string | null
          problem?: string
          problem_key?: string | null
          source_fixture_id?: string | null
          source_type?: string
          status?: string
          subject_id?: string
          subject_type?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_objectives_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_objectives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_objectives_follow_up_fixture_id_fkey"
            columns: ["follow_up_fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_objectives_source_fixture_id_fkey"
            columns: ["source_fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_library: {
        Row: {
          academy_id: string | null
          age_groups: string[]
          category: string
          coaching_points: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty: string | null
          duration_minutes: number | null
          equipment: string | null
          four_corner: string | null
          id: string
          is_academy_method: boolean
          name: string
          players_needed: number | null
          source_drill_id: string | null
          tactic_play_id: string | null
          themes: string[]
          video_url: string | null
        }
        Insert: {
          academy_id?: string | null
          age_groups?: string[]
          category: string
          coaching_points?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          equipment?: string | null
          four_corner?: string | null
          id?: string
          is_academy_method?: boolean
          name: string
          players_needed?: number | null
          source_drill_id?: string | null
          tactic_play_id?: string | null
          themes?: string[]
          video_url?: string | null
        }
        Update: {
          academy_id?: string | null
          age_groups?: string[]
          category?: string
          coaching_points?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          equipment?: string | null
          four_corner?: string | null
          id?: string
          is_academy_method?: boolean
          name?: string
          players_needed?: number | null
          source_drill_id?: string | null
          tactic_play_id?: string | null
          themes?: string[]
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drill_library_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_library_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_library_source_drill_id_fkey"
            columns: ["source_drill_id"]
            isOneToOne: false
            referencedRelation: "training_drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_library_tactic_play_id_fkey"
            columns: ["tactic_play_id"]
            isOneToOne: false
            referencedRelation: "tactic_plays"
            referencedColumns: ["id"]
          },
        ]
      }
      family_messages: {
        Row: {
          academy_id: string
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          body: string
          created_at: string
          created_by: string
          id: string
          kind: string
          player_id: string
          ref_key: string
          status: string
        }
        Insert: {
          academy_id: string
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          body: string
          created_at?: string
          created_by: string
          id?: string
          kind: string
          player_id: string
          ref_key: string
          status?: string
        }
        Update: {
          academy_id?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          player_id?: string
          ref_key?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_messages_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_messages_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_messages_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_match_plans: {
        Row: {
          academy_id: string
          coach_id: string
          created_at: string
          data: Json
          fixture_id: string
          id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          coach_id: string
          created_at?: string
          data: Json
          fixture_id: string
          id?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          coach_id?: string
          created_at?: string
          data?: Json
          fixture_id?: string
          id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_match_plans_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_match_plans_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_match_plans_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_match_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures: {
        Row: {
          cancellation_reason: string | null
          created_at: string
          created_by: string | null
          fixture_date: string
          id: string
          is_home: boolean
          notes: string | null
          opponent: string
          status: string
          team_id: string
          venue: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          created_at?: string
          created_by?: string | null
          fixture_date: string
          id?: string
          is_home?: boolean
          notes?: string | null
          opponent: string
          status?: string
          team_id: string
          venue?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          created_at?: string
          created_by?: string | null
          fixture_date?: string
          id?: string
          is_home?: boolean
          notes?: string | null
          opponent?: string
          status?: string
          team_id?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_assignments: {
        Row: {
          academy_id: string
          created_at: string
          created_by: string
          due_date: string
          id: string
          play_id: string | null
          questions: Json
          team_id: string
          title: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          created_by: string
          due_date: string
          id?: string
          play_id?: string | null
          questions: Json
          team_id: string
          title: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          created_by?: string
          due_date?: string
          id?: string
          play_id?: string | null
          questions?: Json
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_assignments_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_play_id_fkey"
            columns: ["play_id"]
            isOneToOne: false
            referencedRelation: "tactic_plays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_responses: {
        Row: {
          answers: Json
          assignment_id: string
          completed_at: string
          id: string
          player_id: string
          score: number
          total: number
        }
        Insert: {
          answers: Json
          assignment_id: string
          completed_at?: string
          id?: string
          player_id: string
          score?: number
          total?: number
        }
        Update: {
          answers?: Json
          assignment_id?: string
          completed_at?: string
          id?: string
          player_id?: string
          score?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "homework_responses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_responses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_appearances: {
        Row: {
          fixture_id: string
          id: string
          minutes_played: number | null
          played: boolean
          player_id: string
        }
        Insert: {
          fixture_id: string
          id?: string
          minutes_played?: number | null
          played?: boolean
          player_id: string
        }
        Update: {
          fixture_id?: string
          id?: string
          minutes_played?: number | null
          played?: boolean
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_appearances_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_attendance: {
        Row: {
          fixture_id: string
          id: string
          marked_at: string | null
          marked_by: string | null
          note: string | null
          player_id: string
          status: string
        }
        Insert: {
          fixture_id: string
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          note?: string | null
          player_id: string
          status: string
        }
        Update: {
          fixture_id?: string
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          note?: string | null
          player_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_attendance_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          fixture_id: string
          id: string
          logged_at: string
          logged_by: string | null
          match_notes: string | null
          opponent_score: number
          phase_ratings: Json | null
          team_score: number
        }
        Insert: {
          fixture_id: string
          id?: string
          logged_at?: string
          logged_by?: string | null
          match_notes?: string | null
          opponent_score?: number
          phase_ratings?: Json | null
          team_score?: number
        }
        Update: {
          fixture_id?: string
          id?: string
          logged_at?: string
          logged_by?: string | null
          match_notes?: string | null
          opponent_score?: number
          phase_ratings?: Json | null
          team_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_results_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_tags: {
        Row: {
          media_id: string
          player_id: string
        }
        Insert: {
          media_id: string
          player_id: string
        }
        Update: {
          media_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_tags_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_tags_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      media_uploads: {
        Row: {
          academy_id: string
          caption: string | null
          created_at: string
          fixture_id: string | null
          id: string
          media_type: string
          session_id: string | null
          team_id: string | null
          uploaded_by: string
          url: string
        }
        Insert: {
          academy_id: string
          caption?: string | null
          created_at?: string
          fixture_id?: string | null
          id?: string
          media_type: string
          session_id?: string | null
          team_id?: string | null
          uploaded_by: string
          url: string
        }
        Update: {
          academy_id?: string
          caption?: string | null
          created_at?: string
          fixture_id?: string | null
          id?: string
          media_type?: string
          session_id?: string | null
          team_id?: string | null
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_uploads_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_uploads_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_uploads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_uploads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_link_attempts: {
        Row: {
          actor_id: string
          attempts: number
          window_start: string
        }
        Insert: {
          actor_id: string
          attempts?: number
          window_start?: string
        }
        Update: {
          actor_id?: string
          attempts?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_link_attempts_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_link_codes: {
        Row: {
          code_hash: string
          code_last4: string
          expires_at: string
          id: string
          issued_at: string
          issued_by: string
          player_id: string
          redeemed_at: string | null
          redeemed_by: string | null
          relationship: string | null
          revoked_at: string | null
        }
        Insert: {
          code_hash: string
          code_last4: string
          expires_at?: string
          id?: string
          issued_at?: string
          issued_by: string
          player_id: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          relationship?: string | null
          revoked_at?: string | null
        }
        Update: {
          code_hash?: string
          code_last4?: string
          expires_at?: string
          id?: string
          issued_at?: string
          issued_by?: string
          player_id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          relationship?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_link_codes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_link_codes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_link_codes_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_player_links: {
        Row: {
          linked_at: string
          parent_id: string
          player_id: string
          relationship: string | null
          verification_method: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          linked_at?: string
          parent_id: string
          player_id: string
          relationship?: string | null
          verification_method?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          linked_at?: string
          parent_id?: string
          player_id?: string
          relationship?: string | null
          verification_method?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_player_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_player_links_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_player_links_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_attributes: {
        Row: {
          agility: number | null
          assessed_at: string
          ball_control: number | null
          coach_id: string
          communication: number | null
          composure: number | null
          crossing: number | null
          decision_making: number | null
          defending: number
          distribution: number | null
          dribbling: number
          finishing: number | null
          first_touch: number | null
          game_reading: number | null
          handling: number | null
          heading: number | null
          id: string
          jumping: number | null
          leadership: number | null
          marking: number | null
          notes: string | null
          off_ball_movement: number | null
          pace: number
          passing: number
          physical: number
          player_id: string
          positioning: number | null
          pressing: number | null
          reflexes: number | null
          shooting: number
          shot_stopping: number | null
          stamina: number | null
          strength: number | null
          tackling: number | null
          work_rate: number | null
        }
        Insert: {
          agility?: number | null
          assessed_at?: string
          ball_control?: number | null
          coach_id: string
          communication?: number | null
          composure?: number | null
          crossing?: number | null
          decision_making?: number | null
          defending?: number
          distribution?: number | null
          dribbling?: number
          finishing?: number | null
          first_touch?: number | null
          game_reading?: number | null
          handling?: number | null
          heading?: number | null
          id?: string
          jumping?: number | null
          leadership?: number | null
          marking?: number | null
          notes?: string | null
          off_ball_movement?: number | null
          pace?: number
          passing?: number
          physical?: number
          player_id: string
          positioning?: number | null
          pressing?: number | null
          reflexes?: number | null
          shooting?: number
          shot_stopping?: number | null
          stamina?: number | null
          strength?: number | null
          tackling?: number | null
          work_rate?: number | null
        }
        Update: {
          agility?: number | null
          assessed_at?: string
          ball_control?: number | null
          coach_id?: string
          communication?: number | null
          composure?: number | null
          crossing?: number | null
          decision_making?: number | null
          defending?: number
          distribution?: number | null
          dribbling?: number
          finishing?: number | null
          first_touch?: number | null
          game_reading?: number | null
          handling?: number | null
          heading?: number | null
          id?: string
          jumping?: number | null
          leadership?: number | null
          marking?: number | null
          notes?: string | null
          off_ball_movement?: number | null
          pace?: number
          passing?: number
          physical?: number
          player_id?: string
          positioning?: number | null
          pressing?: number | null
          reflexes?: number | null
          shooting?: number
          shot_stopping?: number | null
          stamina?: number | null
          strength?: number | null
          tackling?: number | null
          work_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_attributes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_attributes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_claim_attempts: {
        Row: {
          actor_id: string
          attempts: number
          window_start: string
        }
        Insert: {
          actor_id: string
          attempts?: number
          window_start?: string
        }
        Update: {
          actor_id?: string
          attempts?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_claim_attempts_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_clips: {
        Row: {
          added_by: string | null
          created_at: string | null
          description: string | null
          fixture_id: string | null
          id: string
          player_id: string
          timestamp_seconds: number | null
          title: string
          url: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          description?: string | null
          fixture_id?: string | null
          id?: string
          player_id: string
          timestamp_seconds?: number | null
          title: string
          url: string
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          description?: string | null
          fixture_id?: string | null
          id?: string
          player_id?: string
          timestamp_seconds?: number | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_clips_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_clips_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_clips_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_consents: {
        Row: {
          ai_analysis_consent: boolean
          id: string
          participation_consent: boolean | null
          photo_consent: boolean | null
          player_id: string
          risk_acknowledged: boolean | null
          season: string
          signed_at: string | null
          signed_by: string | null
          transport_consent: boolean | null
          updated_at: string | null
        }
        Insert: {
          ai_analysis_consent?: boolean
          id?: string
          participation_consent?: boolean | null
          photo_consent?: boolean | null
          player_id: string
          risk_acknowledged?: boolean | null
          season: string
          signed_at?: string | null
          signed_by?: string | null
          transport_consent?: boolean | null
          updated_at?: string | null
        }
        Update: {
          ai_analysis_consent?: boolean
          id?: string
          participation_consent?: boolean | null
          photo_consent?: boolean | null
          player_id?: string
          risk_acknowledged?: boolean | null
          season?: string
          signed_at?: string | null
          signed_by?: string | null
          transport_consent?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_consents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_documents: {
        Row: {
          created_at: string | null
          document_type: string
          file_name: string | null
          id: string
          player_id: string
          season: string
          signed_at: string | null
          signed_digitally: boolean | null
          signer_name: string | null
          signer_role: string | null
          status: string
          upload_url: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          file_name?: string | null
          id?: string
          player_id: string
          season: string
          signed_at?: string | null
          signed_digitally?: boolean | null
          signer_name?: string | null
          signer_role?: string | null
          status?: string
          upload_url?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          file_name?: string | null
          id?: string
          player_id?: string
          season?: string
          signed_at?: string | null
          signed_digitally?: boolean | null
          signer_name?: string | null
          signer_role?: string | null
          status?: string
          upload_url?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_documents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_medical: {
        Row: {
          allergies: string | null
          authorised_at: string | null
          authorised_by: string | null
          blood_type: string | null
          chronic_conditions: string | null
          condition_notes: string | null
          current_medication: string | null
          doctor_clinic: string | null
          emergency_1_name: string | null
          emergency_1_phone: string | null
          emergency_1_relationship: string | null
          emergency_2_name: string | null
          emergency_2_phone: string | null
          emergency_2_relationship: string | null
          has_medical_aid: boolean | null
          id: string
          medical_aid_number: string | null
          medical_aid_principal: string | null
          medical_aid_scheme: string | null
          nearest_hospital: string | null
          needs_renewal: boolean | null
          physical_restrictions: string | null
          player_id: string
          season: string | null
          treatment_authorised: boolean | null
          updated_at: string | null
        }
        Insert: {
          allergies?: string | null
          authorised_at?: string | null
          authorised_by?: string | null
          blood_type?: string | null
          chronic_conditions?: string | null
          condition_notes?: string | null
          current_medication?: string | null
          doctor_clinic?: string | null
          emergency_1_name?: string | null
          emergency_1_phone?: string | null
          emergency_1_relationship?: string | null
          emergency_2_name?: string | null
          emergency_2_phone?: string | null
          emergency_2_relationship?: string | null
          has_medical_aid?: boolean | null
          id?: string
          medical_aid_number?: string | null
          medical_aid_principal?: string | null
          medical_aid_scheme?: string | null
          nearest_hospital?: string | null
          needs_renewal?: boolean | null
          physical_restrictions?: string | null
          player_id: string
          season?: string | null
          treatment_authorised?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allergies?: string | null
          authorised_at?: string | null
          authorised_by?: string | null
          blood_type?: string | null
          chronic_conditions?: string | null
          condition_notes?: string | null
          current_medication?: string | null
          doctor_clinic?: string | null
          emergency_1_name?: string | null
          emergency_1_phone?: string | null
          emergency_1_relationship?: string | null
          emergency_2_name?: string | null
          emergency_2_phone?: string | null
          emergency_2_relationship?: string | null
          has_medical_aid?: boolean | null
          id?: string
          medical_aid_number?: string | null
          medical_aid_principal?: string | null
          medical_aid_scheme?: string | null
          nearest_hospital?: string | null
          needs_renewal?: boolean | null
          physical_restrictions?: string | null
          player_id?: string
          season?: string | null
          treatment_authorised?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_medical_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_milestone_completions: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          id: string
          note: string | null
          player_id: string
          season: string
          template_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          note?: string | null
          player_id: string
          season: string
          template_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          note?: string | null
          player_id?: string
          season?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_milestone_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_milestone_completions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_milestone_completions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "development_milestone_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      player_positions: {
        Row: {
          id: string
          kind: string
          player_id: string
          position: string
          rank: number
          role: string | null
          set_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          kind: string
          player_id: string
          position: string
          rank: number
          role?: string | null
          set_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          kind?: string
          player_id?: string
          position?: string
          rank?: number
          role?: string | null
          set_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_positions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_positions_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_ratings: {
        Row: {
          coach_id: string
          created_at: string
          fixture_id: string | null
          id: string
          note: string | null
          player_id: string
          rating: number
        }
        Insert: {
          coach_id: string
          created_at?: string
          fixture_id?: string | null
          id?: string
          note?: string | null
          player_id: string
          rating: number
        }
        Update: {
          coach_id?: string
          created_at?: string
          fixture_id?: string | null
          id?: string
          note?: string | null
          player_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_ratings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_ratings_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_self_assessments: {
        Row: {
          category: string
          created_at: string
          id: string
          player_id: string
          rating: number
          term_id: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          player_id: string
          rating: number
          term_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          player_id?: string
          rating?: number
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_self_assessments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_self_assessments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      player_term_reviews: {
        Row: {
          band: number
          category: string
          id: string
          player_id: string
          reviewed_at: string
          reviewed_by: string | null
          term_id: string
        }
        Insert: {
          band: number
          category: string
          id?: string
          player_id: string
          reviewed_at?: string
          reviewed_by?: string | null
          term_id: string
        }
        Update: {
          band?: number
          category?: string
          id?: string
          player_id?: string
          reviewed_at?: string
          reviewed_by?: string | null
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_term_reviews_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_term_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_term_reviews_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          academy_id: string
          active: boolean
          availability_note: string | null
          availability_status: string
          availability_updated_at: string | null
          availability_updated_by: string | null
          created_at: string
          date_of_birth: string | null
          defending: number | null
          dribbling: number | null
          fifa_number: string | null
          full_name: string
          home_address: string | null
          id: string
          id_doc_url: string | null
          id_number: string | null
          mysafa_number: string | null
          pace: number | null
          passing: number | null
          photo_url: string | null
          physical: number | null
          position: string | null
          preferred_foot: string | null
          profile_id: string | null
          school: string | null
          secondary_pos: string | null
          share_token: string
          shooting: number | null
        }
        Insert: {
          academy_id: string
          active?: boolean
          availability_note?: string | null
          availability_status?: string
          availability_updated_at?: string | null
          availability_updated_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          defending?: number | null
          dribbling?: number | null
          fifa_number?: string | null
          full_name: string
          home_address?: string | null
          id?: string
          id_doc_url?: string | null
          id_number?: string | null
          mysafa_number?: string | null
          pace?: number | null
          passing?: number | null
          photo_url?: string | null
          physical?: number | null
          position?: string | null
          preferred_foot?: string | null
          profile_id?: string | null
          school?: string | null
          secondary_pos?: string | null
          share_token?: string
          shooting?: number | null
        }
        Update: {
          academy_id?: string
          active?: boolean
          availability_note?: string | null
          availability_status?: string
          availability_updated_at?: string | null
          availability_updated_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          defending?: number | null
          dribbling?: number | null
          fifa_number?: string | null
          full_name?: string
          home_address?: string | null
          id?: string
          id_doc_url?: string | null
          id_number?: string | null
          mysafa_number?: string | null
          pace?: number | null
          passing?: number | null
          photo_url?: string | null
          physical?: number | null
          position?: string | null
          preferred_foot?: string | null
          profile_id?: string | null
          school?: string | null
          secondary_pos?: string | null
          share_token?: string
          shooting?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_availability_updated_by_fkey"
            columns: ["availability_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academy_id: string | null
          avatar_url: string | null
          bio: string | null
          calendar_token: string | null
          coaching_role: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: string
        }
        Insert: {
          academy_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          calendar_token?: string | null
          coaching_role?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          role: string
        }
        Update: {
          academy_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          calendar_token?: string | null
          coaching_role?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_challenge_assignments: {
        Row: {
          academy_id: string
          challenge_key: string
          created_at: string
          created_by: string | null
          due_on: string
          id: string
          player_id: string | null
          team_id: string
        }
        Insert: {
          academy_id: string
          challenge_key: string
          created_at?: string
          created_by?: string | null
          due_on: string
          id?: string
          player_id?: string | null
          team_id: string
        }
        Update: {
          academy_id?: string
          challenge_key?: string
          created_at?: string
          created_by?: string | null
          due_on?: string
          id?: string
          player_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_challenge_assignments_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_challenge_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_challenge_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_challenge_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_challenge_attempts: {
        Row: {
          challenge_key: string
          id: string
          logged_at: string
          logged_by: string | null
          player_id: string
          value: number
        }
        Insert: {
          challenge_key: string
          id?: string
          logged_at?: string
          logged_by?: string | null
          player_id: string
          value: number
        }
        Update: {
          challenge_key?: string
          id?: string
          logged_at?: string
          logged_by?: string | null
          player_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_challenge_attempts_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_challenge_attempts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_hats: {
        Row: {
          academy_id: string
          created_at: string
          created_by: string | null
          hat: string
          profile_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          created_by?: string | null
          hat: string
          profile_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          created_by?: string | null
          hat?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_hats_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_hats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_hats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tactic_plays: {
        Row: {
          academy_id: string
          coach_id: string
          concept_ids: string[]
          created_at: string
          data: Json
          fixture_id: string | null
          folder: string | null
          id: string
          name: string
          notes: string | null
          session_id: string | null
          share_token: string | null
          shared: boolean
          surface: string
          team_id: string
          updated_at: string
          voice_path: string | null
          voice_url: string | null
        }
        Insert: {
          academy_id: string
          coach_id: string
          concept_ids?: string[]
          created_at?: string
          data: Json
          fixture_id?: string | null
          folder?: string | null
          id?: string
          name: string
          notes?: string | null
          session_id?: string | null
          share_token?: string | null
          shared?: boolean
          surface?: string
          team_id: string
          updated_at?: string
          voice_path?: string | null
          voice_url?: string | null
        }
        Update: {
          academy_id?: string
          coach_id?: string
          concept_ids?: string[]
          created_at?: string
          data?: Json
          fixture_id?: string | null
          folder?: string | null
          id?: string
          name?: string
          notes?: string | null
          session_id?: string | null
          share_token?: string | null
          shared?: boolean
          surface?: string
          team_id?: string
          updated_at?: string
          voice_path?: string | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tactic_plays_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tactic_plays_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tactic_plays_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tactic_plays_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tactic_plays_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_coaches: {
        Row: {
          added_at: string
          coach_id: string
          is_head: boolean
          team_id: string
        }
        Insert: {
          added_at?: string
          coach_id: string
          is_head?: boolean
          team_id: string
        }
        Update: {
          added_at?: string
          coach_id?: string
          is_head?: boolean
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          joined_at: string
          player_id: string
          team_id: string
        }
        Insert: {
          active?: boolean
          joined_at?: string
          player_id: string
          team_id: string
        }
        Update: {
          active?: boolean
          joined_at?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          academy_id: string
          active: boolean
          age_group: string | null
          coach_code: string | null
          coach_id: string | null
          created_at: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          academy_id: string
          active?: boolean
          age_group?: string | null
          coach_code?: string | null
          coach_id?: string | null
          created_at?: string
          id?: string
          invite_code?: string
          name: string
        }
        Update: {
          academy_id?: string
          active?: boolean
          age_group?: string | null
          coach_code?: string | null
          coach_id?: string | null
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_attendance: {
        Row: {
          created_at: string | null
          id: string
          marked_at: string | null
          marked_by: string | null
          note: string | null
          player_id: string
          rpe: number | null
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          note?: string | null
          player_id: string
          rpe?: number | null
          session_id: string
          status: string
        }
        Update: {
          created_at?: string | null
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          note?: string | null
          player_id?: string
          rpe?: number | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_drills: {
        Row: {
          created_at: string
          description: string | null
          details: Json | null
          id: string
          session_id: string
          sort_order: number
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          details?: Json | null
          id?: string
          session_id: string
          sort_order?: number
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          details?: Json | null
          id?: string
          session_id?: string
          sort_order?: number
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_drills_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_rsvps: {
        Row: {
          id: string
          player_id: string
          responded_at: string
          response: string
          session_id: string
        }
        Insert: {
          id?: string
          player_id: string
          responded_at?: string
          response: string
          session_id: string
        }
        Update: {
          id?: string
          player_id?: string
          responded_at?: string
          response?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_rsvps_player_fk"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_rsvps_session_fk"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          location: string | null
          notes: string | null
          session_date: string
          session_type: string
          team_id: string
          title: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          session_date: string
          session_type?: string
          team_id: string
          title: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          session_date?: string
          session_type?: string
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      welfare_checkins: {
        Row: {
          attendance_pct: number | null
          created_at: string
          id: string
          note: string | null
          noted_by: string
          player_id: string
        }
        Insert: {
          attendance_pct?: number | null
          created_at?: string
          id?: string
          note?: string | null
          noted_by: string
          player_id: string
        }
        Update: {
          attendance_pct?: number | null
          created_at?: string
          id?: string
          note?: string | null
          noted_by?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "welfare_checkins_noted_by_fkey"
            columns: ["noted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welfare_checkins_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_academy_id: { Args: never; Returns: string }
      auth_role: { Args: never; Returns: string }
      can_manage_player_links: {
        Args: { p_player_id: string }
        Returns: boolean
      }
      can_manage_team_objective: {
        Args: {
          p_academy_id: string
          p_subject_id: string
          p_subject_type: string
        }
        Returns: boolean
      }
      claim_player_by_registration: {
        Args: { p_date_of_birth: string; p_number: string }
        Returns: Json
      }
      claim_player_profile: {
        Args: { p_date_of_birth: string; p_share_token: string }
        Returns: Json
      }
      claim_team_by_coach_code: { Args: { p_code: string }; Returns: Json }
      clip_consent_gaps: {
        Args: { p_player_ids: string[]; p_season: string }
        Returns: string[]
      }
      delete_player_photo: { Args: { p_player_id: string }; Returns: Json }
      find_academy_by_join_code: { Args: { p_code: string }; Returns: Json }
      get_calendar_events: {
        Args: { p_token: string }
        Returns: {
          description: string
          kind: string
          location: string
          starts_at: string
          status: string
          team_name: string
          title: string
          uid: string
        }[]
      }
      get_public_passport: { Args: { p_share_token: string }; Returns: Json }
      get_shared_play: { Args: { p_share_token: string }; Returns: Json }
      homework_questions_valid: { Args: { q: Json }; Returns: boolean }
      is_academy_admin: { Args: { p_academy_id: string }; Returns: boolean }
      is_academy_staff: { Args: { p_academy_id: string }; Returns: boolean }
      is_admin_or_coach: { Args: never; Returns: boolean }
      is_team_coach: { Args: { p_team_id: string }; Returns: boolean }
      issue_calendar_token: { Args: { p_rotate?: boolean }; Returns: string }
      issue_parent_link_code: {
        Args: { p_player_id: string; p_relationship?: string }
        Returns: Json
      }
      list_my_shared_plays: {
        Args: never
        Returns: {
          concept_ids: string[]
          id: string
          name: string
          notes: string
          share_token: string
          team_name: string
          updated_at: string
          voice_url: string
        }[]
      }
      list_parent_link_codes: { Args: { p_player_id: string }; Returns: Json }
      log_match_result: {
        Args: {
          p_appearances?: Json
          p_fixture_id: string
          p_match_notes?: string
          p_opponent_score: number
          p_ratings?: Json
          p_team_score: number
        }
        Returns: Json
      }
      peek_access_code: { Args: { p_code: string }; Returns: Json }
      player_academy_matches: {
        Args: { p_player_id: string }
        Returns: boolean
      }
      player_attribute_averages: {
        Args: { p_player_id: string }
        Returns: Json
      }
      player_has_current_photo_consent: {
        Args: { p_player_id: string }
        Returns: boolean
      }
      record_parent_link_failure: { Args: never; Returns: undefined }
      record_player_claim_failure: { Args: never; Returns: undefined }
      redeem_access_code: {
        Args: { p_code: string; p_expect_kind?: string; p_role?: string }
        Returns: Json
      }
      redeem_parent_link_code: {
        Args: { p_code: string; p_relationship?: string }
        Returns: Json
      }
      register_academy: {
        Args: { p_name: string; p_province?: string }
        Returns: Json
      }
      release_team_coach: { Args: { p_team_id: string }; Returns: Json }
      remove_team_coach: {
        Args: { p_coach_id: string; p_team_id: string }
        Returns: Json
      }
      reset_academy_join_code: { Args: never; Returns: string }
      reset_team_coach_code: { Args: { p_team_id: string }; Returns: Json }
      revoke_parent_link_code: { Args: { p_id: string }; Returns: Json }
      shared_play_token: { Args: { p_play_id: string }; Returns: string }
      update_own_registration_numbers: {
        Args: { p_id_number: string; p_mysafa_number: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
