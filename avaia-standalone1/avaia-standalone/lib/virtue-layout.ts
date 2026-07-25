// Periodic-table layout for the Chemistry of Virtue — grid positions
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
export const GRID_ROWS = 9;

export const VIRTUE_POS: Record<string, [number, number]> = {
  // Wisdom — top-left tower + main region (cols 1-5)
  Percipience: [1, 1],
  Judgment: [2, 1], Light: [2, 2],
  Balance: [3, 1], Originality: [3, 2],
  Reason: [4, 1], Knowledge: [4, 2], Imagination: [4, 3], "Critical thinking": [4, 4], Spirituality: [4, 5],
  Logic: [5, 1], Understanding: [5, 2], Prudence: [5, 3], Intuition: [5, 4], Wonder: [5, 5],
  Discernment: [6, 1], Creativity: [6, 2], Objectivity: [6, 3], Capacity: [6, 4],
  Vision: [7, 1], Simplicity: [7, 2], Change: [7, 3], Priority: [7, 4],

  // Justice — cols 6-9
  Fairness: [4, 6], Honesty: [4, 7], Courtesy: [4, 8], Impartial: [4, 9],
  Respect: [5, 6], Tolerance: [5, 7], Benignity: [5, 8],
  Dignity: [6, 6], Acceptance: [6, 7], Grace: [6, 8], Truth: [6, 9],
  Civility: [7, 6], Chivalry: [7, 7], Honor: [7, 8], Equality: [7, 9],

  // Fortitude — cols 10-12
  Courage: [4, 10], Magnanimity: [4, 11],
  Steadfast: [5, 10], Resilience: [5, 11], Assertive: [5, 12],
  Confidence: [6, 10], Fearlessness: [6, 11], Independent: [6, 12],
  Bravery: [7, 10], Valor: [7, 11],

  // Self-Control — main cols 13-14 (+ extras in the top-right cluster)
  Mindfulness: [4, 13], Patience: [4, 14],
  Mercy: [5, 13], "Long-suffering": [5, 14],
  Awareness: [6, 13], Fidelity: [6, 14],
  Temperance: [7, 13], Moderation: [7, 14],

  // Love — main cols 15-18 (+ extras in the top-right cluster)
  Kindness: [4, 15], Adoration: [4, 16], Forgiveness: [4, 17],
  Sacrifice: [5, 15], Nurturing: [5, 16], Compassion: [5, 17],
  Benevolence: [6, 15], Generosity: [6, 16], Hospitality: [6, 17],
  Admiration: [7, 15], Helpfulness: [7, 16], Loyalty: [7, 17], Yearning: [7, 18],

  // Positive Attitude — main cols 19-20 (+ extras in the top-right cluster)
  Beauty: [4, 19], Serenity: [4, 20],
  Adaptability: [5, 19], Humor: [5, 20],
  Optimism: [6, 19], Flexibility: [6, 20],
  Hope: [7, 19], Zeal: [7, 20],

  // Top-right cluster (rows 2-3, cols 15-20) — the "p-block"
  Purity: [2, 15], Peace: [2, 16], Charity: [2, 17], Thoughtfulness: [2, 18], Joy: [2, 19], Reverence: [2, 20],
  Obedience: [3, 15], Cherish: [3, 16], Sympathy: [3, 17], Devotion: [3, 18], Cheerfulness: [3, 19], Faith: [3, 20],

  // Breakout strip — row 8 (Humility · Gratitude · Integrity · Hard Work)
  Modesty: [8, 1], Unpretentious: [8, 2],
  Appreciation: [8, 3], Gratefulness: [8, 4],
  Genuineness: [8, 5], Reliability: [8, 6], Ethical: [8, 7], Innocence: [8, 8], Nobility: [8, 9], Probity: [8, 10],
  Community: [8, 11], Persistence: [8, 12], Perseverance: [8, 13], Determination: [8, 14], Diligence: [8, 15], Thrift: [8, 16], Discipline: [8, 17],

  // Breakout strip — row 9
  Meekness: [9, 1], Sincerity: [9, 2],
  Thankfulness: [9, 3],
  Vulnerability: [9, 4], Authenticity: [9, 5], Character: [9, 6], Excellence: [9, 7], Principles: [9, 8], Individuality: [9, 9], Morality: [9, 10],
  Time: [9, 11], Passion: [9, 12], Endurance: [9, 13], Tenacity: [9, 14], Ambition: [9, 15], Dedication: [9, 16], "Self-reliance": [9, 17],
};
