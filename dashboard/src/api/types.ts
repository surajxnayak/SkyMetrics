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

export interface MapNode {
  city_code: string;
  city_name: string;
  latitude: number;
  longitude: number;
  airport_codes: string[];
}

export interface MapDirection {
  snapshot_id: string;
  frequency: Frequency;
  period: string;
  base_period: string;
  route_key: string;
  origin_city_code: string;
  destination_city_code: string;
  cpi: number;
  quote_count: number;
  available_count: number;
  no_flight_count: number;
  source_count: number;
  written_at: string;
}

export interface MapEdge {
  edge_key: string;
  city_a: string;
  city_b: string;
  city_a_to_b: MapDirection | null;
  city_b_to_a: MapDirection | null;
}

export interface MapRoutesResponse {
  is_preview: boolean;
  snapshot_id: string | null;
  frequency: Frequency;
  period: string | null;
  edges: MapEdge[];
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

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface AskResponse {
  answer: string;
  tool_calls: ToolCall[];
}
