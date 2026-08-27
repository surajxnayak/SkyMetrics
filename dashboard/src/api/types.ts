export type Frequency = "daily" | "weekly" | "monthly";

export type IndexPoint = {
  period: string;
  base_period: string;
  routes: string[];
  simple_relative: number;
  laspeyres?: number;
  paasche?: number;
  fisher?: number;
};

export interface IndexResponse {
  comparison_id: string;
  frequency: Frequency;
  series: IndexPoint[];
}

export interface FareRecord {
  quote_id?: string;
  origin: string;
  destination: string;
  carrier: string;
  source: string;
  advance_window: string;
  fare_class: string | null;
  total_fare: number | null;
  status: string;
  is_outlier: boolean;
  collected_at: string;
}

export type FareTableRecord = {
  quote_id: string;
  collected_at: string;
  travel_date: string;
  route: string;
  source: string;
  carrier: string;
  advance_window: string;
  fare_class: string | null;
  routing: string | null;
  status: string;
  is_outlier: boolean;
  total_fare: number | null;
  delta_from_mean: number | null;
};

export interface FareRecordsResponse {
  mean_total_fare: number | null;
  records: FareTableRecord[];
}

export interface WeightsMetadata {
  source: string;
  period: string;
  computed_at: string;
  weights: Record<string, number>;
}

export interface SnapshotSummary {
  comparison_id: string;
  frequency: Frequency;
  written_at: string;
}

export interface MetadataResponse {
  weights: WeightsMetadata;
  formulas: Record<string, string>;
  snapshots: SnapshotSummary[];
}
