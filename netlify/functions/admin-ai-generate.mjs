import { verifyToken, authResponse } from './lib/auth.mjs';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const FULL_PUZZLE_SYSTEM_PROMPT = `You are a puzzle designer for "New Arrivals," a daily VHS rental store trivia game.

GAME CONCEPT: Players sort 16 VHS tapes into 4 hidden genre categories on a 3D shelf. Think NYT Connections meets 1980s Blockbuster Video.

DIFFICULTY TIERS (required, one of each):
- Category 1 (Easy): Instantly recognizable grouping. Actor filmography, franchise, studio, obvious genre. Anyone who's browsed a video store gets this.
- Category 2 (Medium): Requires some film knowledge. Theme, subgenre, source material, era. Film fans get this.
- Category 3 (Hard): Non-obvious trait. Behind-the-scenes fact, setting constraint, production detail. You'd need to have seen or read about these films.
- Category 4 (Devious): Deep trivia. Cameos, bans, actor trivia, obscure production facts. Only serious cinephiles catch this.

RULES:
- Exactly 4 categories, exactly 4 movies per category (16 total)
- Movies primarily from 1970-1999 (video store golden age). Occasional outliers OK.
- At least 2-3 movies must plausibly fit multiple categories (overlap traps that create false confidence)
- Each movie needs: title (exact as on TMDB) and year

OUTPUT: Valid JSON only, no commentary.
{
  "title": "Puzzle Title",
  "categories": [
    {
      "name": "Category Name",
      "difficulty": 1,
      "color": "#4CAF50",
      "movies": [
        { "title": "Movie Title", "year": 1985 }
      ]
    }
  ]
}

Difficulty colors: 1="#4CAF50", 2="#FFC107", 3="#2196F3", 4="#9C27B0"`;

const CATEGORY_SYSTEM_PROMPT = `You are a movie expert for "New Arrivals," a VHS rental store trivia game.

Given a category name, find exactly 4 movies that fit that category. Movies should primarily be from 1970-1999 (the video store golden age). Occasional outliers are OK.

Each movie needs the exact title as it appears on TMDB, and its release year.

OUTPUT: Valid JSON array only, no commentary.
[
  { "title": "Movie Title", "year": 1985 },
  { "title": "Movie Title", "year": 1990 },
  { "title": "Movie Title", "year": 1982 },
  { "title": "Movie Title", "year": 1994 }
]`;

async function callClaude(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1].trim();

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse AI response as JSON: ${e.message}\nRaw: ${text.slice(0, 500)}`);
  }
}

async function handleFullPuzzle(theme) {
  const prompt = `Design a New Arrivals puzzle with the theme: "${theme}"

Remember:
- 4 categories with difficulty 1-4 (one of each)
- 4 movies per category (16 total)
- Movies mostly from 1970-1999
- Include 2-3 overlap traps (movies that could plausibly fit multiple categories)
- Use exact TMDB titles`;

  const result = await callClaude(FULL_PUZZLE_SYSTEM_PROMPT, prompt);
  return result;
}

async function handleCategory(name, existingMovies = []) {
  let prompt = `Find 4 movies that fit this category: "${name}"`;
  if (existingMovies.length > 0) {
    prompt += `\n\nAvoid these already-used movies:\n${existingMovies.map((m) => `- ${m}`).join('\n')}`;
  }

  const result = await callClaude(CATEGORY_SYSTEM_PROMPT, prompt);
  return result;
}

export async function handler(event) {
  const isAuthed = await verifyToken(event.headers.cookie);
  if (!isAuthed) return authResponse(401, { error: 'Unauthorized' });

  if (event.httpMethod !== 'POST') {
    return authResponse(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { mode } = body;

    if (mode === 'full_puzzle') {
      const { theme } = body;
      if (!theme) return authResponse(400, { error: 'Theme is required' });
      const result = await handleFullPuzzle(theme);
      return authResponse(200, result);
    }

    if (mode === 'category') {
      const { name, existingMovies } = body;
      if (!name) return authResponse(400, { error: 'Category name is required' });
      const result = await handleCategory(name, existingMovies);
      return authResponse(200, result);
    }

    return authResponse(400, { error: 'Invalid mode. Use "full_puzzle" or "category"' });
  } catch (err) {
    console.error('AI generate error:', err);
    return authResponse(500, { error: err.message });
  }
}
