export type Frequency = "daily" | "weekly" | "monthly";

export interface IndexPoint {
  period: string;
  base_period: string;
  routes: string[];
  simple_relative: number;
  laspeyres?: number;
  paasche?: number;
  fisher?: number;
}

export interface IndexResponse {
  comparison_id: string;
  frequency: Frequency;
  series: IndexPoint[];
}

export interface FareRecord {
  origin: string;
  destination: string;
  carrier: string;
  advance_window: string;
  fare_class: string;
  total_fare: number | null;
  status: string;
  is_outlier: boolean;
  collected_at: string;
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
