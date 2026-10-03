// The Guide's own view of their certification, as plain display data. No
// server-only imports here on purpose: the Account page (a client component)
// imports this type, while every rule that produces it stays in
// lib/certification-renewal.ts and is served by
// app/api/guide/certification-status/route.ts. Only the signed-in Guide's
// own certification is ever returned, and it carries no Host, Journey, or
// participant content.

export type GuideCertificationView = {
  lifecycle: string;
  lifecycleLabel: string;
  standing: string;
  isActive: boolean;
  certifiedOn: string;
  periodEndsOn: string | null;
  daysRemaining: number | null;
  ce: { approved: number; pending: number; required: number; met: boolean };
  ethicsText: string;
  paymentText: string;
  paymentStatus: string;
  inactive: { monthsInactive: number; reactivationWindowEndsOn: string; windowOpen: boolean } | null;
  nextSteps: string[];
};
