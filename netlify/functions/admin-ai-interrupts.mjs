import Anthropic from '@anthropic-ai/sdk';
import { verifyToken } from './lib/auth.mjs';

// All 24 available characters
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

// Netlify Functions v2 format
export default async (req, context) => {
  const cookie = req.headers.get('cookie');
  if (!(await verifyToken(cookie))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await req.json();
    const { puzzle } = body;

    if (!puzzle || !puzzle.categories) {
      return Response.json({ error: 'Puzzle data with categories is required' }, { status: 400 });
    }

    const allMovies = puzzle.categories.flatMap((cat) =>
      (cat.items || cat.movies || []).map((m) => `${m.title} (${m.year})`)
    );
    const categoryNames = puzzle.categories.map((cat) => cat.name);

    // Pick 10 random characters
    const shuffled = [...CHARACTERS].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 10);
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

CHARACTERS:
${characterDescriptions}

Generate 10 interruptions with these exact character/sprite/folder values.`;

    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: INTERRUPT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content?.[0]?.text || '';
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const parsed = JSON.parse(jsonMatch[1].trim());

    // Validate and fix sprite/folder fields
    const charMap = Object.fromEntries(assignments.map((a) => [a.character, a]));
    const validated = (Array.isArray(parsed) ? parsed : []).map((interrupt) => {
      const charData = charMap[interrupt.character];
      if (charData) {
        interrupt.sprite = charData.sprite;
        interrupt.folder = charData.folder;
      }
      return interrupt;
    });

    return Response.json(validated);
  } catch (err) {
    console.error('AI interrupts error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};

