# Foundation data inventory (2026-10-05)

Counted in production before any change. **Nothing was deleted, moved or rewritten.** The audit trail is
`research-output-archive-2026-10-05.json` in this folder (every AI-found research row, as it was).

| Table | Rows | Class | Decision |
|---|---|---|---|
| `pink_contact_submissions` | 0 | Foundation data (schema) | Never received a real submission. Schema moves at extraction. |
| `pink_participation_interest` | 0 | Foundation data (schema) | Same. |
| `pink_partnerships` | 0 | Foundation data (schema) | Same. |
| `pink_donor_sponsor_records` | 0 | Foundation data (schema) | Same. |
| `pink_partnership_prospects` | 15 | **AI-generated research, unverified.** Tagged `both` 12, `pink` 2, `avaia` 1 | Frozen in place. Shown in the Foundation's admin only (the 14 tagged `pink`/`both`). **Not** migrated. The 1 row tagged `avaia` is AVAIA business development stored in a Foundation table; AVAIA has no approved table for partnership prospects, so it is preserved and **a destination is the owner's decision**. |
| `pink_donor_prospects` | 4 | AI-generated research, unverified, aimed at the Foundation's mission | Frozen in place. Whether to carry it into the Foundation's new database is the owner's decision (recommend: start empty, keep the archive). |
| `pink_legacy_review_items`, `pink_sponsored_access_requests`, `pink_campaign_items`, `pink_commercial_co_ventures`, `pink_volunteers`, `pink_foundation_reminders` | 0 each | Provenance unknown (built 2026-10-02 from a build instruction; no production code uses them) | Schema preserved. Not designed into anything. |
| `avaia_speaking_opportunities` (AVAIA's table) | 5 | AI-generated research. 4 tagged `both` (the old prompt also searched for the Foundation), 1 `avaia` | Stays in AVAIA's table, where AVAIA's own research belongs. No further rows can be tagged for the Foundation. |
| `founder_notes`, `avaia_content_items` (AVAIA's tables) | 0 Foundation rows | The Foundation's notes and content plans are stored in AVAIA-named tables | Empty. Ends at extraction. |

Test data: none found. No Foundation submission has ever been recorded (table statistics show zero lifetime inserts
on the intake tables).
