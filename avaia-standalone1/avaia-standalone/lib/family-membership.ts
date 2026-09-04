import "server-only";
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe, familyExtraSeatPriceId, FAMILY_INCLUDED_SEATS, type MembershipPlan } from "@/lib/stripe";

// AVAIA Family Membership. Governing rule: "Family Membership is shared
// payment/access -- not shared ownership of stories." Payment gives
// access, not authority. This module owns every mutation to
// family_memberships/family_members -- both tables have no client write
// policy (see migration 0054's own header), matching the
// organization-admin precedent exactly: every function here re-verifies
// the caller's identity itself rather than trusting a route param, and
// `admin` must always be the service-role client (lib/supabase/admin.ts),
// never the caller's own RLS-scoped client, since writes here cross a
// person's own row (granting/revoking someone ELSE's entitlement).
//
// What this module deliberately never does: grant any read access to
// conversations, messages, referrals, journeys, recognitions, or
// virtue_signature_entries. Every function below only ever touches
// family_memberships, family_members, and entitlements (access/billing
// rows, not story content). A Family purchaser who wants to read a
// member's private material has to go find a completely different,
// unrelated access path -- none exists, by design.

export type FamilyMembershipRow = {
  id: string;
  owner_host_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  base_subscription_item_id: string | null;
  extra_seat_subscription_item_id: string | null;
  extra_seat_quantity: number;
  plan: MembershipPlan;
  status: "active" | "canceled";
  created_at: string;
  updated_at: string;
};

export type FamilyMemberRow = {
  id: string;
  family_membership_id: string;
  host_id: string | null;
  invited_email: string;
  is_owner: boolean;
  is_extra_seat: boolean;
  status: "invited" | "active" | "removed";
  invite_token: string | null;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  removed_at: string | null;
  removed_by: string | null;
};

function generateInviteToken(): string {
  return randomBytes(24).toString("hex");
}

/** The caller's own Family plan, if they own one -- self-read RLS is
 *  sufficient, `supabase` should be the caller's own RLS-scoped client. */
export async function getFamilyMembershipForOwner(
  supabase: SupabaseClient,
  ownerId: string
): Promise<FamilyMembershipRow | null> {
  const { data } = await supabase
    .from("family_memberships")
    .select("*")
    .eq("owner_host_id", ownerId)
    .eq("status", "active")
    .maybeSingle();
  return (data as FamilyMembershipRow) ?? null;
}

/** The caller's own seat, if they're an active member of ANY Family plan
 *  (their own, or one someone else owns) -- self-read RLS is sufficient.
 *  Does not reveal who else is on the plan; only this Host's own row. */
export async function getMyFamilyMembership(
  supabase: SupabaseClient,
  hostId: string
): Promise<FamilyMemberRow | null> {
  const { data } = await supabase
    .from("family_members")
    .select("*")
    .eq("host_id", hostId)
    .eq("status", "active")
    .maybeSingle();
  return (data as FamilyMemberRow) ?? null;
}

/** Full roster for an owner's plan -- re-verifies ownership itself rather
 *  than trusting familyMembershipId came from an authorized page. Reads
 *  through the caller's own RLS-scoped client; the "owner read" policy on
 *  family_members already scopes this correctly. */
export async function listFamilyRoster(
  supabase: SupabaseClient,
  ownerId: string,
  familyMembershipId: string
): Promise<FamilyMemberRow[]> {
  const membership = await getFamilyMembershipForOwner(supabase, ownerId);
  if (!membership || membership.id !== familyMembershipId) return [];
  const { data } = await supabase
    .from("family_members")
    .select("*")
    .eq("family_membership_id", familyMembershipId)
    .neq("status", "removed")
    .order("invited_at", { ascending: true });
  return (data as FamilyMemberRow[]) ?? [];
}

/** Grants an active 'family'-sourced entitlement to a host, attributed to
 *  this specific plan. Idempotent -- a host who already holds ANY active
 *  entitlement (Individual, or family from this same plan) is left alone;
 *  this never creates a second active row for the same host, matching
 *  grantEntitlement()'s own posture in the Stripe webhook. `admin` must be
 *  the service-role client. */
