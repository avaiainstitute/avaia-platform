// Periodic-table layout for the Chemistry of Virtue, grid positions
// reconstructed from Dorian's official artwork so the web page mirrors it:
//   - a top-left Wisdom "tower"
//   - the title's empty space top-center (the classic periodic gap)
//   - a contiguous cluster top-right (Self-Control / Love / Attitude extras)
//   - the main body, families as color regions left→right
//   - a two-row breakout strip at the bottom (Humility · Gratitude · Integrity
//     · Hard Work), like the lanthanide/actinide strip.
//
// Keyed by virtue NAME (symbols repeat across families). [row, col], 1-indexed.

export const GRID_COLS = 20;
// Rows 1-7 are the main structure. Rows 9-10 (STRIP_FIRST_ROW onward) are the
// separate Humility/Gratitude/Integrity/Hard Work strip, rendered as its own
// 17-column grid stretched to the same right edge as the main body's
// BODY_COLS (18) columns, with a gap above it, matching Dorian's original
// artwork (wider strip cells, same right edge as the body).
export const MAIN_ROW_TEMPLATE = "repeat(7, auto)";
export const STRIP_FIRST_ROW = 9;
export const STRIP_COLS = 17;
export const BODY_COLS = 18;
export const STRIP_GAP_PX = 14;

export const VIRTUE_POS: Record<string, [number, number]> = {
  // Wisdom, top-left tower + main region (cols 1-5)
  Percipience: [1, 1],
  Judgment: [2, 1], Light: [2, 2],
  Balance: [3, 1], Originality: [3, 2],
  Reason: [4, 1], Knowledge: [4, 2], Imagination: [4, 3], "Critical thinking": [4, 4], Spirituality: [4, 5],
  Logic: [5, 1], Understanding: [5, 2], Prudence: [5, 3], Intuition: [5, 4], Wonder: [5, 5],
  Discernment: [6, 1], Creativity: [6, 2], Objectivity: [6, 3], Capacity: [6, 4],
  Vision: [7, 1], Simplicity: [7, 2], Change: [7, 3], Priority: [7, 4],

  // Justice, packed immediately after Wisdom, no reserved dead columns.
  Fairness: [4, 6], Honesty: [4, 7], Courtesy: [4, 8], Impartial: [4, 9],
  Respect: [5, 6], Tolerance: [5, 7], Benignity: [5, 8],
  Dignity: [6, 5], Acceptance: [6, 6], Grace: [6, 7], Truth: [6, 8],
  Civility: [7, 5], Chivalry: [7, 6], Honor: [7, 7], Equality: [7, 8],

  // Fortitude, packed immediately after Justice.
  Courage: [4, 10], Magnanimity: [4, 11],
  Steadfast: [5, 9], Resilience: [5, 10], Assertive: [5, 11],
  Confidence: [6, 9], Fearlessness: [6, 10], Independent: [6, 11],
  Bravery: [7, 9], Valor: [7, 10],

  // Self-Control, main rows (+ extras in the top-right cluster). Packed
  // immediately after Fortitude, not a fixed column pair, since Fortitude's
  // own width varies 2-3 across these rows.
  Mindfulness: [4, 12], Patience: [4, 13],
  Mercy: [5, 12], "Long-suffering": [5, 13],
  Awareness: [6, 12], Fidelity: [6, 13],
  Temperance: [7, 11], Moderation: [7, 12],

  // Love, main rows (+ extras in the top-right cluster). Packed immediately
  // after Self-Control.
  Kindness: [4, 14], Adoration: [4, 15], Forgiveness: [4, 16],
  Sacrifice: [5, 14], Nurturing: [5, 15], Compassion: [5, 16],
  Benevolence: [6, 14], Generosity: [6, 15], Hospitality: [6, 16],
  Admiration: [7, 13], Helpfulness: [7, 14], Loyalty: [7, 15], Yearning: [7, 16],

  // Positive Attitude, main rows (+ extras in the top-right cluster). Packed
  // immediately after Love, so every row 4-7 ends flush with no trailing gap
  // (see this file's own comment above on why: dense per-row packing in
  // family order, not a fixed column reserved for every family in every
  // row, removes the interior "holes" a fixed reservation scheme leaves
  // wherever a family has fewer elements in one row than its widest row).
  Beauty: [4, 17], Serenity: [4, 18],
  Adaptability: [5, 17], Humor: [5, 18],
  Optimism: [6, 17], Flexibility: [6, 18],
  Hope: [7, 17], Zeal: [7, 18],

  // Top-right cluster (rows 2-3, cols 15-20), the "p-block"
  Purity: [2, 15], Peace: [2, 16], Charity: [2, 17], Thoughtfulness: [2, 18], Joy: [2, 19], Reverence: [2, 20],
  Obedience: [3, 15], Cherish: [3, 16], Sympathy: [3, 17], Devotion: [3, 18], Cheerfulness: [3, 19], Faith: [3, 20],

  // Breakout strip, row 9 (Humility · Gratitude · Integrity · Hard Work),
  // separated from the main structure by the spacer row 8.
  Modesty: [9, 1], Unpretentious: [9, 2],
  Appreciation: [9, 3], Gratefulness: [9, 4],
  Genuineness: [9, 5], Reliability: [9, 6], Ethical: [9, 7], Innocence: [9, 8], Nobility: [9, 9], Probity: [9, 10],
  Community: [9, 11], Persistence: [9, 12], Perseverance: [9, 13], Determination: [9, 14], Diligence: [9, 15], Thrift: [9, 16], Discipline: [9, 17],

  // Breakout strip, row 10
  Meekness: [10, 1], Sincerity: [10, 2],
  Thankfulness: [10, 3],
  Vulnerability: [10, 4], Authenticity: [10, 5], Character: [10, 6], Excellence: [10, 7], Principles: [10, 8], Individuality: [10, 9], Morality: [10, 10],
  Time: [10, 11], Passion: [10, 12], Endurance: [10, 13], Tenacity: [10, 14], Ambition: [10, 15], Dedication: [10, 16], "Self-reliance": [10, 17],
};
