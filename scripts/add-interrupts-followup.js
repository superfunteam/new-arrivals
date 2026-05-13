// Follow-up script for adding interrupt content. Distinct from the one-shot
// add-missing-interrupts.js because that one applied a non-idempotent
// 2026-04-16 ↔ 2026-04-17 swap; running it again would undo that fix.
//
// This script is safe to re-run: it only ADDS interrupts for dates that
// currently have none. Already-populated dates are skipped.
//
// Add a new puzzle's interrupts by appending to NEW_INTERRUPTS below, then:
//   node scripts/add-interrupts-followup.js
//   npm run verify-interrupts

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INTERRUPTS_PATH = path.join(ROOT, 'public', 'interrupts.json');

// Character lookup — same map as add-missing-interrupts.js. Punk Man's sprite
// file is "punk_men.png" (plural). Don't fight it.
const CHARS = {
  blondeKidGirl:   { character: 'Blonde Kid Girl',     folder: 'Blonde Kid Girl',     sprite: 'blonde_kid_girl' },
  blondeMan:       { character: 'Blonde Man',          folder: 'Blonde Man',          sprite: 'blonde_man' },
  blondeWoman:     { character: 'Blonde Woman',        folder: 'Blonde Woman',        sprite: 'blonde_woman' },
  blueKidGirl:     { character: 'Blue Haired Kid Girl',folder: 'Blue Haired Kid Girl',sprite: 'blue_haired_kid_girl' },
  blueWoman:       { character: 'Blue Haired Woman',   folder: 'Blue Haired Woman',   sprite: 'blue_haired_woman' },
  bride:           { character: 'Bride',               folder: 'Bride',               sprite: 'bride' },
  businessman:     { character: 'Businessman',         folder: 'Businessman',         sprite: 'businessman' },
  chef:            { character: 'Chef',                folder: 'Chef',                sprite: 'chef' },
  farmer:          { character: 'Farmer',              folder: 'Farmer',              sprite: 'farmer' },
  firefighter:     { character: 'Firefighter',         folder: 'Firefighter',         sprite: 'firefighter' },
  goblinKid:       { character: 'Goblin Kid',          folder: 'Goblin Kid',          sprite: 'goblin_kid' },
  joker:           { character: 'Joker',               folder: 'Joker',               sprite: 'joker' },
  knight:          { character: 'Knight',              folder: 'Knight',              sprite: 'knight' },
  knightKid:       { character: 'Knight Kid',          folder: 'Knight Kid',          sprite: 'knight_kid' },
  ninja:           { character: 'Ninja',               folder: 'Ninja',               sprite: 'ninja' },
  oldMan:          { character: 'Old Man',             folder: 'Old Man',             sprite: 'old_man' },
  oldWoman:        { character: 'Old Woman',           folder: 'Old Woman',           sprite: 'old_woman' },
  policeman:       { character: 'Policeman',           folder: 'Policeman',           sprite: 'policeman' },
  punkKidBoy:      { character: 'Punk Kid Boy',        folder: 'Punk Kid Boy',        sprite: 'punk_kid_boy' },
  punkMan:         { character: 'Punk Man',            folder: 'Punk Man',            sprite: 'punk_men' },
  punkWoman:       { character: 'Punk Woman',          folder: 'Punk Woman',          sprite: 'punk_woman' },
  vikingKidBoy:    { character: 'Viking Kid Boy',      folder: 'Viking Kid Boy',      sprite: 'viking_kid_boy' },
  vikingMan:       { character: 'Viking Man',          folder: 'Viking Man',          sprite: 'viking_man' },
  vikingWoman:     { character: 'Viking Woman',        folder: 'Viking Woman',        sprite: 'viking_woman' },
};

const trivia = (char, dialogue, answers, correct) =>
  ({ type: 'trivia', ...char, dialogue, answers, correct });
const hint = (char, dialogue, hintCategory, cost = 3) =>
  ({ type: 'hint', ...char, dialogue, hintCategory, cost });
const story = (char, dialogue, dismiss) =>
  ({ type: 'story', ...char, dialogue, dismiss });