async function grantFamilyEntitlement(
  admin: SupabaseClient,
  hostId: string,
  familyMembershipId: string
): Promise<void> {
  const { data: existing } = await admin
    .from("entitlements")
    .select("id")
    .eq("host_id", hostId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return;
  await admin.from("entitlements").insert({
    host_id: hostId,
    status: "active",
    source: "family",
    family_membership_id: familyMembershipId,
  });
}

/** Revokes ONLY this host's family-sourced entitlement from this specific
 *  plan -- never touches an Individual entitlement they might separately
 *  hold, and never another member's row. This is the exact boundary that
 *  keeps "remove a family member" from ever being able to reach into
 *  someone else's unrelated access. */
async function revokeFamilyEntitlement(
  admin: SupabaseClient,
  hostId: string,
  familyMembershipId: string
): Promise<void> {
  await admin
    .from("entitlements")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("host_id", hostId)
    .eq("family_membership_id", familyMembershipId)
    .eq("source", "family")
    .eq("status", "active");
}

/** Creates the Family plan itself plus the owner's own auto-active seat,
 *  and grants the owner their entitlement. Called once, from the Stripe
 *  webhook's checkout.session.completed handler, when the purchased price
 *  was a Family price. `admin` must be the service-role client. Idempotent
 *  against webhook redelivery via the same unique-active-owner index the
 *  migration created -- a second call for an owner who already has an
 *  active plan is a no-op. */
export async function createFamilyMembership(
  admin: SupabaseClient,
  ownerId: string,
  ownerEmail: string | null,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  baseSubscriptionItemId: string,
  plan: MembershipPlan
): Promise<FamilyMembershipRow | null> {
  const { data: existing } = await admin
    .from("family_memberships")
    .select("*")
    .eq("owner_host_id", ownerId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return existing as FamilyMembershipRow;

  const { data: created, error } = await admin
    .from("family_memberships")
    .insert({
      owner_host_id: ownerId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      base_subscription_item_id: baseSubscriptionItemId,
      plan,
    })
    .select("*")
    .single();
  if (error || !created) {
    console.error("AVAIA Family Membership: failed to create plan:", error);
    return null;
  }

  await admin.from("family_members").insert({
    family_membership_id: created.id,
    host_id: ownerId,
    invited_email: ownerEmail ?? "",
    is_owner: true,
    is_extra_seat: false,
    status: "active",
    accepted_at: new Date().toISOString(),
  });
  await grantFamilyEntitlement(admin, ownerId, created.id);
  return created as FamilyMembershipRow;
}

export type InviteResult = { error: string | null; inviteToken: string | null; memberId: string | null };

/** Invites a family member by email. Re-verifies the caller actually owns
 *  an active Family plan (never trusts a route param), and computes seat
 *  billing itself from how many seats are currently occupied
 *  (active + invited) -- the 6th and further concurrently-occupied seat
 *  bills as an extra seat; a freed seat (a prior member removed) is
 *  filled as a base seat again, not billed twice. `supabase` is the
 *  caller's own RLS-scoped client (sufficient for the ownership check);
 *  `admin` must be the service-role client for the actual writes and any
 *  Stripe subscription-item change. */
export async function inviteFamilyMember(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  ownerId: string,
  email: string
): Promise<InviteResult> {
  const membership = await getFamilyMembershipForOwner(supabase, ownerId);
  if (!membership) return { error: "You don't have an active Family Membership.", inviteToken: null, memberId: null };

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { error: "Enter a valid email address.", inviteToken: null, memberId: null };
  }

  const { data: occupied } = await admin
    .from("family_members")
    .select("id, invited_email")
    .eq("family_membership_id", membership.id)
    .in("status", ["invited", "active"]);

  if ((occupied ?? []).some((m) => m.invited_email.toLowerCase() === normalizedEmail)) {
    return { error: "This person is already invited or already a member.", inviteToken: null, memberId: null };
  }

  const occupiedCount = occupied?.length ?? 0;
  const isExtraSeat = occupiedCount >= FAMILY_INCLUDED_SEATS;

  if (isExtraSeat) {
    const stripeResult = await addExtraSeatBilling(admin, membership);
    if (!stripeResult.ok) {
      return { error: stripeResult.error, inviteToken: null, memberId: null };
    }
  }

  const inviteToken = generateInviteToken();
  const { data: created, error } = await admin
    .from("family_members")
    .insert({
      family_membership_id: membership.id,
      invited_email: normalizedEmail,
      is_owner: false,
      is_extra_seat: isExtraSeat,
      status: "invited",
      invite_token: inviteToken,
      invited_by: ownerId,
    })
    .select("id")
    .single();

  if (error || !created) {
    // Roll back the seat we just billed, if any -- don't leave someone
    // billed for a seat with no corresponding invite.
    if (isExtraSeat) await removeExtraSeatBilling(admin, membership);
    console.error("AVAIA Family Membership: failed to create invite:", error);
    return { error: "Could not create the invite. Please try again.", inviteToken: null, memberId: null };
  }

  return { error: null, inviteToken, memberId: created.id };
}

async function addExtraSeatBilling(
  admin: SupabaseClient,
  membership: FamilyMembershipRow
): Promise<{ ok: boolean; error: string | null }> {
  if (!membership.stripe_subscription_id) return { ok: false, error: "This plan has no active subscription." };
  const priceId = familyExtraSeatPriceId(membership.plan);
  if (!priceId) return { ok: false, error: "Additional-member billing isn't configured yet." };

  try {
    if (membership.extra_seat_subscription_item_id) {
      const newQty = membership.extra_seat_quantity + 1;
      await stripe().subscriptionItems.update(membership.extra_seat_subscription_item_id, { quantity: newQty });
      await admin
        .from("family_memberships")
        .update({ extra_seat_quantity: newQty, updated_at: new Date().toISOString() })
        .eq("id", membership.id);
    } else {
      const item = await stripe().subscriptionItems.create({
        subscription: membership.stripe_subscription_id,
        price: priceId,
        quantity: 1,
      });
      await admin
        .from("family_memberships")
        .update({
          extra_seat_subscription_item_id: item.id,
          extra_seat_quantity: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", membership.id);
    }
    return { ok: true, error: null };
  } catch (e) {
    console.error("AVAIA Family Membership: failed to add extra-seat billing:", e);
    return { ok: false, error: "Could not update billing for an additional member. Please try again." };
  }
}

async function removeExtraSeatBilling(admin: SupabaseClient, membership: FamilyMembershipRow): Promise<void> {
  if (!membership.extra_seat_subscription_item_id || membership.extra_seat_quantity <= 0) return;
  try {
    const newQty = membership.extra_seat_quantity - 1;
    if (newQty <= 0) {
      await stripe().subscriptionItems.del(membership.extra_seat_subscription_item_id);
      await admin
        .from("family_memberships")
        .update({
          extra_seat_subscription_item_id: null,
          extra_seat_quantity: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", membership.id);
    } else {
      await stripe().subscriptionItems.update(membership.extra_seat_subscription_item_id, { quantity: newQty });
      await admin
        .from("family_memberships")
        .update({ extra_seat_quantity: newQty, updated_at: new Date().toISOString() })
        .eq("id", membership.id);
    }
  } catch (e) {
    console.error("AVAIA Family Membership: failed to reduce extra-seat billing:", e);
  }
}

export type AcceptResult = { error: string | null };

/** Accepts a pending invite -- the ONLY way a family_members row moves
 *  from 'invited' to 'active' and the only place a Family entitlement is
 *  granted to anyone other than the owner. Requires the accepting host's
 *  OWN identity and independently confirms their signed-in email matches
 *  the invited address (case-insensitive) -- an invite link cannot be
 *  used by anyone other than the person it was actually sent to, even if
 *  the token itself leaks. `admin` must be the service-role client
 *  (this legitimately crosses from the invite's owner-created row into
 *  granting the ACCEPTING host's own entitlement). */
export async function acceptFamilyInvite(
  admin: SupabaseClient,
  inviteToken: string,
  acceptingHostId: string,
  acceptingHostEmail: string | null
): Promise<AcceptResult> {
  const { data: invite } = await admin
    .from("family_members")
    .select("id, family_membership_id, invited_email, status")
    .eq("invite_token", inviteToken)
    .maybeSingle();

  if (!invite) return { error: "This invite link isn't valid." };
  if (invite.status !== "invited") return { error: "This invite has already been used or is no longer active." };
  if (!acceptingHostEmail || acceptingHostEmail.toLowerCase() !== invite.invited_email.toLowerCase()) {
    return { error: `This invite was sent to ${invite.invited_email}. Sign in with that email to accept it.` };
  }

  const { data: alreadyOnPlan } = await admin
    .from("family_members")
    .select("id")
    .eq("family_membership_id", invite.family_membership_id)
    .eq("host_id", acceptingHostId)
    .eq("status", "active")
    .maybeSingle();
  if (alreadyOnPlan) return { error: "You're already a member of this Family plan." };

  const { error: updateError } = await admin
    .from("family_members")
    .update({ host_id: acceptingHostId, status: "active", accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .eq("status", "invited");
  if (updateError) {
    console.error("AVAIA Family Membership: failed to accept invite:", updateError);
    return { error: "Could not accept this invite. Please try again." };
  }

  await grantFamilyEntitlement(admin, acceptingHostId, invite.family_membership_id);
  return { error: null };
}

export type RemoveResult = { error: string | null };

/** Removes a member from the roster -- callable by the plan's owner
 *  (removing someone else) or the member themselves (leaving). Re-verifies
 *  the caller's authority itself: either `callerId === ownerHostId of the
 *  plan` or `callerId === the member's own host_id`. Revokes only this
 *  member's family-sourced entitlement from THIS plan, releases the seat,
 *  and decrements extra-seat billing if this was a billed extra seat.
 *  The owner's own seat cannot be removed this way -- ending the plan
 *  itself is a separate, Stripe-subscription-level action (cancellation),
 *  not a roster removal. */
export async function removeFamilyMember(
  admin: SupabaseClient,
  callerId: string,
  memberId: string
): Promise<RemoveResult> {
  const { data: member } = await admin
    .from("family_members")
    .select("id, family_membership_id, host_id, is_owner, is_extra_seat, status")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.status !== "active") return { error: "This member is not currently active." };
  if (member.is_owner) return { error: "The plan owner's seat can't be removed this way." };

  const { data: membership } = await admin
    .from("family_memberships")
    .select("*")
    .eq("id", member.family_membership_id)
    .maybeSingle();
  if (!membership) return { error: "Family plan not found." };

  const isOwnerCaller = membership.owner_host_id === callerId;
  const isSelfCaller = member.host_id === callerId;
  if (!isOwnerCaller && !isSelfCaller) {
    return { error: "You're not authorized to remove this member." };
  }

  await admin
    .from("family_members")
    .update({ status: "removed", removed_at: new Date().toISOString(), removed_by: callerId })
    .eq("id", memberId);

  if (member.host_id) {
    await revokeFamilyEntitlement(admin, member.host_id, member.family_membership_id);
  }
  if (member.is_extra_seat) {
    await removeExtraSeatBilling(admin, membership as FamilyMembershipRow);
  }

  return { error: null };
}

/** Marks a plan canceled and revokes every active member's family-sourced
 *  entitlement (including the owner's own). Called from the Stripe
 *  webhook when the Family subscription itself ends -- mirrors
 *  revokeEntitlement()'s posture for Individual membership, extended to
 *  every seat on the plan rather than one host. Does not touch Stripe
 *  itself (the subscription is already ending/ended by the time this
 *  runs) and does not touch any story-content table. */
export async function cancelFamilyMembership(admin: SupabaseClient, stripeSubscriptionId: string): Promise<void> {
  const { data: membership } = await admin
    .from("family_memberships")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return;

  const { data: members } = await admin
    .from("family_members")
    .select("host_id")
    .eq("family_membership_id", membership.id)
    .eq("status", "active");

  await admin
    .from("family_memberships")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", membership.id);

  for (const m of members ?? []) {
    if (m.host_id) await revokeFamilyEntitlement(admin, m.host_id, membership.id);
  }
}
