import Anthropic from '@anthropic-ai/sdk';
import { verifyToken, authResponse } from './lib/auth.mjs';

// Lazy init — Netlify AI Gateway injects env vars at runtime
let _anthropic;
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

// All 24 available characters with their sprite/folder data and type
const CHARACTERS = [
  { character: 'Blonde Kid Girl', sprite: 'blonde_kid_girl', folder: 'Blonde Kid Girl', type: 'kid' },
  { character: 'Blonde Man', sprite: 'blonde_man', folder: 'Blonde Man', type: 'adult' },
  { character: 'Blonde Woman', sprite: 'blonde_woman', folder: 'Blonde Woman', type: 'adult' },
  { character: 'Blue Haired Kid Girl', sprite: 'blue_haired_kid_girl', folder: 'Blue Haired Kid Girl', type: 'kid' },
  { character: 'Blue Haired Woman', sprite: 'blue_haired_woman', folder: 'Blue Haired Woman', type: 'adult' },
  { character: 'Bride', sprite: 'bride', folder: 'Bride', type: 'adult' },
  { character: 'Businessman', sprite: 'businessman', folder: 'Businessman', type: 'adult' },
  { character: 'Chef', sprite: 'chef', folder: 'Chef', type: 'adult' },
  { character: 'Farmer', sprite: 'farmer', folder: 'Farmer', type: 'adult' },
  { character: 'Firefighter', sprite: 'firefighter', folder: 'Firefighter', type: 'adult' },
  { character: 'Goblin Kid', sprite: 'goblin_kid', folder: 'Goblin Kid', type: 'kid' },
  { character: 'Joker', sprite: 'joker', folder: 'Joker', type: 'adult' },
  { character: 'Knight', sprite: 'knight', folder: 'Knight', type: 'adult' },
  { character: 'Knight Kid', sprite: 'knight_kid', folder: 'Knight Kid', type: 'kid' },
  { character: 'Ninja', sprite: 'ninja', folder: 'Ninja', type: 'adult' },
  { character: 'Old Man', sprite: 'old_man', folder: 'Old Man', type: 'old' },
  { character: 'Old Woman', sprite: 'old_woman', folder: 'Old Woman', type: 'old' },
  { character: 'Policeman', sprite: 'policeman', folder: 'Policeman', type: 'adult' },
  { character: 'Punk Kid Boy', sprite: 'punk_kid_boy', folder: 'Punk Kid Boy', type: 'kid' },
  { character: 'Punk Man', sprite: 'punk_man', folder: 'Punk Man', type: 'adult' },
  { character: 'Punk Woman', sprite: 'punk_woman', folder: 'Punk Woman', type: 'adult' },
  { character: 'Viking Kid Boy', sprite: 'viking_kid_boy', folder: 'Viking Kid Boy', type: 'kid' },
  { character: 'Viking Man', sprite: 'viking_man', folder: 'Viking Man', type: 'adult' },
  { character: 'Viking Woman', sprite: 'viking_woman', folder: 'Viking Woman', type: 'adult' },
];

function pickRandomCharacters(count) {
  const shuffled = [...CHARACTERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const INTERRUPT_SYSTEM_PROMPT = `You are writing customer dialogue for "New Arrivals," a VHS rental store game. Customers interrupt the player while they sort tapes.

SETTING: A video rental store, Friday night, 1987. Customers are browsing, chatting, looking for movies.

Generate exactly 10 interruptions:
- 4 TRIVIA: Ask about a specific movie on the shelf. 4 multiple-choice answers (1 correct, 3 plausible wrong from the same era). Short question, 1-2 sentences.
- 3 HINTS: Character vaguely describes what they're looking for (obliquely referencing a category). Include the exact category name as hintCategory. Never say the category name in dialogue.
- 3 STORIES: Funny 80s rental store anecdote, joke, pun, or oversharing. Include a fun dismiss button label.

CHARACTER VOICE RULES:
- Kid characters: UNHINGED energy. Caps, "UHHH", "MY MOM SAID", sugar-high, Tindendo references
- Adults: Normal 80s rental customer. Friday nights, date nights, late fees, opinions
- Old characters: Slower, nostalgic, confused by technology, wholesome

Keep dialogue SHORT (1-3 sentences max). These are quick interruptions.

OUTPUT: Valid JSON array only, no commentary. Each object must include ALL required fields for its type.`;

async function callClaude(systemPrompt, userPrompt) {
  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content?.[0]?.text || '';

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1].trim();

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse AI response as JSON: ${e.message}\nRaw: ${text.slice(0, 500)}`);
  }
}

export async function handler(event) {
  const isAuthed = await verifyToken(event.headers.cookie);
  if (!isAuthed) return authResponse(401, { error: 'Unauthorized' });

  if (event.httpMethod !== 'POST') {
    return authResponse(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { puzzle } = body;

    if (!puzzle || !puzzle.categories) {
      return authResponse(400, { error: 'Puzzle data with categories is required' });
    }

    // Build movie list and category list from puzzle
    const allMovies = puzzle.categories.flatMap((cat) =>
      (cat.items || cat.movies || []).map((m) => `${m.title} (${m.year})`)
    );
    const categoryNames = puzzle.categories.map((cat) => cat.name);

    // Pick 10 random characters
    const selected = pickRandomCharacters(10);

    // Build character assignments: 4 trivia, 3 hints, 3 stories
    const assignments = selected.map((char, i) => {
      if (i < 4) return { ...char, role: 'trivia' };
      if (i < 7) return { ...char, role: 'hint' };
      return { ...char, role: 'story' };
    });

    const characterDescriptions = assignments.map((a) =>
      `- ${a.character} (${a.type}) → ${a.role.toUpperCase()}`
    ).join('\n');

    const prompt = `PUZZLE MOVIES (on the shelf):
${allMovies.map((m) => `- ${m}`).join('\n')}

PUZZLE CATEGORIES:
${categoryNames.map((n) => `- ${n}`).join('\n')}

CHARACTERS (use these exact names, sprites, and folders — assign each to their designated type):
${characterDescriptions}

Generate 10 interruptions. Each must include:
- For trivia: { "type": "trivia", "character": "...", "sprite": "...", "folder": "...", "dialogue": "...", "answers": ["A","B","C","D"], "correct": 0-3 }
- For hints: { "type": "hint", "character": "...", "sprite": "...", "folder": "...", "dialogue": "...", "hintCategory": "exact category name from list above", "cost": 3 }
- For stories: { "type": "story", "character": "...", "sprite": "...", "folder": "...", "dialogue": "...", "dismiss": "fun button label" }

Use the character, sprite, and folder values EXACTLY as provided above.`;

    const interrupts = await callClaude(INTERRUPT_SYSTEM_PROMPT, prompt);

    // Validate and fix the interrupts structure
    if (!Array.isArray(interrupts) || interrupts.length !== 10) {
      throw new Error(`Expected 10 interrupts, got ${Array.isArray(interrupts) ? interrupts.length : 'non-array'}`);
    }

    // Ensure sprite/folder fields match our character data
    const charMap = Object.fromEntries(
      assignments.map((a) => [a.character, a])
    );

    const validated = interrupts.map((interrupt) => {
      const charData = charMap[interrupt.character];
      if (charData) {
        interrupt.sprite = charData.sprite;
        interrupt.folder = charData.folder;
      }
      return interrupt;
    });

    return authResponse(200, validated);
  } catch (err) {
    console.error('AI interrupts error:', err);
    return authResponse(500, { error: err.message });
  }
}
