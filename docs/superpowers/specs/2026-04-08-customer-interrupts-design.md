# Customer Interrupts — Design Spec

**Date:** 2026-04-08
**Status:** Approved

---

## Overview

Every 60 seconds during gameplay, an RPG-style chat box slides up from the bottom with an animated pixel-art character. The character delivers dialogue with type-in animation, garbled voice synthesis, and haptic feedback. Timer pauses during interrupts. 10 interrupts per puzzle, 3 types.

## Interrupt Types

| Type | Count per puzzle | Effect |
|------|-----------------|--------|
| Hint offer | 3 | Pay $3 to hear an exact category name |
| Story/joke | 3 | Flavor only, dismiss to continue |
| Trivia question | 4 | 4-choice MC, correct = +$2, wrong = nothing |

Interrupts fire in shuffled order, one every 60s. Max 10 per game. If game ends before all fire, remaining are skipped.

## UI

Chat box slides up from bottom over the game, above the HUD. Layout:

- Left: 64x64 animated sprite (32x32 at 2x with nearest-neighbor)
- Right of sprite: character name in Caprasimo font
- Below name: dialogue text, type-in animated at ~40ms/char
- Below dialogue: action buttons (context-dependent)

### Action Buttons by Type

- **Hint:** [Pay $3] [No thanks]
  - Pay: deduct $3, show follow-up line revealing category name, then [Got it] dismiss
  - No thanks: dismiss immediately
- **Story:** Single dismiss button with flavor text like [Ha, okay] [Cool story] [Sure thing]
- **Trivia:** 4 answer buttons. Correct = +$2 + "Nice!" follow-up. Wrong = "Nah" follow-up. Then auto-dismiss after 1s.

## Sprite System

- Sprite sheets: 128x256 PNG (4 cols x 8 rows of 32x32 frames)
- Top row (frames 0-3) = idle animation, looped at 4fps while dialogue is active
- Display at 64x64 with `image-rendering: pixelated`
- Use CSS `background-position` to step through frames

### Character Folder Structure
Each character in `public/characters/{Name}/` with `{snake_name}.png` and `{snake_name}_shadow.png`.

## Voice Synthesis (Tone.js)

Per-character garble voice — short oscillator bursts per typed character:
- **Kid characters** (name contains "Kid"): 400-900hz random, square wave
- **Adult characters**: 200-600hz random, square wave
- **Old characters** (Old Man/Woman): 150-400hz random, sine wave
- Burst duration: 20ms per character
- Small random pitch variation per burst for natural feel

## Haptic Feedback

`navigator.vibrate(10)` per typed character (10ms pulse). Skip if API unavailable.

## Timer Behavior

Game timer PAUSES when interrupt appears. Resumes when dismissed. Interaction remains locked during interrupt.

## Data

`public/interrupts.json` — keyed by puzzle ID, array of 10 interrupt objects per puzzle.

```json
{
  "2026-04-07": [
    {
      "type": "trivia",
      "character": "Punk Kid Boy",
      "sprite": "punk_kid_boy",
      "folder": "Punk Kid Boy",
      "dialogue": "Yo dude which movie has Arnold going to Mars?",
      "answers": ["Total Recall", "Predator", "Commando", "Running Man"],
      "correct": 0
    },
    {
      "type": "hint",
      "character": "Old Woman",
      "sprite": "old_woman",
      "folder": "Old Woman",
      "dialogue": "I'm looking for films where the ladies called the shots behind the camera...",
      "hintCategory": "Directed by a Woman",
      "cost": 3
    },
    {
      "type": "story",
      "character": "Businessman",
      "sprite": "businessman",
      "folder": "Businessman",
      "dialogue": "I once tried to return a tape three years late. Manager charged me forty bucks. I bought the store.",
      "dismiss": "Power move"
    }
  ]
}
```

## Character Voice Rules for Dialogue Writing

- **Kid characters**: Unhinged energy. Caps, "UHHH", "MY MOM SAID", excited, distracted, sugar-high vibes
- **Adults**: Normal 80s rental customer. Browsing, chatty, opinionated about movies
- **Old characters**: Slower, nostalgic, confused by new releases, wholesome

All dialogue rooted in 80s video rental culture: Friday night rushes, pizza parties, Tindendo (not Nintendo), late fees, rewinding tapes, membership cards, snack aisle.

## Dialogue Distribution (10 per puzzle)

- 3 hint offers: each references a different unsolved category (vaguely, not by name)
- 3 stories: jokes, puns, oversharing, 80s nostalgia
- 4 trivia: each about a specific movie on the current shelf, multiple choice

## Files

- `public/interrupts.json` — 150 prebaked interrupts (10 x 15 puzzles)
- `src/interrupts.js` — timer, queue management, UI rendering, sprite animation, voice, vibration, reward/cost hooks
- `styles/main.css` — chat box styles added to existing file

## Integration Points

- `src/main.js`: start interrupt timer after entrance animation, pass game state for economy hooks
- `src/game-logic.js`: add `addWage(game, amount)` for trivia rewards
- `src/audio.js`: add garble voice function or handle in interrupts.js directly via Tone.js
