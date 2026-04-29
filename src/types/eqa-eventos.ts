export interface EqaEventosProject {
  id: string;
  name: string;
  lead_events: string[];
  campaign_terms: string[];
  campaign_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface EqaEventosMetrics {
  total_leads: number;
  total_spend: number;
  cpl: number | null;
}

export interface CampaignOption {
  campaign_id: string;
  campaign_name: string;
}
