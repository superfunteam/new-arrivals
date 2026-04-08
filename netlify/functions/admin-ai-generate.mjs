import Anthropic from '@anthropic-ai/sdk';
import { verifyToken } from './lib/auth.mjs';

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
  const client = new Anthropic();
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content?.[0]?.text || '';
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1].trim();

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse AI response as JSON: ${e.message}\nRaw: ${text.slice(0, 500)}`);
  }
}

// Netlify Functions v2 format
export default async (req, context) => {
  console.log(`[admin-ai-generate] ${req.method} ${req.url}`);
  // Auth check
  const cookie = req.headers.get('cookie');
  if (!(await verifyToken(cookie))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await req.json();
    const { mode } = body;

    if (mode === 'full_puzzle') {
      const { theme } = body;
      if (!theme) return Response.json({ error: 'Theme is required' }, { status: 400 });

      const prompt = `Design a New Arrivals puzzle with the theme: "${theme}"

Remember:
- 4 categories with difficulty 1-4 (one of each)
- 4 movies per category (16 total)
- Movies mostly from 1970-1999
- Include 2-3 overlap traps (movies that could plausibly fit multiple categories)
- Use exact TMDB titles`;

      const result = await callClaude(FULL_PUZZLE_SYSTEM_PROMPT, prompt);
      return Response.json(result);
    }

    if (mode === 'category') {
      const { name, existingMovies = [] } = body;
      if (!name) return Response.json({ error: 'Category name is required' }, { status: 400 });

      let prompt = `Find 4 movies that fit this category: "${name}"`;
      if (existingMovies.length > 0) {
        prompt += `\n\nAvoid these already-used movies:\n${existingMovies.map((m) => `- ${m}`).join('\n')}`;
      }

      const result = await callClaude(CATEGORY_SYSTEM_PROMPT, prompt);
      return Response.json(result);
    }

    return Response.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (err) {
    console.error('AI generate error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};


export const config = { path: '/api/admin-ai-generate' };
