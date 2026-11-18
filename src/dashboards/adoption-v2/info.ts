// The text behind each card's info icon: what the value tells you and which
// decision it helps with. Definitions stay in "How this is measured".

export const INFO = {
  // Headline
  sourced:
    "The clearest sign wingmaite pays off: people got answers from their own organisation’s knowledge. Rising means the loop works. Flat while active people grow means people ask but the knowledge isn’t there yet: push contributions and knowledge requests rather than more usage.",
  active:
    "How many people did real work in wingmaite last week. Use it to see whether adoption grows or stalls, and to judge a release or campaign against the weeks before. Compare with the 4-week average before reacting to a single week.",
  orgs: "How many customer organisations got value last week, out of all of them. If people are active but organisations aren’t, usage sits in a few accounts: Account health shows which ones need attention.",
  seats:
    "Whether organisations use the seats they have. Low activation means people joined but don’t come back: work on onboarding and reasons to return before adding seats or customers. Seats are approximate.",
  gap: "How often wingmaite answered without the organisation’s own knowledge. High or rising means the knowledge base has gaps: encourage knowledge requests and drafts on the topics people ask about.",
  registrations:
    "How many new people joined, and how. Invites growing means organisations spread wingmaite internally; self-registrations reflect marketing and sales reach.",
  doing:
    "What last week’s active people used wingmaite for. If most only chat while few list or upload, the knowledge rests on a few people: aim onboarding and champion campaigns at contributing, not just asking. Drafts only help others once listed.",
  activeChart:
    "The trend behind the active-people tile. The 4-week average separates a real change from a busy or quiet week, and the markers show whether a release or email moved it.",
  sourcedChart:
    "Chat messages against those answered from the organisation’s own knowledge. A widening gap between the lines means people ask about more than the knowledge covers.",

  // Account health
  accounts:
    "Which customers need attention now. Red accounts haven’t used wingmaite for two weeks or barely use their seats: reach out before they churn. Amber ones are slipping; green ones are candidates for case studies and expansion.",

  // Activation
  invites:
    "Whether invited colleagues actually join. Low acceptance points at the invite itself (the email, its timing, who sends it) rather than the product.",
  followed:
    "How many people the funnel is based on. With only a handful, read the funnel as a direction, not a rate.",
  funnel:
    "Where new people drop off on the way to value. Fix the biggest drop first: no first action points at onboarding, no sourced answer at missing knowledge in their organisation, no return at a missing reason to come back.",
  steps:
    "The funnel’s conversion between steps and how long each step takes, for invited and self-registered people apart, to see whether one path onboards better than the other.",

  // Retention
  week1:
    "Whether new people come back after their first week: the earliest signal of retention. Improve it with onboarding and follow-ups in the first days.",
  week4:
    "Whether new people still use wingmaite a month in, a sign it has become a habit. Compare it over time to see whether product changes keep more people.",
  cohorts:
    "How each week’s new people kept using wingmaite. If newer rows hold better than older ones, recent changes to onboarding or the product are working.",
  composition:
    "Whether growth comes from new people or from people coming back. Growth from new people alone, with many dropping off, means acquisition is hiding a retention problem.",

  // Knowledge loop
  supply:
    "Whether knowledge goes in where answers can use it: fragments listed (new or edited) and files uploaded to company knowledge. Drafts don’t count until they are listed. If it falls, answers will cite less over time: encourage contributors or run a champions campaign.",
  demand:
    "Whether people bring their questions to wingmaite. Demand without supply means the knowledge can’t keep up; supply without demand means people don’t rely on it yet.",
  quality:
    "The share of chat messages answered with the organisation’s own knowledge. Rising means the knowledge covers what people ask; falling means new topics aren’t documented yet.",
  requests:
    "Whether gaps get filled through knowledge requests. Many sent with few answered or resolved means requests reach the wrong people or aren’t followed up; answered but not resolved means answers don’t satisfy the requester yet.",
  listedCited:
    "How much of the knowledge answers can cite (listed fragments and uploaded files) is actually used. A low share means much of it isn’t cited: check whether it’s outdated or hard to find before asking for more.",
  authors:
    "Of everyone who contributed knowledge answers can cite (listed fragments or uploaded files), how many see it help others. A low share means answers rest on a few people’s knowledge: find out why the rest isn’t cited, outdated, too narrow or hard to find, before asking for more.",
} as const;
