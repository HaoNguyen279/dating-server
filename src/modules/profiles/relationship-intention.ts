export const RELATIONSHIP_INTENTIONS = [
  "Người yêu",
  "Bạn hẹn hò lâu dài",
  "Bất kì",
  "Bạn mới",
  "Chưa rõ",
] as const;

export type RelationshipIntention = (typeof RELATIONSHIP_INTENTIONS)[number];
