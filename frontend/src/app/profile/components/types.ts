export type CandidateDraft = {
  index: number;
  session_id: number;
  section_type: string;
  title: string;
  content_json: Record<string, any>;
  confidence: number;
  titleDraft: string;
  bulletDraft: string;
  confirmed: boolean;
};
