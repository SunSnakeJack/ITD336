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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      academic_terms: {
        Row: {
          academic_year: string
          active: boolean
          created_at: string
          ends_on: string
          id: string
          starts_on: string
          term_code: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          active?: boolean
          created_at?: string
          ends_on: string
          id?: string
          starts_on: string
          term_code: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          active?: boolean
          created_at?: string
          ends_on?: string
          id?: string
          starts_on?: string
          term_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_approvals: {
        Row: {
          action: Database["public"]["Enums"]["approval_action"]
          approver_id: string
          booking_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["approval_action"]
          approver_id: string
          booking_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["approval_action"]
          approver_id?: string
          booking_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_approvals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_approvals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_report_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_approvals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_approvals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "staff_pending_bookings_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_approvals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "user_booking_history_v"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_rules: {
        Row: {
          active: boolean
          description: string | null
          id: string
          rule_key: string
          rule_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          description?: string | null
          id?: string
          rule_key: string
          rule_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          description?: string | null
          id?: string
          rule_key?: string
          rule_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          booking_id: string
          changed_by: string | null
          created_at: string
          id: number
          new_status: Database["public"]["Enums"]["booking_status"]
          previous_status: Database["public"]["Enums"]["booking_status"] | null
          reason: string | null
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          created_at?: string
          id?: never
          new_status: Database["public"]["Enums"]["booking_status"]
          previous_status?: Database["public"]["Enums"]["booking_status"] | null
          reason?: string | null
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          created_at?: string
          id?: never
          new_status?: Database["public"]["Enums"]["booking_status"]
          previous_status?: Database["public"]["Enums"]["booking_status"] | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_report_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "staff_pending_bookings_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "user_booking_history_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          beneficiary_user_id: string | null
          booking_code: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          ends_at: string
          external_party_id: string | null
          id: string
          is_priority: boolean
          notes: string | null
          override_reason: string | null
          purpose: string
          requester_id: string
          requires_key: boolean
          room_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          superseded_by_booking_id: string | null
          updated_at: string
        }
        Insert: {
          beneficiary_user_id?: string | null
          booking_code?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          ends_at: string
          external_party_id?: string | null
          id?: string
          is_priority?: boolean
          notes?: string | null
          override_reason?: string | null
          purpose: string
          requester_id: string
          requires_key?: boolean
          room_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          superseded_by_booking_id?: string | null
          updated_at?: string
        }
        Update: {
          beneficiary_user_id?: string | null
          booking_code?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          ends_at?: string
          external_party_id?: string | null
          id?: string
          is_priority?: boolean
          notes?: string | null
          override_reason?: string | null
          purpose?: string
          requester_id?: string
          requires_key?: boolean
          room_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          superseded_by_booking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_beneficiary_user_id_fkey"
            columns: ["beneficiary_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "booking_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "booking_report_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "staff_pending_bookings_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "user_booking_history_v"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          academic_year: string
          active: boolean
          course_code: string | null
          created_at: string
          created_by: string | null
          day_of_week: number
          effective_from: string
          effective_until: string
          end_time: string
          ends_at: string
          id: string
          recurrence_rule: string | null
          recurrence_until: string | null
          responsible_user_id: string | null
          room_id: string
          schedule_type: Database["public"]["Enums"]["schedule_type"]
          semester: string
          start_time: string
          starts_at: string
          status: Database["public"]["Enums"]["schedule_status"]
          subject_name: string | null
          teacher_id: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year: string
          active?: boolean
          course_code?: string | null
          created_at?: string
          created_by?: string | null
          day_of_week: number
          effective_from: string
          effective_until: string
          end_time: string
          ends_at: string
          id?: string
          recurrence_rule?: string | null
          recurrence_until?: string | null
          responsible_user_id?: string | null
          room_id: string
          schedule_type?: Database["public"]["Enums"]["schedule_type"]
          semester: string
          start_time: string
          starts_at: string
          status?: Database["public"]["Enums"]["schedule_status"]
          subject_name?: string | null
          teacher_id?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year?: string
          active?: boolean
          course_code?: string | null
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          effective_from?: string
          effective_until?: string
          end_time?: string
          ends_at?: string
          id?: string
          recurrence_rule?: string | null
          recurrence_until?: string | null
          responsible_user_id?: string | null
          room_id?: string
          schedule_type?: Database["public"]["Enums"]["schedule_type"]
          semester?: string
          start_time?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          subject_name?: string | null
          teacher_id?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "class_schedules_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      external_parties: {
        Row: {
          contact_reference: string | null
          created_at: string
          created_by: string
          full_name: string
          id: string
          organization_name: string | null
          updated_at: string
        }
        Insert: {
          contact_reference?: string | null
          created_at?: string
          created_by: string
          full_name: string
          id?: string
          organization_name?: string | null
          updated_at?: string
        }
        Update: {
          contact_reference?: string | null
          created_at?: string
          created_by?: string
          full_name?: string
          id?: string
          organization_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_parties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          booking_allowed: boolean
          holiday_date: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          booking_allowed?: boolean
          holiday_date: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          booking_allowed?: boolean
          holiday_date?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      key_compensations: {
        Row: {
          amount: number | null
          created_at: string
          currency: string
          id: string
          incident_id: string
          notes: string | null
          paid_at: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["compensation_status"]
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          incident_id: string
          notes?: string | null
          paid_at?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["compensation_status"]
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          incident_id?: string
          notes?: string | null
          paid_at?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["compensation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_compensations_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "key_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_compensations_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      key_incidents: {
        Row: {
          description: string
          id: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          key_id: string | null
          key_loan_id: string | null
          reported_at: string
          reported_by: string
          resolution_notes: string | null
          resolved_at: string | null
          responsible_user_id: string | null
          status: Database["public"]["Enums"]["incident_status"]
        }
        Insert: {
          description: string
          id?: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          key_id?: string | null
          key_loan_id?: string | null
          reported_at?: string
          reported_by: string
          resolution_notes?: string | null
          resolved_at?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
        }
        Update: {
          description?: string
          id?: string
          incident_type?: Database["public"]["Enums"]["incident_type"]
          key_id?: string | null
          key_loan_id?: string | null
          reported_at?: string
          reported_by?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
        }
        Relationships: [
          {
            foreignKeyName: "key_incidents_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "key_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_incidents_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "room_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_incidents_key_loan_id_fkey"
            columns: ["key_loan_id"]
            isOneToOne: false
            referencedRelation: "active_key_loans_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_incidents_key_loan_id_fkey"
            columns: ["key_loan_id"]
            isOneToOne: false
            referencedRelation: "admin_key_activity_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_incidents_key_loan_id_fkey"
            columns: ["key_loan_id"]
            isOneToOne: false
            referencedRelation: "key_current_status_v"
            referencedColumns: ["active_loan_id"]
          },
          {
            foreignKeyName: "key_incidents_key_loan_id_fkey"
            columns: ["key_loan_id"]
            isOneToOne: false
            referencedRelation: "key_loan_report_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_incidents_key_loan_id_fkey"
            columns: ["key_loan_id"]
            isOneToOne: false
            referencedRelation: "key_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_incidents_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      key_loan_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: number
          key_loan_id: string
          new_status: Database["public"]["Enums"]["key_loan_status"]
          notes: string | null
          previous_status: Database["public"]["Enums"]["key_loan_status"] | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: never
          key_loan_id: string
          new_status: Database["public"]["Enums"]["key_loan_status"]
          notes?: string | null
          previous_status?:
            | Database["public"]["Enums"]["key_loan_status"]
            | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: never
          key_loan_id?: string
          new_status?: Database["public"]["Enums"]["key_loan_status"]
          notes?: string | null
          previous_status?:
            | Database["public"]["Enums"]["key_loan_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "key_loan_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loan_history_key_loan_id_fkey"
            columns: ["key_loan_id"]
            isOneToOne: false
            referencedRelation: "active_key_loans_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loan_history_key_loan_id_fkey"
            columns: ["key_loan_id"]
            isOneToOne: false
            referencedRelation: "admin_key_activity_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loan_history_key_loan_id_fkey"
            columns: ["key_loan_id"]
            isOneToOne: false
            referencedRelation: "key_current_status_v"
            referencedColumns: ["active_loan_id"]
          },
          {
            foreignKeyName: "key_loan_history_key_loan_id_fkey"
            columns: ["key_loan_id"]
            isOneToOne: false
            referencedRelation: "key_loan_report_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loan_history_key_loan_id_fkey"
            columns: ["key_loan_id"]
            isOneToOne: false
            referencedRelation: "key_loans"
            referencedColumns: ["id"]
          },
        ]
      }
      key_loans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          authorized_by: string | null
          booking_id: string | null
          borrower_id: string
          checked_out_at: string | null
          checked_out_by: string | null
          class_schedule_id: string | null
          created_at: string
          expected_return_at: string | null
          id: string
          key_id: string | null
          notes: string | null
          physically_verified_at: string | null
          physically_verified_by: string | null
          requested_at: string
          requested_by: string
          return_confirmed_by: string | null
          returned_at: string | null
          returned_to: string | null
          room_id: string
          status: Database["public"]["Enums"]["key_loan_status"]
          updated_at: string
          usage_source: Database["public"]["Enums"]["key_usage_source"]
          user_reported_return_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          authorized_by?: string | null
          booking_id?: string | null
          borrower_id: string
          checked_out_at?: string | null
          checked_out_by?: string | null
          class_schedule_id?: string | null
          created_at?: string
          expected_return_at?: string | null
          id?: string
          key_id?: string | null
          notes?: string | null
          physically_verified_at?: string | null
          physically_verified_by?: string | null
          requested_at?: string
          requested_by: string
          return_confirmed_by?: string | null
          returned_at?: string | null
          returned_to?: string | null
          room_id: string
          status?: Database["public"]["Enums"]["key_loan_status"]
          updated_at?: string
          usage_source?: Database["public"]["Enums"]["key_usage_source"]
          user_reported_return_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          authorized_by?: string | null
          booking_id?: string | null
          borrower_id?: string
          checked_out_at?: string | null
          checked_out_by?: string | null
          class_schedule_id?: string | null
          created_at?: string
          expected_return_at?: string | null
          id?: string
          key_id?: string | null
          notes?: string | null
          physically_verified_at?: string | null
          physically_verified_by?: string | null
          requested_at?: string
          requested_by?: string
          return_confirmed_by?: string | null
          returned_at?: string | null
          returned_to?: string | null
          room_id?: string
          status?: Database["public"]["Enums"]["key_loan_status"]
          updated_at?: string
          usage_source?: Database["public"]["Enums"]["key_usage_source"]
          user_reported_return_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_loans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_report_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "staff_pending_bookings_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "user_booking_history_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_checked_out_by_fkey"
            columns: ["checked_out_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_class_schedule_id_fkey"
            columns: ["class_schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "key_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "room_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_physically_verified_by_fkey"
            columns: ["physically_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_return_confirmed_by_fkey"
            columns: ["return_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_returned_to_fkey"
            columns: ["returned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "key_loans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          channel: Database["public"]["Enums"]["delivery_channel"]
          created_at: string
          error_message: string | null
          id: string
          notification_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
        }
        Insert: {
          channel: Database["public"]["Enums"]["delivery_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Update: {
          channel?: Database["public"]["Enums"]["delivery_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          organization_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          organization_type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          created_at: string
          email: string
          full_name: string
          id: string
          identity_provider: string | null
          identity_subject: string | null
          identity_verified_at: string | null
          organization_id: string | null
          phone: string | null
          university_id: string | null
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          email: string
          full_name?: string
          id: string
          identity_provider?: string | null
          identity_subject?: string | null
          identity_verified_at?: string | null
          organization_id?: string | null
          phone?: string | null
          university_id?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          identity_provider?: string | null
          identity_subject?: string | null
          identity_verified_at?: string | null
          organization_id?: string | null
          phone?: string | null
          university_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          system_role: boolean
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          system_role?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          system_role?: boolean
        }
        Relationships: []
      }
      room_blocks: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string
          id: string
          reason: string
          room_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          reason: string
          room_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          reason?: string
          room_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "room_blocks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_equipment: {
        Row: {
          equipment_id: string
          notes: string | null
          quantity: number
          room_id: string
        }
        Insert: {
          equipment_id: string
          notes?: string | null
          quantity?: number
          room_id: string
        }
        Update: {
          equipment_id?: string
          notes?: string | null
          quantity?: number
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_equipment_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "room_equipment_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_equipment_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_keys: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key_code: string
          notes: string | null
          permanent_custodian_id: string | null
          room_id: string
          status: Database["public"]["Enums"]["key_status"]
          tracking_mode: Database["public"]["Enums"]["key_tracking_mode"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key_code: string
          notes?: string | null
          permanent_custodian_id?: string | null
          room_id: string
          status?: Database["public"]["Enums"]["key_status"]
          tracking_mode?: Database["public"]["Enums"]["key_tracking_mode"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key_code?: string
          notes?: string | null
          permanent_custodian_id?: string | null
          room_id?: string
          status?: Database["public"]["Enums"]["key_status"]
          tracking_mode?: Database["public"]["Enums"]["key_tracking_mode"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_keys_permanent_custodian_id_fkey"
            columns: ["permanent_custodian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_keys_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "room_keys_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_keys_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_operating_hours: {
        Row: {
          active: boolean
          closes_at: string
          day_of_week: number
          id: string
          opens_at: string
          room_id: string | null
        }
        Insert: {
          active?: boolean
          closes_at: string
          day_of_week: number
          id?: string
          opens_at: string
          room_id?: string | null
        }
        Update: {
          active?: boolean
          closes_at?: string
          day_of_week?: number
          id?: string
          opens_at?: string
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_operating_hours_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "room_operating_hours_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_operating_hours_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          active: boolean
          booking_policy: Database["public"]["Enums"]["booking_policy"]
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          student_booking_allowed: boolean
        }
        Insert: {
          active?: boolean
          booking_policy?: Database["public"]["Enums"]["booking_policy"]
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          student_booking_allowed?: boolean
        }
        Update: {
          active?: boolean
          booking_policy?: Database["public"]["Enums"]["booking_policy"]
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          student_booking_allowed?: boolean
        }
        Relationships: []
      }
      room_usage_policies: {
        Row: {
          guest_view_details: boolean
          guest_view_schedule: boolean
          manual_approval: boolean
          room_id: string
          student_book_empty: boolean
          student_class_key: boolean
          student_manage_own_booking: boolean
          student_own_booking_key: boolean
          student_view_details: boolean
          student_view_own_history: boolean
          student_view_own_key_status: boolean
          student_view_schedule: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          guest_view_details?: boolean
          guest_view_schedule?: boolean
          manual_approval?: boolean
          room_id: string
          student_book_empty?: boolean
          student_class_key?: boolean
          student_manage_own_booking?: boolean
          student_own_booking_key?: boolean
          student_view_details?: boolean
          student_view_own_history?: boolean
          student_view_own_key_status?: boolean
          student_view_schedule?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          guest_view_details?: boolean
          guest_view_schedule?: boolean
          manual_approval?: boolean
          room_id?: string
          student_book_empty?: boolean
          student_class_key?: boolean
          student_manage_own_booking?: boolean
          student_own_booking_key?: boolean
          student_view_details?: boolean
          student_view_own_history?: boolean
          student_view_own_key_status?: boolean
          student_view_schedule?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_usage_policies_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "room_usage_policies_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_usage_policies_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_usage_policies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          academic_schedule_confirmed: boolean
          academic_schedule_confirmed_at: string | null
          academic_schedule_confirmed_by: string | null
          active: boolean
          booking_enabled: boolean
          building: string | null
          capacity: number
          code: string
          created_at: string
          description: string | null
          floor: string | null
          id: string
          layout_key: string
          location_description: string | null
          name: string
          room_type_id: string
          updated_at: string
        }
        Insert: {
          academic_schedule_confirmed?: boolean
          academic_schedule_confirmed_at?: string | null
          academic_schedule_confirmed_by?: string | null
          active?: boolean
          booking_enabled?: boolean
          building?: string | null
          capacity: number
          code: string
          created_at?: string
          description?: string | null
          floor?: string | null
          id?: string
          layout_key: string
          location_description?: string | null
          name: string
          room_type_id: string
          updated_at?: string
        }
        Update: {
          academic_schedule_confirmed?: boolean
          academic_schedule_confirmed_at?: string | null
          academic_schedule_confirmed_by?: string | null
          active?: boolean
          booking_enabled?: boolean
          building?: string | null
          capacity?: number
          code?: string
          created_at?: string
          description?: string | null
          floor?: string | null
          id?: string
          layout_key?: string
          location_description?: string | null
          name?: string
          room_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_academic_schedule_confirmed_by_fkey"
            columns: ["academic_schedule_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_key_loans_v: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          authorized_by: string | null
          booking_id: string | null
          borrower_id: string | null
          checked_out_at: string | null
          checked_out_by: string | null
          class_schedule_id: string | null
          created_at: string | null
          expected_return_at: string | null
          id: string | null
          key_code: string | null
          key_id: string | null
          notes: string | null
          physically_verified_at: string | null
          physically_verified_by: string | null
          requested_at: string | null
          requested_by: string | null
          return_confirmed_by: string | null
          returned_at: string | null
          returned_to: string | null
          room_code: string | null
          room_id: string | null
          room_name: string | null
          status: Database["public"]["Enums"]["key_loan_status"] | null
          updated_at: string | null
          usage_source: Database["public"]["Enums"]["key_usage_source"] | null
          user_reported_return_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_loans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_report_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "staff_pending_bookings_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "user_booking_history_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_checked_out_by_fkey"
            columns: ["checked_out_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_class_schedule_id_fkey"
            columns: ["class_schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "key_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "room_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_physically_verified_by_fkey"
            columns: ["physically_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_return_confirmed_by_fkey"
            columns: ["return_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_returned_to_fkey"
            columns: ["returned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "key_loans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_key_activity_v: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          authorized_by: string | null
          booking_id: string | null
          borrower_id: string | null
          checked_out_at: string | null
          checked_out_by: string | null
          class_schedule_id: string | null
          created_at: string | null
          expected_return_at: string | null
          id: string | null
          key_code: string | null
          key_id: string | null
          notes: string | null
          physically_verified_at: string | null
          physically_verified_by: string | null
          requested_at: string | null
          requested_by: string | null
          return_confirmed_by: string | null
          returned_at: string | null
          returned_late: boolean | null
          returned_to: string | null
          room_code: string | null
          room_id: string | null
          room_name: string | null
          status: Database["public"]["Enums"]["key_loan_status"] | null
          updated_at: string | null
          usage_source: Database["public"]["Enums"]["key_usage_source"] | null
          user_reported_return_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_loans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_report_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "staff_pending_bookings_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "user_booking_history_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_checked_out_by_fkey"
            columns: ["checked_out_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_class_schedule_id_fkey"
            columns: ["class_schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "key_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "room_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_physically_verified_by_fkey"
            columns: ["physically_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_return_confirmed_by_fkey"
            columns: ["return_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_returned_to_fkey"
            columns: ["returned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "key_loans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_details_v: {
        Row: {
          beneficiary_user_id: string | null
          booking_code: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          ends_at: string | null
          external_party_id: string | null
          id: string | null
          is_priority: boolean | null
          notes: string | null
          override_reason: string | null
          purpose: string | null
          requester_id: string | null
          requester_name: string | null
          requires_key: boolean | null
          room_code: string | null
          room_id: string | null
          room_name: string | null
          room_user_name: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          superseded_by_booking_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_beneficiary_user_id_fkey"
            columns: ["beneficiary_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "booking_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "booking_report_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "staff_pending_bookings_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "user_booking_history_v"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_report_v: {
        Row: {
          beneficiary_user_id: string | null
          booking_code: string | null
          created_at: string | null
          ends_at: string | null
          external_party_id: string | null
          id: string | null
          override_reason: string | null
          requester_id: string | null
          room_code: string | null
          room_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          superseded_by_booking_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_beneficiary_user_id_fkey"
            columns: ["beneficiary_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "booking_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "booking_report_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "staff_pending_bookings_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "user_booking_history_v"
            referencedColumns: ["id"]
          },
        ]
      }
      key_current_status_v: {
        Row: {
          active: boolean | null
          active_loan_id: string | null
          borrower_id: string | null
          checked_out_at: string | null
          expected_return_at: string | null
          id: string | null
          key_code: string | null
          room_code: string | null
          room_id: string | null
          room_name: string | null
          status: Database["public"]["Enums"]["key_status"] | null
          tracking_mode: Database["public"]["Enums"]["key_tracking_mode"] | null
          usage_source: Database["public"]["Enums"]["key_usage_source"] | null
          user_reported_return_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_keys_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "room_keys_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_keys_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      key_loan_report_v: {
        Row: {
          available_from: string | null
          borrower_id: string | null
          checked_out_at: string | null
          expected_return_at: string | null
          id: string | null
          key_code: string | null
          key_id: string | null
          overdue: boolean | null
          returned_at: string | null
          room_code: string | null
          room_id: string | null
          status: Database["public"]["Enums"]["key_loan_status"] | null
          usage_source: Database["public"]["Enums"]["key_usage_source"] | null
          user_reported_return_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "key_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "room_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "key_loans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_loans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_room_summary_v: {
        Row: {
          available_key_count: number | null
          capacity: number | null
          occupied_by_booking: boolean | null
          occupied_by_schedule: boolean | null
          room_code: string | null
          room_id: string | null
          room_name: string | null
        }
        Relationships: []
      }
      room_current_status_v: {
        Row: {
          active: boolean | null
          available_key_count: number | null
          base_status: string | null
          booking_enabled: boolean | null
          capacity: number | null
          code: string | null
          id: string | null
          name: string | null
        }
        Relationships: []
      }
      staff_pending_bookings_v: {
        Row: {
          beneficiary_user_id: string | null
          booking_code: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          ends_at: string | null
          external_party_id: string | null
          id: string | null
          is_priority: boolean | null
          notes: string | null
          override_reason: string | null
          purpose: string | null
          requester_id: string | null
          requester_name: string | null
          requires_key: boolean | null
          room_code: string | null
          room_id: string | null
          room_name: string | null
          room_user_name: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          superseded_by_booking_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_beneficiary_user_id_fkey"
            columns: ["beneficiary_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "booking_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "booking_report_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "staff_pending_bookings_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "user_booking_history_v"
            referencedColumns: ["id"]
          },
        ]
      }
      user_booking_history_v: {
        Row: {
          beneficiary_user_id: string | null
          booking_code: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          ends_at: string | null
          external_party_id: string | null
          id: string | null
          is_priority: boolean | null
          notes: string | null
          override_reason: string | null
          purpose: string | null
          requester_id: string | null
          requester_name: string | null
          requires_key: boolean | null
          room_code: string | null
          room_id: string | null
          room_name: string | null
          room_user_name: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          superseded_by_booking_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_beneficiary_user_id_fkey"
            columns: ["beneficiary_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "operational_room_summary_v"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_current_status_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "booking_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "booking_report_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "staff_pending_bookings_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_superseded_by_booking_id_fkey"
            columns: ["superseded_by_booking_id"]
            isOneToOne: false
            referencedRelation: "user_booking_history_v"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_booking: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: Json
      }
      approve_key_request: {
        Args: { p_key_loan_id: string; p_notes?: string }
        Returns: Json
      }
      borrow_key: {
        Args: {
          p_booking_id?: string
          p_borrower_id?: string
          p_class_schedule_id?: string
          p_expected_return_at: string
          p_key_id: string
          p_notes?: string
          p_room_id: string
          p_usage_source: Database["public"]["Enums"]["key_usage_source"]
        }
        Returns: Json
      }
      cancel_booking: {
        Args: { p_booking_id: string; p_reason: string }
        Returns: Json
      }
      check_room_availability: {
        Args: {
          p_ends_at: string
          p_exclude_booking_id?: string
          p_room_id: string
          p_starts_at: string
        }
        Returns: {
          available: boolean
          conflict_description: string
          conflict_id: string
          conflict_type: string
        }[]
      }
      checkout_key: {
        Args: {
          p_expected_return_at: string
          p_key_id: string
          p_key_loan_id: string
        }
        Returns: Json
      }
      confirm_key_return: {
        Args: {
          p_key_loan_id: string
          p_notes?: string
          p_reported_return_at?: string
        }
        Returns: Json
      }
      create_booking: {
        Args: {
          p_ends_at: string
          p_notes?: string
          p_purpose: string
          p_requires_key?: boolean
          p_room_id: string
          p_starts_at: string
        }
        Returns: Json
      }
      create_external_booking: {
        Args: {
          p_ends_at: string
          p_external_name: string
          p_organization_name: string
          p_purpose: string
          p_reason: string
          p_room_id: string
          p_starts_at: string
        }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_message: string
          p_title: string
          p_type: string
          p_user: string
        }
        Returns: string
      }
      deactivate_academic_schedule: {
        Args: { p_reason: string; p_schedule_id: string }
        Returns: undefined
      }
      find_academic_schedule_conflict: {
        Args: {
          p_day_of_week: number
          p_effective_from: string
          p_effective_until: string
          p_end_time: string
          p_room_id: string
          p_schedule_id: string
          p_start_time: string
        }
        Returns: {
          course_code: string
          day_of_week: number
          end_time: string
          start_time: string
          subject_name: string
        }[]
      }
      get_admin_key_cabinet: {
        Args: never
        Returns: {
          available_keys: number
          held_keys: number
          key_status: string
          room_active: boolean
          room_code: string
          room_id: string
          room_name: string
        }[]
      }
      get_external_booking_for_edit: {
        Args: { p_booking_id: string }
        Returns: {
          booking_id: string
          ends_at: string
          external_name: string
          reason: string
          starts_at: string
        }[]
      }
      get_public_room_catalog: {
        Args: never
        Returns: {
          academic_schedule_confirmed: boolean
          active: boolean
          building: string
          capacity: number
          code: string
          floor: string
          id: string
          layout_key: string
          name: string
          room_type_name: string
        }[]
      }
      get_public_room_schedule_events: {
        Args: { p_range_end: string; p_range_start: string; p_room_id: string }
        Returns: {
          ends_at: string
          event_type: string
          id: string
          is_mine: boolean
          source_id: string
          source_type: string
          starts_at: string
          status: string
          title: string
        }[]
      }
      get_room_schedule_events: {
        Args: { p_range_end: string; p_range_start: string; p_room_id: string }
        Returns: {
          ends_at: string
          event_type: string
          id: string
          source_id: string
          source_type: string
          starts_at: string
          status: string
          title: string
        }[]
      }
      get_room_slot_permissions: {
        Args: { p_ends_at: string; p_room_id: string; p_starts_at: string }
        Returns: {
          booking_reason: string
          can_book: boolean
          can_request_key: boolean
          class_schedule_id: string
          key_reason: string
          own_booking_id: string
        }[]
      }
      get_room_usage_policy: {
        Args: { p_room_id: string }
        Returns: {
          guest_view_details: boolean
          guest_view_schedule: boolean
          manual_approval: boolean
          room_id: string
          student_book_empty: boolean
          student_class_key: boolean
          student_manage_own_booking: boolean
          student_own_booking_key: boolean
          student_view_details: boolean
          student_view_own_history: boolean
          student_view_own_key_status: boolean
          student_view_schedule: boolean
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "room_usage_policies"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_usage_permission_policy: { Args: never; Returns: Json }
      has_permission: { Args: { p_permission: string }; Returns: boolean }
      has_role: { Args: { p_role: string }; Returns: boolean }
      list_available_rooms: {
        Args: { p_ends_at: string; p_starts_at: string }
        Returns: {
          academic_schedule_confirmed: boolean
          academic_schedule_confirmed_at: string | null
          academic_schedule_confirmed_by: string | null
          active: boolean
          booking_enabled: boolean
          building: string | null
          capacity: number
          code: string
          created_at: string
          description: string | null
          floor: string | null
          id: string
          layout_key: string
          location_description: string | null
          name: string
          room_type_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "rooms"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_public_room_availability: {
        Args: { p_ends_at: string; p_starts_at: string }
        Returns: {
          available: boolean
          capacity: number
          room_code: string
          room_id: string
          room_name: string
        }[]
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      override_booking: {
        Args: {
          p_existing_booking_id: string
          p_purpose: string
          p_reason: string
          p_requires_key?: boolean
        }
        Returns: Json
      }
      reject_booking: {
        Args: { p_booking_id: string; p_reason: string }
        Returns: Json
      }
      report_key_damage: {
        Args: { p_description: string; p_key_loan_id: string }
        Returns: Json
      }
      report_key_issue: {
        Args: {
          p_condition: string
          p_description: string
          p_key_loan_id: string
        }
        Returns: Json
      }
      report_key_status: {
        Args: {
          p_action: string
          p_description?: string
          p_key_loan_id: string
        }
        Returns: Json
      }
      request_booking_key: {
        Args: { p_booking_id: string; p_notes?: string }
        Returns: Json
      }
      request_class_key: {
        Args: {
          p_class_schedule_id: string
          p_ends_at: string
          p_notes?: string
          p_room_id: string
          p_starts_at: string
        }
        Returns: Json
      }
      request_key: { Args: { p_booking_id: string }; Returns: Json }
      return_key: {
        Args: { p_condition?: string; p_key_loan_id: string; p_notes?: string }
        Returns: Json
      }
      set_room_availability: {
        Args: { p_active: boolean; p_room_id: string }
        Returns: boolean
      }
      set_room_schedule_confirmation: {
        Args: { p_confirmed: boolean; p_room_id: string }
        Returns: undefined
      }
      update_external_booking: {
        Args: {
          p_booking_id: string
          p_ends_at: string
          p_external_name: string
          p_reason: string
          p_starts_at: string
        }
        Returns: Json
      }
      update_room_details: {
        Args: {
          p_active: boolean
          p_capacity: number
          p_name: string
          p_room_id: string
        }
        Returns: boolean
      }
      update_room_details_v2: {
        Args: {
          p_active: boolean
          p_capacity: number
          p_code: string
          p_name: string
          p_room_id: string
        }
        Returns: boolean
      }
      update_room_usage_policy: {
        Args: { p_policy: Json; p_room_id: string }
        Returns: boolean
      }
      update_usage_permission_policy: {
        Args: { p_policy: Json }
        Returns: Json
      }
      upsert_academic_schedule: {
        Args: {
          p_academic_year: string
          p_course_code: string
          p_day_of_week: number
          p_effective_from: string
          p_effective_until: string
          p_end_time: string
          p_room_id: string
          p_schedule_id: string
          p_semester: string
          p_start_time: string
          p_subject_name: string
          p_teacher_id: string
        }
        Returns: string
      }
      upsert_academic_term: {
        Args: {
          p_academic_year: string
          p_active: boolean
          p_ends_on: string
          p_starts_on: string
          p_term_code: string
          p_term_id: string
        }
        Returns: string
      }
      write_audit: {
        Args: {
          p_action: string
          p_actor: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "ACTIVE" | "SUSPENDED" | "INACTIVE"
      approval_action: "APPROVED" | "REJECTED"
      booking_policy: "AUTO_CONFIRM" | "MANUAL_APPROVAL"
      booking_status:
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "CANCELLED"
        | "IN_USE"
        | "COMPLETED"
        | "NO_SHOW"
        | "SUPERSEDED"
      compensation_status:
        | "PENDING"
        | "ASSESSED"
        | "PAID"
        | "WAIVED"
        | "CANCELLED"
      delivery_channel: "EMAIL" | "IN_APP"
      delivery_status: "PENDING" | "SENT" | "FAILED"
      incident_status:
        | "OPEN"
        | "UNDER_REVIEW"
        | "AWAITING_PAYMENT"
        | "RESOLVED"
        | "CANCELLED"
      incident_type: "LOST" | "DAMAGED" | "LATE_RETURN" | "OTHER"
      key_loan_status:
        | "REQUESTED"
        | "APPROVED"
        | "REJECTED"
        | "CHECKED_OUT"
        | "RETURNED"
        | "LATE"
        | "LOST"
        | "DAMAGED"
        | "CANCELLED"
        | "RETURN_REPORTED"
      key_status:
        | "AVAILABLE"
        | "RESERVED"
        | "CHECKED_OUT"
        | "LOST"
        | "DAMAGED"
        | "INACTIVE"
      key_tracking_mode: "TRACKED" | "EXCLUDED_PERMANENT"
      key_usage_source: "BOOKING" | "CLASS_SCHEDULE" | "DIRECT_USAGE"
      schedule_status: "ACTIVE" | "CANCELLED" | "COMPLETED"
      schedule_type: "CLASS" | "ADMIN_ALLOCATION"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["ACTIVE", "SUSPENDED", "INACTIVE"],
      approval_action: ["APPROVED", "REJECTED"],
      booking_policy: ["AUTO_CONFIRM", "MANUAL_APPROVAL"],
      booking_status: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        "IN_USE",
        "COMPLETED",
        "NO_SHOW",
        "SUPERSEDED",
      ],
      compensation_status: [
        "PENDING",
        "ASSESSED",
        "PAID",
        "WAIVED",
        "CANCELLED",
      ],
      delivery_channel: ["EMAIL", "IN_APP"],
      delivery_status: ["PENDING", "SENT", "FAILED"],
      incident_status: [
        "OPEN",
        "UNDER_REVIEW",
        "AWAITING_PAYMENT",
        "RESOLVED",
        "CANCELLED",
      ],
      incident_type: ["LOST", "DAMAGED", "LATE_RETURN", "OTHER"],
      key_loan_status: [
        "REQUESTED",
        "APPROVED",
        "REJECTED",
        "CHECKED_OUT",
        "RETURNED",
        "LATE",
        "LOST",
        "DAMAGED",
        "CANCELLED",
        "RETURN_REPORTED",
      ],
      key_status: [
        "AVAILABLE",
        "RESERVED",
        "CHECKED_OUT",
        "LOST",
        "DAMAGED",
        "INACTIVE",
      ],
      key_tracking_mode: ["TRACKED", "EXCLUDED_PERMANENT"],
      key_usage_source: ["BOOKING", "CLASS_SCHEDULE", "DIRECT_USAGE"],
      schedule_status: ["ACTIVE", "CANCELLED", "COMPLETED"],
      schedule_type: ["CLASS", "ADMIN_ALLOCATION"],
    },
  },
} as const
