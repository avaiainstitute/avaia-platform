// Workbook sharing — shared types. Not server-only: the share/revoke buttons
// (client components) need the ShareScope type too.

export type ShareScope = "conversation" | "workbook" | "referral";

export type SharedAccessGrant = {
  id: string;
  owner_id: string;
  shared_with_id: string;
  scope: ShareScope;
  conversation_id: string | null;
  granted_at: string;
  revoked_at: string | null;
};

/** Display-only — resolved server-side via the admin client since
 *  shared_access only stores the recipient's user id, not their email. */
export type SharedAccessGrantWithEmail = SharedAccessGrant & { shared_with_email: string | null };
