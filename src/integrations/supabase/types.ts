 type Json =
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
      author: {
        Row: {
          authorID: number
          authorName: string
          bio: string | null
        }
        Insert: {
          authorID?: number
          authorName: string
          bio?: string | null
        }
        Update: {
          authorID?: number
          authorName?: string
          bio?: string | null
        }
        Relationships: []
      }
      book_type: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      books: {
        Row: {
          authorID: number | null
          bookID: number
          coverImage: string | null
          createdAt: string | null
          description: string | null
          is_new: boolean | null
          is_popular: boolean | null
          price: number | null
          publishDate: string | null
          publisherID: number | null
          rating: number | null
          review_count: number | null
          slug: string | null
          title: string
          titleEn: string | null
          type_id: number | null
        }
        Insert: {
          authorID?: number | null
          bookID?: number
          coverImage?: string | null
          createdAt?: string | null
          description?: string | null
          is_new?: boolean | null
          is_popular?: boolean | null
          price?: number | null
          publishDate?: string | null
          publisherID?: number | null
          rating?: number | null
          review_count?: number | null
          slug?: string | null
          title: string
          titleEn?: string | null
          type_id?: number | null
        }
        Update: {
          authorID?: number | null
          bookID?: number
          coverImage?: string | null
          createdAt?: string | null
          description?: string | null
          is_new?: boolean | null
          is_popular?: boolean | null
          price?: number | null
          publishDate?: string | null
          publisherID?: number | null
          rating?: number | null
          review_count?: number | null
          slug?: string | null
          title?: string
          titleEn?: string | null
          type_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "book_publisherID_fkey"
            columns: ["publisherID"]
            isOneToOne: false
            referencedRelation: "publisher"
            referencedColumns: ["publisherID"]
          },
          {
            foreignKeyName: "books_authorID_fkey"
            columns: ["authorID"]
            isOneToOne: false
            referencedRelation: "author"
            referencedColumns: ["authorID"]
          },
          {
            foreignKeyName: "fk_book_type"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "book_type"
            referencedColumns: ["id"]
          },
        ]
      }
      bookTag: {
        Row: {
          bookID: number | null
          id: number
          tagID: number | null
        }
        Insert: {
          bookID?: number | null
          id?: number
          tagID?: number | null
        }
        Update: {
          bookID?: number | null
          id?: number
          tagID?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookTag_bookID_fkey"
            columns: ["bookID"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["bookID"]
          },
          {
            foreignKeyName: "bookTag_tagID_fkey"
            columns: ["tagID"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["tagID"]
          },
        ]
      }
      favorite: {
        Row: {
          bookID: number | null
          createdAt: string | null
          favoriteID: number
          user_id: string | null
        }
        Insert: {
          bookID?: number | null
          createdAt?: string | null
          favoriteID?: number
          user_id?: string | null
        }
        Update: {
          bookID?: number | null
          createdAt?: string | null
          favoriteID?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorite_bookID_fkey"
            columns: ["bookID"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["bookID"]
          },
        ]
      }
      interaction: {
        Row: {
          actionType: string | null
          bookID: number | null
          createdAt: string | null
          interactionID: number
          user_id: string | null
        }
        Insert: {
          actionType?: string | null
          bookID?: number | null
          createdAt?: string | null
          interactionID?: number
          user_id?: string | null
        }
        Update: {
          actionType?: string | null
          bookID?: number | null
          createdAt?: string | null
          interactionID?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interaction_bookID_fkey"
            columns: ["bookID"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["bookID"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          userID: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          userID?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          userID?: string
        }
        Relationships: []
      }
      publisher: {
        Row: {
          publisherID: number
          publisherName: string
          website: string | null
        }
        Insert: {
          publisherID?: number
          publisherName: string
          website?: string | null
        }
        Update: {
          publisherID?: number
          publisherName?: string
          website?: string | null
        }
        Relationships: []
      }
      review: {
        Row: {
          bookID: number
          comment: string | null
          createdAt: string | null
          rating: number | null
          reviewID: number
          user_id: string | null
        }
        Insert: {
          bookID: number
          comment?: string | null
          createdAt?: string | null
          rating?: number | null
          reviewID?: number
          user_id?: string | null
        }
        Update: {
          bookID?: number
          comment?: string | null
          createdAt?: string | null
          rating?: number | null
          reviewID?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_bookID_fkey"
            columns: ["bookID"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["bookID"]
          },
        ]
      }
      tag: {
        Row: {
          tagID: number
          tagName: string
          tagType: string | null
        }
        Insert: {
          tagID?: number
          tagName: string
          tagType?: string | null
        }
        Update: {
          tagID?: number
          tagName?: string
          tagType?: string | null
        }
        Relationships: []
      }
      user: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          role: string
          updated_at: string
          userName: string
        }
        Insert: {
          created_at: string
          display_name?: string | null
          email: string
          id: string
          role: string
          updated_at: string
          userName: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          role?: string
          updated_at?: string
          userName?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
