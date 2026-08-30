// Single source of truth for the Meta permissions the connection needs.
// Shared by the OAuth flow and the setup instructions so they can never drift.
export const META_SCOPES = [
  "ads_read",
  "ads_management",
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "business_management",
] as const;

export type MetaScope = (typeof META_SCOPES)[number];
