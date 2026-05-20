// One-shot script that adds AI-written customer chat (interrupts) for the
// six May 2026 puzzles that were still missing them:
//   2026-05-06, 2026-05-07, 2026-05-09, 2026-05-10, 2026-05-20, 2026-05-21
//
// Each puzzle gets the standard 10-item mix: 4 trivia + 3 hint + 3 story.
// Hints reference the puzzle's exact category names (verified against
// public/puzzles.json) so the help menu can surface them when those
// categories are still unsolved. Every puzzle uses 10 DIFFERENT characters.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INTERRUPTS_PATH = path.join(ROOT, 'public', 'interrupts.json');

// ---------------------------------------------------------------------------
// Character → sprite filename map (sprite = filename without .png)
// Matches public/characters/<folder>/<sprite>.png on disk.
// IMPORTANT: "Punk Man" folder contains punk_men.png (plural 'men') — not
// punk_man. This caught us before.
// ---------------------------------------------------------------------------
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

// Helpers — keep call sites tidy and ensure every entry has the required fields
const trivia = (char, dialogue, answers, correct) =>
  ({ type: 'trivia', ...char, dialogue, answers, correct });
const hint = (char, dialogue, hintCategory, cost = 3) =>
  ({ type: 'hint', ...char, dialogue, hintCategory, cost });
const story = (char, dialogue, dismiss) =>
  ({ type: 'story', ...char, dialogue, dismiss });

