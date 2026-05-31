// Hand-authored type for the `players` table.
// If you later run `supabase gen types typescript`, replace this with the
// generated `Database` type for full coverage.
//
// Note: these are `type` aliases (not `interface`) so that they're assignable
// to `Record<string, unknown>` — which @supabase/supabase-js's GenericSchema
// constraint requires. Interfaces have no implicit index signature.

export type PlayerRole = "Batsman" | "Bowler" | "All-rounder";
export type PlayerStatus = "Pending" | "Verified" | "Rejected";

export type Player = {
  id: string;
  full_name: string;
  role: PlayerRole;
  phone: string | null;
  city: string;
  profile_picture_url: string | null;
  payment_screenshot_url: string | null;
  utr_number: string | null;
  status: PlayerStatus;
  paid_at: string | null;
  team_id: string | null;
  sold_price: number | null;
  sold_at: string | null;
  is_icon: boolean;
  created_at: string;
  updated_at: string;
};

export type Team = {
  id: string;
  name: string;
  short_name: string | null;
  owner_name: string | null;
  color: string | null;
  logo_url: string | null;
  budget_total: number;
  is_locked: boolean;
  squad_size: number;
  created_at: string;
  updated_at: string;
};

export type TeamInsert = {
  id?: string;
  name: string;
  short_name?: string | null;
  owner_name?: string | null;
  color?: string | null;
  logo_url?: string | null;
  budget_total?: number;
  is_locked?: boolean;
  squad_size?: number;
};

export type TeamUpdate = Partial<TeamInsert>;

export type AuctionStatus = "idle" | "live" | "paused" | "ended";

export type AuctionState = {
  id: "current";
  current_player_id: string | null;
  current_bid: number;
  current_bidder_team_id: string | null;
  base_price: number;
  bid_increment: number;
  default_team_budget: number;
  status: AuctionStatus;
  updated_at: string;
};

export type AuctionStateUpdate = Partial<Omit<AuctionState, "id">>;

export type PlayerInsert = {
  id?: string;
  full_name: string;
  role: PlayerRole;
  phone?: string | null;
  city: string;
  profile_picture_url?: string | null;
  payment_screenshot_url?: string | null;
  utr_number?: string | null;
  status?: PlayerStatus;
  paid_at?: string | null;
  team_id?: string | null;
  sold_price?: number | null;
  sold_at?: string | null;
  is_icon?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PlayerUpdate = Partial<Omit<Player, "id" | "created_at">>;

export type Database = {
  public: {
    Tables: {
      players: {
        Row: Player;
        Insert: PlayerInsert;
        Update: PlayerUpdate;
        Relationships: [];
      };
      teams: {
        Row: Team;
        Insert: TeamInsert;
        Update: TeamUpdate;
        Relationships: [];
      };
      auction_state: {
        Row: AuctionState;
        Insert: AuctionState;
        Update: AuctionStateUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      utr_exists: {
        Args: { p_utr: string };
        Returns: boolean;
      };
      phone_exists: {
        Args: { p_phone: string };
        Returns: boolean;
      };
    };
    Enums: {
      player_role: PlayerRole;
      player_status: PlayerStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