// ---------------------------------------------------------------------------
// New content (10 each: 4 trivia + 3 hint + 3 story)
// ---------------------------------------------------------------------------
const NEW_INTERRUPTS = {

  // Friday Frights (05-08) — added after Tom's feedback that Poltergeist
  // wasn't a great fit for Demonic Possession (swapped to The Exorcism of
  // Emily Rose). This puzzle had no interrupts at all, so adding the full
  // mix here.
  // Categories: Slasher Films | Stephen King Adaptations | Body Horror | Demonic Possession
  '2026-05-08': [
    trivia(CHARS.vikingMan,
      "SLASHER QUESTION! In Halloween (1978), what's the name of the killer in the white mask?",
      ["Jason Voorhees", "Michael Myers", "Freddy Krueger", "Ghostface"], 1),
    trivia(CHARS.punkWoman,
      "Misery — what does Annie Wilkes do to Paul's ankles?",
      ["Burns them with a torch", "Hobbles them with a sledgehammer", "Breaks them on a fence post", "Ties them to the bedposts"], 1),
    trivia(CHARS.ninja,
      "Whisper... in The Thing (1982), what creature has assimilated the Antarctic research team?",
      ["A vampire", "An alien shapeshifter", "A demon", "A ghost"], 1),
    trivia(CHARS.knight,
      "VERILY! In The Exorcism of Emily Rose, the film is based on what kind of real event?",
      ["A war crime", "A famous murder", "A real exorcism case from Germany", "A medical conspiracy"], 2),
    hint(CHARS.punkKidBoy,
      "Dude I want the OG slasher stuff — masked killer, big knife, dumb teenagers making the wrong call. The full ritual.",
      "Slasher Films"),
    hint(CHARS.oldWoman,
      "Dearie, I want films from that Maine fellow — the prolific horror writer. He's written more books than I've baked pies. Maximum-overdrive type.",
      "Stephen King Adaptations"),
    hint(CHARS.chef,
      "Looking for the films where the BODY itself becomes the horror — things growing in places they shouldn't, transformations, flesh as the enemy. Pure Cronenberg territory.",
      "Body Horror"),
    story(CHARS.joker,
      "Why don't demons negotiate? Because they always SPEAK in tongues — and the audience can't follow the contract! Read the fine print before exorcising!",
      "Send a notary"),
    story(CHARS.firefighter,
      "Watched The Thing at the firehouse during a snowstorm. Power went out halfway through. We did NOT finish that movie that night. We finished it in DAYLIGHT.",
      "Smart team policy"),
    story(CHARS.farmer,
      "My wife rented Pet Sematary thinking it was a kid's movie about cats. Two hours later neither of us was sleeping. Stephen King is NOT a kids' author.",
      "Filed under no thanks"),
  ],

  // Today — Monday Mayhem
  // Categories: Schwarzenegger Action | 80s Cop Action | Action on a Vehicle | Real-Time Thrillers
  '2026-05-11': [
    trivia(CHARS.vikingMan,
      "TELL ME, MERCHANT! In Predator, what jungle environment does Dutch's team fight the alien in?",
      ["The Amazon", "Central America", "Vietnam", "The Congo"], 1),
    trivia(CHARS.policeman,
      "Lethal Weapon — Riggs and Murtaugh's first names, please.",
      ["Mike and Joe", "Martin and Roger", "Frank and Lou", "Sam and Ed"], 1),
    trivia(CHARS.firefighter,
      "Speed — what speed must the bus stay above to keep the bomb from detonating?",
      ["50 mph", "55 mph", "60 mph", "65 mph"], 0),
    trivia(CHARS.businessman,
      "High Noon — the whole movie unfolds in real time. How long does the sheriff have before the bad guys arrive?",
      ["One hour", "Two hours", "Three hours", "Until sundown"], 0),
    hint(CHARS.vikingKidBoy,
      "I WANT THE BIG GUY MOVIES!! The Austrian one with the muscles!! He says I'LL BE BACK and stuff explodes!!",
      "Schwarzenegger Action"),
    hint(CHARS.oldMan,
      "Take me back to the eighties — neon, mullets, two cops who hate each other but get the job done. Cassette tape soundtrack.",
      "80s Cop Action"),
    hint(CHARS.businessman,
      "Movies where the whole thing goes down ON or IN a moving vehicle — bus, plane, ship, train. The vehicle IS the setting.",
      "Action on a Vehicle"),
    story(CHARS.joker,
      "Why did the action hero refuse the elevator? Because he ALWAYS takes the STAIRS — preferably while it's exploding! Cinema 101!",
      "Get to da choppa"),
    story(CHARS.farmer,
      "Tried to do the Predator handshake with the foreman at work. He did NOT know the reference. I'm Bill Duke in my heart.",
      "Underappreciated"),
    story(CHARS.punkWoman,
      "Saw Die Hard at twelve and decided yippee-ki-yay was my new catchphrase. Got sent to the principal's office TWICE. Worth it.",
      "Welcome to the party"),
  ],

  // Tomorrow — Two-for-Tuesday
  // Categories: Movies with Numerical Sequels (2, 3, etc.) | Twin Movies: Released Same Year, Similar Plots | Films Where Two Actors Play the Same Character | Two Directors Co-Directed These Films
  '2026-05-12': [
    trivia(CHARS.vikingKidBoy,
      "BACK TO THE FUTURE PART II!! What year does Marty travel forward to?",
      ["2015", "2020", "2025", "2030"], 0),
    trivia(CHARS.businessman,
      "1998 had TWO killer-asteroid movies. Deep Impact and which other?",
      ["Asteroid Hunter", "Armageddon", "Doomsday", "Impact"], 1),
    trivia(CHARS.bride,
      "The Parent Trap (1998) — what's the name of BOTH twins played by Lindsay Lohan?",
      ["Annie and Hallie", "Susan and Sharon", "Sarah and Sophie", "Anna and Holly"], 0),
    trivia(CHARS.farmer,
      "Fargo was directed by the Coen Brothers. What state is most of it set in?",
      ["Wisconsin", "North Dakota", "Minnesota", "Iowa"], 2),
    hint(CHARS.knight,
      "I seek tales bearing a NUMBER in their title — the second, the third, the continuing saga! Sequels by digit, not by subtitle.",
      "Movies with Numerical Sequels (2, 3, etc.)"),
    hint(CHARS.blueWoman,
      "Looking for those eerie pairs — two studios released basically the SAME movie in the same year. Volcanoes, asteroids, ant films, the works.",
      "Twin Movies: Released Same Year, Similar Plots"),
    hint(CHARS.punkMan,
      "I want movies where TWO different actors play the SAME character. Body swap, twin reveal, face-changing surgery — whatever the gimmick.",
      "Films Where Two Actors Play the Same Character"),
    story(CHARS.joker,
      "Why are twin movies released the same year? Because two studios WATCHED each other's pitch meetings! Hollywood, you sneaky duplicators!",
      "Industry secret"),
    story(CHARS.chef,
      "Tried to make TWO of every dish on Tuesday for theme night. Got halfway through prep and realized I'd just doubled my hours. Sundown special, my mistake.",
      "Lesson learned"),
    story(CHARS.firefighter,
      "Saw The Parent Trap and Dead Ringers in the same week. Cried at one, slept with the lights on after the other. Both feature twins, both legendary.",
      "Range of emotions"),
  ],
};

// ---------------------------------------------------------------------------
// Merge — idempotent ADD only
// ---------------------------------------------------------------------------
const interrupts = JSON.parse(fs.readFileSync(INTERRUPTS_PATH, 'utf8'));

let added = 0, skipped = 0;
for (const [puzzleId, items] of Object.entries(NEW_INTERRUPTS)) {
  if (interrupts[puzzleId] && interrupts[puzzleId].length > 0) {
    console.log(`[skip] ${puzzleId} already has ${interrupts[puzzleId].length} interrupts`);
    skipped++;
    continue;
  }
  interrupts[puzzleId] = items;
  console.log(`[add]  ${puzzleId} — ${items.length} interrupts`);
  added++;
}

fs.writeFileSync(INTERRUPTS_PATH, JSON.stringify(interrupts, null, 2));
console.log(`\nAdded ${added}, skipped ${skipped}. Wrote ${INTERRUPTS_PATH}`);
