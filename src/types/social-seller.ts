export interface SocialSellerWeek {
  id: string;
  week_start: string;  // YYYY-MM-DD
  week_end: string;    // YYYY-MM-DD
  seguidores_conectados: number;
  total_ctas: number;
  total_agendamentos: number;
  created_at: string;
  updated_at: string;
}

export interface CachedWeekSelection {
  week_id: string;
}
