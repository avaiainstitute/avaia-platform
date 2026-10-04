# Implementation backlog

Things the product needs that depend on something not yet designed. Nothing here is
built, and nothing here is designed yet. Each entry names only the dependency, so a
future owner decision can start from it. Recorded 2026-10-04.

## Organization / Event Operations: the Event portion

The Organization half of this capability is operational (administrator and connected-Guide
readiness, through What Needs Dorian). The Event half depends on an underlying event
feature that has not yet been designed: there is no event, registration, roster or attendance
record anywhere in the product. When that feature exists, event monitoring extends the
existing capability (lib/organization-operations.ts, lib/ops/organization-operations.ts); it
does not need a new one. The planned public Workshops/Events pathway is the likely source of
those records; see the architecture note in the project memory (`avaia-workshops-events-architecture`).

## Guide / Participant Operations: participant invitation and session-link delivery

Host/Participant Operations is operational for what exists: journey state, Guide-facilitated
participant state, and Host-scoped Guide access. Delivering an invitation or a session link to
a participant depends on participant-facing functionality that has not yet been designed (how
a participant who is not an AVAIA account holder signs in, or is otherwise recognized, to use
such a link). The original build left this out for the same reason. When that participant-facing
functionality exists, delivery extends lib/host-operations.ts and
lib/ops/host-participant-operations.ts.
