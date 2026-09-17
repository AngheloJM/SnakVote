export type Satisfaction =
  | "muy_satisfecho"
  | "satisfecho"
  | "regular"
  | "poco_satisfecho"
  | "insatisfecho";

export interface Vote {
  id: string;
  kiosk_id: string;
  satisfaction: Satisfaction;
  attention_or_food: string | null;
  photo_key: string | null;
  reason: string | null;
  created_at: string;
  synced_at: string | null;
}
