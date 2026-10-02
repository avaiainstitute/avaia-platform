# Decision 0002 — Certification payment + application

**Status:** Recorded, governing. Not yet implemented. Governs the
Certification front-door work (payment, application, admission) identified
as missing in the AVAIA Certification Launch-Readiness Audit, when that
work is separately approved and begun.

## The decision

The $1,495 Standard AVAIA Certification payment does **not** automatically
make someone an AVAIA Certification Candidate. It does not automatically
grant: Candidate status, certification-course access, Guide status,
certification standing, or Guide permissions.

The governing front-door sequence is:

```
PAYMENT + APPLICATION
  → CONSIDERATION / REVIEW
  → HUMAN ADMISSION DECISION
  → IF ACCEPTED: CANDIDATE STATUS
  → CERTIFICATION PROCESS BEGINS
```

The $1,495 payment is consideration submitted *together with* the
application, to begin the certification application/review process.
Payment must not trigger automatic admission — there must be a human
admission decision between payment/application and Candidate status.

## Binding rules for any future implementation

When implementing the Certification front door, do **not** create a
Stripe webhook or other automation that automatically converts a paying
person into an admitted `guide_candidates` candidate with certification
access. The system must instead:

1. Receive payment.
2. Receive the application.
3. Associate the payment and application correctly.
4. Create/route the application for consideration.
5. Make the pending state visible operationally.
6. Surface it for appropriate human review.
7. Record the human admission decision.
8. Only after acceptance, create/activate the appropriate Candidate state
   and certification access.

If an applicant is not accepted, do **not** invent refund, denial,
appeal, reapplication, or other financial/application policy. Surface any
such unresolved requirement as `POLICY_REQUIRED` rather than deciding it.
Do not infer policy merely from existing Stripe or membership behavior
elsewhere in the platform.

## Architectural principle shared with Decision 0001

Automation can carry the *operation*. It must not replace human agency or
human judgment.

- For Status: the person determines and communicates their own capacity.
- For Certification: the human reviewer determines admission.
