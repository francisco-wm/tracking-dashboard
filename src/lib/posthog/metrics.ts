// The canonical HogQL condition for every metric, shared by all dashboards.
// Add a metric here instead of writing a variant inside a dashboard.

export const METRIC_SQL = {
  question: `event = 'chat_message_sent' AND properties.chat_type = 'chat'`,
  contribution: `event = 'knowledge_shared'`,
  newListing: `event = 'kp_status_changed' AND properties.from_status = 'draft' AND properties.to_status = 'published'`,
  relist: `event = 'knowledge_piece_republished'`,
  editStarted: `event = 'knowledge_piece_edit_started'`,
  click: `event = 'reach_email_cta_clicked' AND properties.source = 'reach_email'`,
  active: `event = '$pageview'`,
} as const;

export type MetricKey = keyof typeof METRIC_SQL;

/** The fragment (knowledge piece) an edit, re-list or status change belongs to. */
export const FRAGMENT_ID = `properties.knowledge_piece_uuid`;
