// The canonical HogQL condition for every metric, shared by all dashboards.
// Add a metric here instead of writing a variant inside a dashboard.

export const METRIC_SQL = {
  /** A message in a regular chat, not a knowledge-creation chat. */
  chatMessage: `event = 'chat_message_sent' AND properties.chat_type = 'chat'`,
  contribution: `event = 'knowledge_shared'`,
  newListing: `event = 'kp_status_changed' AND properties.from_status = 'draft' AND properties.to_status = 'published'`,
  relist: `event = 'knowledge_piece_republished'`,
  editStarted: `event = 'knowledge_piece_edit_started'`,
  click: `event = 'reach_email_cta_clicked' AND properties.source = 'reach_email'`,
  active: `event = '$pageview'`,
  /**
   * A page view inside an organisation's app: someone signed in and using the
   * product. Paths are /o/<slug>/… since July 2026 and /dashboard/<slug>/…
   * before. Sign-in, sign-up and setup pages don't count: most of their
   * visitors never sign in.
   */
  appActive: `event = '$pageview' AND match(properties.$pathname, '^/(o|dashboard)/[^/]+') AND NOT match(properties.$pathname, '^/o/[^/]+/setup')`,
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
  /** The AI found missing knowledge in a chat and drafted a request; nobody is assigned yet. */
  gapDetected: `event = 'knowledge_gap_detected'`,
  /** The request's first assignment: the moment it is sent. Not when the draft was created. */
  requestSent: `event = 'knowledge_request_created'`,
  /** The first time any assignee opened it; at most once per request. */
  requestOpened: `event = 'knowledge_request_opened'`,
  /** Still unopened 7 days after it was sent. */
  requestIgnored: `event = 'knowledge_request_ignored'`,
  requestRejected: `event = 'knowledge_request_rejected'`,
  /** Resolved or cancelled by the requester (`properties.outcome`). */
  requestClosed: `event = 'knowledge_request_closed'`,
  suggestionCreated: `event = 'system_contribution_created'`,
  suggestionApproved: `event = 'system_contribution_approved'`,
  suggestionRejected: `event = 'system_contribution_rejected'`,
  /**
   * Something only a signed-in person doing real work does: a chat message, a
   * new fragment (a written draft or a file uploaded to company knowledge), an
   * edit, a listing (new or re-listed), a file attached in a chat, a knowledge
   * request sent or answered (either backend). Logins and page views don't count.
   */
  coreAction: `((event = 'chat_message_sent' AND properties.chat_type = 'chat') OR (event = 'kp_status_changed' AND properties.from_status = 'draft' AND properties.to_status = 'published') OR event IN ('knowledge_piece_created', 'knowledge_piece_edit_started', 'knowledge_piece_republished', 'attached_source', 'knowledge_request_created', 'knowledge_request_answered', 'knowledge_request_completed'))`,
  /** A file or Notion page attached in a chat, for that chat only. */
  fileAttached: `event = 'attached_source'`,
  /**
   * A file (videos too) uploaded to company knowledge, outside a chat: it
   * becomes a fragment of type "file". Tracked since February 2026.
   */
  fileUploaded: `(event = 'knowledge_piece_created' AND ifNull(properties.knowledge_piece_type = 'file', 0))`,
  /** A fragment cited in a chat answer, once per fragment per answer; `retrieved` ones were fetched but not cited. */
  cited: `event = 'knowledge_fragment_used_in_response' AND properties.usage = 'cited'`,
  /** A new account; the person is the new user. */
  registered: `event = 'user_created'`,
  inviteSent: `event = 'invitation_created'`,
  /** The invited person accepted; joined to the invite by `properties.invitation_uuid`. */
  inviteAccepted: `event = 'invitation_accepted'`,
  /** Fires on the person who left or was removed, with the organisation. */
  leftOrg: `event = 'left_organization'`,
  /** A thumbs up or down on a chat answer: `properties.rating` is 1 or -1. */
  answerRated: `event = 'chat_response_rated'`,
} as const;

export type MetricKey = keyof typeof METRIC_SQL;

/** The knowledge request a lifecycle event belongs to. */
export const REQUEST_ID = `properties.knowledge_request_uuid`;

/** The same request id on system_contribution_* events, which name it differently. */
export const SUGGESTION_REQUEST_ID = `properties.knowledge_request_id`;

/** The fragment (knowledge piece) an edit, re-list or status change belongs to. */
export const FRAGMENT_ID = `properties.knowledge_piece_uuid`;

/** The organisation an `appActive` page view belongs to: its slug in the path. */
export const ORG_SLUG = `extract(properties.$pathname, '^/(?:o|dashboard)/([^/]+)')`;

/** The organisation on every custom event (not on page views). Customers' names are in `properties.organization_name`. */
export const ORG_ID = `toString(properties.organization_uuid)`;

/** Which home widget a widget event came from. */
export const WIDGET_ID = `properties.widget_id`;
