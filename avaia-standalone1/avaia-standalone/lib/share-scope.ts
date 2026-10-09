// Which conversation a Workbook share or invite is tied to. The database requires a conversation id for the
// 'conversation' and 'referral' scopes and forbids one for 'workbook' (the shape constraints on shared_access and
// shared_access_invites). A share to someone with an account and an invite to someone without one must use this
// same rule, so the two can never disagree. Pure; used by POST /api/share.

export function shareConversationId(scope: string, conversationId: string | undefined): string | null {
  return scope === "conversation" || scope === "referral" ? (conversationId ?? null) : null;
}