// ---------------------------------------------------------------------------
// New interrupt content
// ---------------------------------------------------------------------------
const NEW_INTERRUPTS = {

  // === 2026-05-06 | Wednesday Whodunits =====================================
  // Murder Mystery Movies | Alfred Hitchcock Films | Famous Twist Endings | Adapted from Agatha Christie
  '2026-05-06': [
    trivia(CHARS.policeman, "Police business — in Clue (1985), how many alternate endings did the theatrical release have?",
      ["Two", "Three", "Four", "Five"], 1),
    trivia(CHARS.oldWoman, "Dear, in Psycho, what is the name of the motel where Marion stays?",
      ["The Roadside Inn", "The Bates Motel", "The Hillcrest", "The Mariposa"], 1),
    trivia(CHARS.ninja, "Whisper... in The Sixth Sense, what is Bruce Willis's character's big secret?",
      ["He's the killer", "He's been dead the whole time", "He's the boy's father", "It was all a dream"], 1),
    trivia(CHARS.businessman, "Murder on the Orient Express — what is the detective's name?",
      ["Sherlock Holmes", "Hercule Poirot", "Miss Marple", "Father Brown"], 1),
    hint(CHARS.knight, "I seek tales of foul deeds and the brave souls who would unmask the culprit! Drawing rooms, suspects in a row, the final accusation!",
      "Murder Mystery Movies"),
    hint(CHARS.blueWoman, "I need movies by the Master of Suspense — that British director, big silhouette, did the cameos. Birds, showers, you know the one.",
      "Alfred Hitchcock Films"),
    hint(CHARS.punkWoman, "I want movies where the LAST FIVE MINUTES make you sit there with your jaw on the carpet. Whole movie rewrites itself in one scene.",
      "Famous Twist Endings"),
    story(CHARS.joker, "Why are the British so good at murder mysteries? Because they invented WAITING for the punchline! Tea, biscuit, BODY in the library!",
      "Splendid"),
    story(CHARS.farmer, "Rented Psycho thinkin' it was a horse movie. Saw the shower scene. Did NOT shower for a week. Wife eventually staged an intervention.",
      "Mother knows best"),
    story(CHARS.bride, "I made my bachelorette party watch Knives Out. Five of us correctly guessed the maid. The bride correctly guessed nothing. I'm still embarrassed.",
      "I should have known"),
  ],

  // === 2026-05-07 | Throwback Thursday ======================================
  // Iconic 1970s Blockbusters | 1980s Teen Classics | 1990s Cult Hits | Films Set in a Past Decade
  '2026-05-07': [
    trivia(CHARS.oldMan, "In the original Star Wars (1977), what's the name of Luke's home planet?",
      ["Hoth", "Tatooine", "Endor", "Naboo"], 1),
    trivia(CHARS.blondeKidGirl, "In The Breakfast Club, what do the students call themselves at the end?",
      ["The Five", "The Breakfast Club", "The Saturday Crew", "The Rebels"], 1),
    trivia(CHARS.vikingMan, "PULP FICTION! What does Jules order at the diner near the end?",
      ["A cheeseburger", "Coffee and a muffin", "Pancakes", "Steak and eggs"], 1),
    trivia(CHARS.businessman, "Grease — what year is the movie set in?",
      ["The early 1950s", "The late 1950s", "The early 1960s", "The late 1940s"], 1),
    hint(CHARS.knight, "I seek the giants of the seventies! The films that birthed the modern blockbuster — sharks, sagas, spaceships and sweaty boxers!",
      "Iconic 1970s Blockbusters"),
    hint(CHARS.blueKidGirl, "OK so I need those eighties teen movies — like, the pink jacket vibe, the dance scenes, the awkward prom, Molly Ringwald energy?",
      "1980s Teen Classics"),
    hint(CHARS.punkMan, "Need that nineties cult stuff. Indie-violent, dialogue-heavy, smoke-filled rooms, sneakers on a body in a trunk. You know the vibe.",
      "1990s Cult Hits"),
    story(CHARS.joker, "Why is every 90s cult hit set in the 70s? Because the SOUNDTRACK was already PAID FOR! Sample the boomers, profit the gen-Xers!",
      "Music supervisor genius"),
    story(CHARS.oldWoman, "Dearie, I saw Jaws in the theater in '75. Did not swim again until '83. The grandkids think I'm being dramatic. I am NOT being dramatic.",
      "That shark was REAL"),
    story(CHARS.chef, "Tried to make a 1950s diner menu for date night after watching Grease. Wife took one look at the meatloaf and said 'go grease your hair.' Rude.",
      "She loved it"),
  ],

  // === 2026-05-09 | Saturday Morning Toons ==================================
  // Disney Renaissance | Don Bluth Films | Studio Ghibli | Stop-Motion Animation
  '2026-05-09': [
    trivia(CHARS.knightKid, "The Lion King — what's the name of Simba's wisecracking meerkat sidekick?",
      ["Pumbaa", "Timon", "Zazu", "Rafiki"], 1),
    trivia(CHARS.blondeKidGirl, "In Aladdin, what is the name of Aladdin's pet monkey?",
      ["Iago", "Abu", "Rajah", "Genie"], 1),
    trivia(CHARS.goblinKid, "BEAUTY AND THE BEAST! What is the name of the talking candelabra?",
      ["Cogsworth", "Lumière", "Mrs. Potts", "Chip"], 1),
    trivia(CHARS.bride, "The Little Mermaid — what song does Ariel sing about wanting to be where the people are?",
      ["Under the Sea", "Part of Your World", "Kiss the Girl", "Poor Unfortunate Souls"], 1),
    hint(CHARS.blueKidGirl, "I want, like, the BIG Disney era — the cartoons everybody sang along to in the 90s! Princesses, talking animals, Broadway songs!",
      "Disney Renaissance"),
    hint(CHARS.oldMan, "The other animator. The one with the brown movies, before the Pixar took over. Dark, scary cartoons for kids — gave me a stomach ache.",
      "Don Bluth Films"),
    hint(CHARS.blueWoman, "I want the gorgeous Japanese animation — hand-drawn forests, spirits, that bus that's a CAT? You know what I mean. Hayao stuff.",
      "Studio Ghibli"),
    story(CHARS.joker, "Why do stop-motion animators have arthritis by 30? Because they moved a CHICKEN one millimeter twenty-four times PER SECOND! Art HURTS!",
      "Tip your animator"),
    story(CHARS.chef, "I made ratatouille for my niece after Studio Ghibli night and she said 'wrong studio, uncle.' I am NOT recovering from that.",
      "Brutal six-year-old"),
    story(CHARS.farmer, "Watched Land Before Time with the kids. Three of them are now afraid of dinosaurs. Two are afraid of clouds. Don Bluth, what have you done.",
      "Therapy bills incoming"),
  ],

  // === 2026-05-10 | Mother's Day Matinee ====================================
  // Iconic Movie Moms (Comedy) | Mother-Daughter Dramas | Mom Saves the Kid | Twisted Mothers
  '2026-05-10': [
    trivia(CHARS.blondeWoman, "Mrs. Doubtfire — who plays the title character?",
      ["Robin Williams", "Steve Martin", "Tom Hanks", "Eddie Murphy"], 0),
    trivia(CHARS.oldWoman, "Dearie, in Terms of Endearment, what disease does Emma have?",
      ["Heart disease", "Cancer", "Tuberculosis", "Diabetes"], 1),
    trivia(CHARS.vikingMan, "ALIENS! What does Ripley famously yell at the queen alien?",
      ["Get out of my ship!", "Get away from her, you bitch!", "Leave my crew alone!", "Eat plasma!"], 1),
    trivia(CHARS.punkWoman, "Mommie Dearest — what household item famously SETS HER OFF?",
      ["Plastic forks", "Wire hangers", "Steel wool", "Wet towels"], 1),
    hint(CHARS.bride, "I want the funny movie moms! The wig, the apron, the chaos, the LAUGHS. The kind of mom that pretends to be someone else for the kids.",
      "Iconic Movie Moms (Comedy)"),
    hint(CHARS.businessman, "Looking for mother-daughter dramas — those weepy films where they argue, reconcile, cry, share a meaningful look across a hospital bed.",
      "Mother-Daughter Dramas"),
    hint(CHARS.firefighter, "I want movies where MOM has to step up and SAVE her kid. Action, horror, sci-fi — doesn't matter. The mom is the one with the flamethrower.",
      "Mom Saves the Kid"),
    story(CHARS.joker, "Why are twisted movie moms the best? Because we ALL knew one growing up! Hi mom, love you, please don't watch THIS particular movie!",
      "Send chocolates"),
    story(CHARS.farmer, "Watched Mrs. Doubtfire with my four boys. They made me try on the wig. We are NEVER speaking of this. Mother's Day was rough.",
      "Don't tell my wife"),
    story(CHARS.knight, "Verily, my lady mother insisted we watch Steel Magnolias on the eve of her birthday. By film's end, I had wept for THREE distinct reasons.",
      "Onion in my eye"),
  ],

  // === 2026-05-20 | Off the Beaten Reel =====================================
  // Jim Carrey Vehicles | Cult Comedies Set in High School | Movies Featuring Stop-Motion Animation | Satires of the Television Industry
  '2026-05-20': [
    trivia(CHARS.joker, "ACE VENTURA! What's Ace's job, exactly?",
      ["Animal control", "Pet detective", "Zookeeper", "Vet"], 1),
    trivia(CHARS.blondeKidGirl, "In Clueless, what is Cher's iconic catchphrase when she's disgusted?",
      ["Whatever!", "As if!", "Ugh, gross!", "Buggin'!"], 1),
    trivia(CHARS.vikingMan, "NIGHTMARE BEFORE CHRISTMAS! What's the main character's name?",
      ["Jack Skellington", "Oogie Boogie", "Sally", "Zero"], 0),
    trivia(CHARS.oldMan, "Network — what does Howard Beale famously yell out the window?",
      ["I want my money back!", "I'm mad as hell, and I'm not gonna take this anymore!", "Down with the system!", "Turn off your TV!"], 1),
    hint(CHARS.punkKidBoy, "Yo I want the rubber-face dude — talks out of his butt in one, talks to God in another, plays with a mask, plays with the Riddler. THAT guy.",
      "Jim Carrey Vehicles"),
    hint(CHARS.blueKidGirl, "Movies set in high school but, like, WEIRD high school? Cult-favorite teen comedies — the ones the cool seniors quote at lunch?",
      "Cult Comedies Set in High School"),
    hint(CHARS.knight, "I seek tales told with FIGURINES, posed one frame at a time! Painstaking labor of craft, where every breath of motion is sculpted!",
      "Movies Featuring Stop-Motion Animation"),
    story(CHARS.businessman, "We pitched a sitcom once. Network notes said: more dog, less plot, add a teen. We left the room. Network bought it anyway. They were right.",
      "Pilot ordered"),
    story(CHARS.chef, "Made a Tim Burton-themed dinner. Black food, spiral pasta, weird shapes. Guests left hungry but ARTISTICALLY satisfied. I think.",
      "Five-star spooky"),
    story(CHARS.bride, "I made my fiancé learn the entire 'As If!' scene from Clueless for our engagement video. He nailed it. I might marry him after all.",
      "Sealed the deal"),
  ],

  // === 2026-05-21 | Throwback Rental Rewind =================================
  // Spielberg Directed | Time Travel Tales | Prison is the Setting | Oscar-Nominated Directorial Debuts
  '2026-05-21': [
    trivia(CHARS.vikingKidBoy, "E.T. — what candy does Elliott use to lure E.T. inside the house?",
      ["M&M's", "Reese's Pieces", "Skittles", "Hershey's Kisses"], 1),
    trivia(CHARS.businessman, "Back to the Future — what speed must the DeLorean reach to time travel?",
      ["77 mph", "88 mph", "100 mph", "120 mph"], 1),
    trivia(CHARS.farmer, "Shawshank Redemption — how long was Andy in Shawshank before his escape?",
      ["10 years", "19 years", "25 years", "30 years"], 1),
    trivia(CHARS.ninja, "Whisper... in The Sixth Sense, M. Night Shyamalan's debut feature was nominated for how many Oscars?",
      ["Three", "Six", "Eight", "Ten"], 1),
    hint(CHARS.knight, "I seek the works of the GREAT bearded one! Sharks, archaeologists, dinosaurs, soldiers — the bard who has crafted them all!",
      "Spielberg Directed"),
    hint(CHARS.punkKidBoy, "Yo I want the movies where they go BACK or FORWARD in time! Like, broken watches, weird machines, paradoxes, fixing the past!",
      "Time Travel Tales"),
    hint(CHARS.policeman, "Looking for films set behind bars — cell blocks, yard time, the warden, maybe a daring escape. Iron Bars cinema, all of it.",
      "Prison is the Setting"),
    story(CHARS.joker, "Why do all Oscar debut directors peak at the start? Because they spent THIRTY YEARS writing the script! Try doing THAT for your second one!",
      "Sophomore slump"),
    story(CHARS.oldWoman, "Dearie, I cried at E.T. in '82. I cried at E.T. in '92. I cried at the rerelease in '02. The grandkids place bets on which scene gets me first.",
      "It's always 'home'"),
    story(CHARS.bride, "Watched Back to the Future on our engagement night. My fiancé got very quiet, then said 'if I had a DeLorean, I'd marry you sooner.' Reader, I melted.",
      "Marty would approve"),
  ],
};

// ---------------------------------------------------------------------------
// Merge into interrupts.json
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
  added++;
}
console.log(`Added interrupts for ${added} puzzles (${skipped} skipped because already populated)`);

fs.writeFileSync(INTERRUPTS_PATH, JSON.stringify(interrupts, null, 2));
console.log('Wrote', INTERRUPTS_PATH);
