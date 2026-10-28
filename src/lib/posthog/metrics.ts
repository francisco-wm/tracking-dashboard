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
  /** A view of an organisation's home page, /o/<slug>, where the home widgets live. */
  homeView: `event = '$pageview' AND match(properties.$pathname, '^/o/[^/]+/?$')`,
  widgetClick: `event = 'dashboard_widget_clicked'`,
  widgetFetchFailed: `event = 'dashboard_widget_fetch_failed'`,
  widgetRetry: `event = 'dashboard_widget_retry_clicked'`,
  draftCreated: `event = 'knowledge_piece_created'`,
  /**
   * Any message in a knowledge-creation chat. Unlike `contribution`, it also
   * counts a chat's first message, which often has no knowledge_shared.
   */
  draftMessage: `event = 'chat_message_sent' AND properties.chat_type = 'knowledge_creation'`,
  requestCompleted: `event = 'knowledge_request_completed'`,
  requestAnswered: `event = 'knowledge_request_answered'`,
} as const;

export type MetricKey = keyof typeof METRIC_SQL;

/** The fragment (knowledge piece) an edit, re-list or status change belongs to. */
export const FRAGMENT_ID = `properties.knowledge_piece_uuid`;

/** Which home widget a widget event came from. */
export const WIDGET_ID = `properties.widget_id`;
