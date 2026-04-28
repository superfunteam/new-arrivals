// One-shot script that adds AI-written customer chat (interrupts) for the
// 14 daily puzzles 2026-04-22 → 2026-05-05 and the 20 extra-shift puzzles,
// fixes the swapped 2026-04-16 ↔ 2026-04-17 arrays, and corrects the
// punk_man → punk_men sprite references.
//
// Each puzzle gets the standard 10-item mix: 4 trivia + 3 hint + 3 story.
// Hints reference the puzzle's exact category names so the help menu can
// surface them when those categories are still unsolved.

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

  // === DAILY PUZZLES ======================================================

  '2026-04-22': [
    // Wednesday Whodunit | Someone Gets Framed | Has a Famous Dance Scene | Denzel Washington Stars | Movie is Someone's Nickname
    trivia(CHARS.policeman, "Police business — in The Fugitive, what crime is Dr. Richard Kimble wrongly convicted of?",
      ["Bank robbery", "Murdering his wife", "Insurance fraud", "Drug trafficking"], 1),
    trivia(CHARS.blueKidGirl, "OK obvious one but: in Footloose, what does the town ban?",
      ["Cars", "School dances and rock music", "Country music", "Sports"], 1),
    trivia(CHARS.vikingMan, "TELL ME, MERCHANT! In The Princess Bride, what is Inigo Montoya seeking REVENGE for?",
      ["His brother's death", "His honor", "His father's murder", "A stolen sword"], 2),
    trivia(CHARS.businessman, "Quick one for you — what year did Training Day come out?",
      ["1999", "2001", "2003", "2005"], 1),
    hint(CHARS.oldWoman, "Dearie, I want films where some poor fellow is blamed for something he didn't do, you know, on the run from the law for a crime that wasn't his...",
      "Someone Gets Framed"),
    hint(CHARS.punkWoman, "I need movies where suddenly EVERYONE is dancing and it RIPS. The kind of scene you rewind for. Big choreographed energy.",
      "Has a Famous Dance Scene"),
    hint(CHARS.firefighter, "Looking for movies with that intense actor — won the Oscar for the cop movie? He's in everything serious. Booming voice.",
      "Denzel Washington Stars"),
    story(CHARS.joker, "Why did the framed man refuse to dance? Because every time he tried — someone PINNED it on him! HA! ...okay tough crowd.",
      "I'll see myself out"),
    story(CHARS.farmer, "I rented Footloose thinkin' it was about my old tractor. Two hours of Kevin Bacon kickin' up dust later, I gotta say — kid can move.",
      "Should've read the box"),
    story(CHARS.knight, "Verily, I attempted the dance from Napoleon Dynamite at the Renaissance Faire. The lute player wept. Not from joy.",
      "A noble defeat"),
  ],

  '2026-04-23': [
    // Throwback Thursday | 90s Teen Movie | Has an Iconic Villain Speech | Based on a Disney Ride | The Dog Doesn't Make It
    trivia(CHARS.blondeKidGirl, "In She's All That, what does Freddie Prinze Jr.'s character bet he can do?",
      ["Win prom king", "Make a nerdy girl prom queen", "Get into Harvard", "Date a cheerleader"], 1),
    trivia(CHARS.joker, "In The Dark Knight, what does the Joker do with the giant pile of money at the warehouse?",
      ["Hides it in a vault", "Burns it", "Gives it to the mob", "Buys weapons with it"], 1),
    trivia(CHARS.vikingKidBoy, "OK in Pirates of the Caribbean, what is the name of Jack Sparrow's ship?",
      ["The Black Pearl", "The Flying Dutchman", "The Queen Anne's Revenge", "The Interceptor"], 0),
    trivia(CHARS.oldMan, "In Old Yeller, what kind of dog is Old Yeller?",
      ["A Labrador", "A yellow mongrel", "A Golden Retriever", "A Hound"], 1),
    hint(CHARS.blueKidGirl, "I want, like, the WHOLE 90s teen vibe — prom, the popular kids, somebody asks somebody out, fall soundtrack BANGS. You know??",
      "90s Teen Movie"),
    hint(CHARS.businessman, "I'm doing a presentation on negotiation tactics — I need movies where the bad guy gives some MONOLOGUE that's just chef's kiss. Quotable evil.",
      "Has an Iconic Villain Speech"),
    hint(CHARS.bride, "My fiancé wants something tied to the theme parks — the rides we went on for our engagement! Movies based on Disney attractions, please.",
      "Based on a Disney Ride"),
    story(CHARS.chef, "I made the mistake of watching Marley & Me with the prep team. We had to comp three desserts because everyone was crying onto the brûlée.",
      "Never again"),
    story(CHARS.punkKidBoy, "Yo my mom rented American Pie thinkin' it was a baking movie. Walked in five minutes later. We do NOT talk about it.",
      "Maximum cringe"),
    story(CHARS.firefighter, "Rookie at the firehouse asked if Jungle Cruise was a documentary. I'm gonna let him live it down. Eventually.",
      "He's learning"),
  ],

  '2026-04-24': [
    // Friday Night Frenzy | Mel Brooks Comedy | Movie Ends With a Freeze Frame | Set in Las Vegas | Director's Feature Debut
    trivia(CHARS.vikingMan, "GREAT QUESTION, MERCHANT! In Blazing Saddles, what is the name of the town being threatened by the railroad?",
      ["Tombstone", "Rock Ridge", "Deadwood", "Hadleyville"], 1),
    trivia(CHARS.chef, "In Spaceballs, what's the name of the planet whose air is being stolen?",
      ["Druidia", "Spaceball One", "Vega", "Planet Mel"], 0),
    trivia(CHARS.oldWoman, "Dear, in The Hangover, what city do the boys lose their friend in?",
      ["Atlantic City", "Reno", "Las Vegas", "Los Angeles"], 2),
    trivia(CHARS.punkMan, "Reservoir Dogs — Tarantino's debut. What color is NOT one of the heist crew's code names?",
      ["Mr. Pink", "Mr. White", "Mr. Black", "Mr. Blonde"], 2),
    hint(CHARS.knight, "I seek the works of the great jester Brooks! Films of MIRTH and parody, where every scene mocks the genre it lives within!",
      "Mel Brooks Comedy"),
    hint(CHARS.blueWoman, "I'm into films where the final shot just... freezes. Like, the movie commits to one image and rolls credits over it. Real artsy stuff.",
      "Movie Ends With a Freeze Frame"),
    hint(CHARS.businessman, "I'm planning a bachelor party themed movie night — neon lights, casinos, bad decisions. Sin City vibes only.",
      "Set in Las Vegas"),
    story(CHARS.joker, "Why are first-time directors like a freezer-burned VHS? They both make their DEBUT a little rough! ...I'll keep working on it.",
      "Sigh"),
    story(CHARS.bride, "We almost had our reception in Vegas. Then I watched The Hangover. Then I rewatched it. Then we booked Vegas anyway.",
      "Worth the risk"),
    story(CHARS.farmer, "My nephew showed me Young Frankenstein. I haven't laughed that hard since the rooster fell in the silo. PUT THE CANDLE BACK.",
      "Ha! Classic"),
  ],

  '2026-04-25': [
    // Saturday Matinee | Family Road Trip | Takes Place on an Island | Harrison Ford Stars | Ends With the Bad Guy Winning
    trivia(CHARS.blondeKidGirl, "In Little Miss Sunshine, what kind of vehicle does the family drive?",
      ["A station wagon", "A yellow VW bus", "A pickup truck", "An RV"], 1),
    trivia(CHARS.vikingKidBoy, "In Jurassic Park, what's the name of the island where the dinosaurs live?",
      ["Isla Sorna", "Isla Nublar", "Skull Island", "Isla del Coco"], 1),
    trivia(CHARS.businessman, "In Raiders of the Lost Ark, what is Indiana Jones afraid of?",
      ["Heights", "Snakes", "Spiders", "Tight spaces"], 1),
    trivia(CHARS.ninja, "Whisper it... in Se7en, what is in the box at the end?",
      ["Jewelry", "His wife's head", "A bomb", "Cash"], 1),
    hint(CHARS.farmer, "I want movies where a family piles into a vehicle and EVERYTHING goes wrong on the way somewhere. Kids fightin', dad drivin' too long, the works.",
      "Family Road Trip"),
    hint(CHARS.firefighter, "Need movies with people stuck on an island. Could be vacation gone bad, could be a survival thing, could be dinosaurs — open to it all.",
      "Takes Place on an Island"),
    hint(CHARS.oldMan, "That fellow with the hat and the whip... no wait, also the spaceship one... and the cop on the run... I want HIS movies. He's been around forever.",
      "Harrison Ford Stars"),
    story(CHARS.bride, "My honeymoon was a road trip to the coast. Halfway there, my husband insisted on watching National Lampoon's Vacation in the motel. Foreshadowing.",
      "Should've known"),
    story(CHARS.joker, "Why did the bad guy win at the end of the movie? Because the screenwriter wanted you to leave SAD! Art, baby!",
      "Brutal but true"),
    story(CHARS.knightKid, "I asked dad if we could take a road trip. He said only if I promised not to do the Are We There Yet bit. I made it eleven minutes.",
      "Personal best"),
  ],

  '2026-04-26': [
    // Sunday Slow Burn | Eddie Murphy Classic | Color in the Title | Won the Palme d'Or | Famous Misquoted Line
    trivia(CHARS.punkWoman, "In Coming to America, what fictional African country is Prince Akeem from?",
      ["Wakanda", "Zamunda", "Genovia", "Kalabar"], 1),
    trivia(CHARS.blondeMan, "Trading Places — Eddie Murphy and Dan Aykroyd swap lives because of a bet for HOW much?",
      ["A million dollars", "One dollar", "A hundred grand", "A penny"], 1),
    trivia(CHARS.vikingMan, "MERCHANT! In Pulp Fiction, who plays Vincent Vega?",
      ["Samuel L. Jackson", "Bruce Willis", "John Travolta", "Tim Roth"], 2),
    trivia(CHARS.oldMan, "Trick question — in Casablanca, does anyone actually say 'Play it again, Sam'?",
      ["Yes, Bogart says it", "No, it's a misquote", "Yes, Bergman says it", "Yes, Sam himself says it"], 1),
    hint(CHARS.policeman, "Looking for movies with that comedian who does the laugh, the SNL guy turned movie star — Beverly Hills, Donkey from Shrek, that one.",
      "Eddie Murphy Classic"),
    hint(CHARS.chef, "I'm hosting a colorful dinner party — need movie titles that have a color in the name. Going for a chromatic vibe.",
      "Color in the Title"),
    hint(CHARS.blueWoman, "I want the prestige stuff — top prize at Cannes, you know? Critics-darling territory, the film snob stuff.",
      "Won the Palme d'Or"),
    story(CHARS.joker, "Why is Casablanca like a misquoted joke? Because here's looking at you, kid — even though they NEVER said it that way! Cinema!",
      "I should be in pictures"),
    story(CHARS.punkMan, "Watched Trading Places with my landlord. He didn't get it. He's still my landlord. Maybe there's a lesson here.",
      "There isn't"),
    story(CHARS.knight, "I tried to quote Casablanca to my lady fair. I said 'play it again, Sam.' She corrected me. She always corrects me.",
      "She is well-read"),
  ],

  '2026-04-27': [
    // Monday Morning Grind | Ben Stiller Comedy | Set in a Hospital | Features a Courtroom Scene | Title is Two First Names
    trivia(CHARS.blondeWoman, "In Meet the Parents, what is Greg Focker's first name actually short for?",
      ["Gregory", "Gaylord", "Gregor", "Greggory"], 1),
    trivia(CHARS.vikingMan, "ZOOLANDER! What is Derek Zoolander's signature look called?",
      ["Magnum", "Blue Steel", "Iron Eyes", "Le Tigre"], 1),
    trivia(CHARS.policeman, "By the book — in A Few Good Men, what does Jack Nicholson famously yell?",
      ["You can't prove a thing!", "I want my lawyer!", "You can't handle the truth!", "Order in the court!"], 2),
    trivia(CHARS.oldWoman, "Dear, in My Cousin Vinny, what state is the trial in?",
      ["Mississippi", "Alabama", "Georgia", "Louisiana"], 1),
    hint(CHARS.punkKidBoy, "Yo I want the goofy guy from Night at the Museum, the one in like every dumb-funny comedy. Real awkward energy.",
      "Ben Stiller Comedy"),
    hint(CHARS.firefighter, "Looking for movies where most of the action goes down in a hospital — wards, surgery rooms, that sterile vibe.",
      "Set in a Hospital"),
    hint(CHARS.businessman, "I'm prepping mock trial — I need films with a really good courtroom scene. Lawyer drama, big cross-examination moments.",
      "Features a Courtroom Scene"),
    story(CHARS.joker, "Why is My Cousin Vinny the perfect courtroom movie? Because you're guilty of LAUGHING the whole time! Order, order!",
      "Bailiff please"),
    story(CHARS.bride, "My future mother-in-law made us watch Meet the Parents before our first dinner together. I have NEVER been more nervous about a meal.",
      "Survived it"),
    story(CHARS.farmer, "Tried to follow My Cousin Vinny's car identification scene with my truck. Cousin Marisa would NOT have been impressed.",
      "I tried"),
  ],

  '2026-04-28': [
    // Tuesday Tape Drop | Takes Place in a School | Leonardo DiCaprio Stars | Monster Movie | Has a Montage Set to Music
    trivia(CHARS.knightKid, "In Harry Potter and the Sorcerer's Stone, what house is Harry sorted into?",
      ["Slytherin", "Gryffindor", "Ravenclaw", "Hufflepuff"], 1),
    trivia(CHARS.businessman, "In Titanic, what does Rose say to Jack at the end before letting go?",
      ["Goodbye, Jack", "I love you", "I'll never let go", "I'll come back for you"], 2),
    trivia(CHARS.vikingMan, "GREMLINS! What is the FIRST rule about Mogwai?",
      ["Don't get them wet", "Don't expose them to bright light", "Don't feed them after midnight", "Don't sing to them"], 1),
    trivia(CHARS.punkWoman, "Dirty Dancing — what's the iconic line nobody puts Baby in?",
      ["The chair", "A cage", "The corner", "The kitchen"], 2),
    hint(CHARS.knight, "I seek tales set within halls of learning — desks, lockers, chalkboards. The young ones in their daily struggles.",
      "Takes Place in a School"),
    hint(CHARS.blueWoman, "Need that DiCaprio range — he can do romance, mob, con artist, climate doc. Just any of his stuff really.",
      "Leonardo DiCaprio Stars"),
    hint(CHARS.oldMan, "Got a craving for the classic monster picture. Big creature, town's in danger, hero with a gun or a flamethrower. Drive-in stuff.",
      "Monster Movie"),
    story(CHARS.firefighter, "Got called to a sorority house — they were watching Titanic and hit the iceberg scene at full volume. Neighbors thought the BUILDING was sinking.",
      "False alarm"),
    story(CHARS.joker, "Why did the Gremlins go to the gym? To work on their MOG-WAIST! ...okay, that one was a stretch even for me.",
      "Brutal"),
    story(CHARS.chef, "I rented Top Gun thinkin' the volleyball scene was about cooking competitions. Walked away with a confused appetite and Kenny Loggins stuck in my head.",
      "Highway to the diner zone"),
  ],

  '2026-04-29': [
    // Hump Day Hustle | Buddy Cop Movie | Shot in Black and White | Famous Last Line | Food in the Title
    trivia(CHARS.policeman, "Lethal Weapon — Riggs and Murtaugh's first names?",
      ["Mike and Joe", "Martin and Roger", "Frank and Lou", "Sam and Ed"], 1),
    trivia(CHARS.vikingMan, "TERMINATOR! What does Arnold say he'll do?",
      ["I will return", "I'll be back", "I'm coming back", "I shall return"], 1),
    trivia(CHARS.oldWoman, "Dearie, in Casablanca, what does Rick say at the very end of the picture?",
      ["Here's looking at you, kid", "Round up the usual suspects", "We'll always have Paris", "This is the beginning of a beautiful friendship"], 3),
    trivia(CHARS.chef, "Willy Wonka & the Chocolate Factory — what color is Violet Beauregarde turned into?",
      ["Red", "Green", "Blueberry blue", "Purple"], 2),
    hint(CHARS.firefighter, "I want those movies where two cops are forced to partner up and HATE each other at first. Action, banter, eventually they're best friends.",
      "Buddy Cop Movie"),
    hint(CHARS.blueWoman, "Need black-and-white films, the artistic ones — stark, classic, no color. Looking for the cinematography flex.",
      "Shot in Black and White"),
    hint(CHARS.knight, "I seek tales whose final spoken words are remembered through the ages! The closing line, etched in cinematic legend!",
      "Famous Last Line"),
    story(CHARS.joker, "Why did the buddy cops break up? CREATIVE differences. One was lethal, the other had four days till retirement. Classic burnout!",
      "I should write screenplays"),
    story(CHARS.farmer, "Wife and I watch one black-and-white picture every Sunday. Last week we did Psycho. She has not taken a shower since. Concerning.",
      "I'm worried"),
    story(CHARS.bride, "We had a buddy-cop themed bachelor party. My fiancé and his best man both showed up in Hawaiian shirts and shoulder holsters. The bartender was unimpressed.",
      "He loved it though"),
  ],

  '2026-04-30': [
    // End of Month Inventory | Sandra Bullock Movie | Has a Training Montage | Set in the 1950s | Had a Famous Ad-Lib
    trivia(CHARS.policeman, "In Speed, what speed must the bus stay above to avoid the bomb?",
      ["55 mph", "50 mph", "60 mph", "65 mph"], 1),
    trivia(CHARS.vikingMan, "ROCKY! How does Rocky train at the top of the steps?",
      ["He punches the air", "He raises his arms in triumph", "He runs in place", "He yells for Adrian"], 1),
    trivia(CHARS.chef, "Back to the Future — what year does Marty travel back to?",
      ["1945", "1955", "1965", "1975"], 1),
    trivia(CHARS.joker, "JAWS! What's the famous ad-libbed line about needing a bigger something?",
      ["You're gonna need a bigger gun", "We're gonna need a bigger boat", "This calls for a bigger net", "Get me a bigger bottle"], 1),
    hint(CHARS.bride, "I want the romcom queen — the woman who's been every kind of leading lady, charming and tough at the same time.",
      "Sandra Bullock Movie"),
    hint(CHARS.vikingKidBoy, "I want movies with the GETTING STRONG sequence! You know — pushups, punching the bag, running stairs while drum music goes!",
      "Has a Training Montage"),
    hint(CHARS.oldMan, "Take me back to my era — soda fountains, hot rods, jukeboxes, drive-ins. Movies set in the fifties. The good days.",
      "Set in the 1950s"),
    story(CHARS.farmer, "Tried to do the Rocky stair run on the silo ladder. Got halfway up, realized the silo doesn't have a montage music budget, came right back down.",
      "Need a soundtrack"),
    story(CHARS.joker, "Why are ad-libs the best lines? Because the script SAID 'be afraid' but the actor SAID 'we're gonna need a bigger boat.' That's IMPROV magic!",
      "Yes Spielberg"),
    story(CHARS.blondeWoman, "I tried Sandra Bullock's Miss Congeniality walk for a wedding rehearsal. Did the snort-laugh too. Best maid of honor speech ever.",
      "Stuck the landing"),
  ],

  '2026-05-01': [
    // May Day Mayhem | Disaster Movie | Has an Unreliable Narrator | Spielberg Directed | Based on a Board Game or Toy
    trivia(CHARS.firefighter, "In Twister, what do storm chasers call the device they're trying to deploy?",
      ["Tornado", "Dorothy", "Twister", "Funnel"], 1),
    trivia(CHARS.ninja, "Whisper... in Fight Club, the first rule is...",
      ["You don't talk about Fight Club", "Bring your own gloves", "No weapons", "Be on time"], 0),
    trivia(CHARS.vikingMan, "JURASSIC PARK! What kind of dinosaur first attacks the kids in the Jeep?",
      ["Velociraptor", "Brachiosaurus", "Tyrannosaurus rex", "Dilophosaurus"], 2),
    trivia(CHARS.businessman, "Battleship — what is the catch phrase from the actual board game?",
      ["I sunk your ship!", "You sank my battleship!", "Direct hit!", "All systems down!"], 1),
    hint(CHARS.firefighter, "I want chaos — earthquakes, tornadoes, volcanoes, ice ages. A whole city in trouble, hero saves the day. Big effects.",
      "Disaster Movie"),
    hint(CHARS.blueWoman, "Looking for movies where the person telling the story is LYING to you the whole time. Big twist when you realize they're not reliable.",
      "Has an Unreliable Narrator"),
    hint(CHARS.knight, "I seek the works of the GREAT Beard! The director who taught us to fear the deep, to wonder at the stars, to weep for our pets!",
      "Spielberg Directed"),
    story(CHARS.joker, "Why are board game movies always disasters? Because someone read the BOX and said 'YES, THIS will move tickets!' Cinema is a roll of the dice!",
      "Pun intended"),
    story(CHARS.farmer, "Watched Twister with the storm-spotter club. Halfway through someone yelled 'COW!' real loud and three people spilled their popcorn. Worth it.",
      "Best Tuesday in years"),
    story(CHARS.goblinKid, "I asked mom if WE could go in the storm cellar like in Twister! She said NO! I said BUT THE COW! She said NO COWS LIVE HERE!",
      "Mom is wrong"),
  ],

  '2026-05-02': [
    // Saturday Sleepover | Animated Pixar Film | Famous Movie Couple | Whole Movie in Real Time | Movie Within a Movie
    trivia(CHARS.blueKidGirl, "In Finding Nemo, what kind of fish is Nemo?",
      ["Blue tang", "Clownfish", "Angelfish", "Sailfish"], 1),
    trivia(CHARS.vikingKidBoy, "What's the dog's name in Up?",
      ["Rex", "Russell", "Dug", "Carl"], 2),
    trivia(CHARS.bride, "In The Notebook, the lead couple's names are...?",
      ["Rose and Jack", "Allie and Noah", "Hannah and Adam", "Sarah and Tom"], 1),
    trivia(CHARS.policeman, "12 Angry Men takes place mostly in one room. WHICH room?",
      ["A police station", "A jury deliberation room", "A judge's chambers", "A courtroom"], 1),
    hint(CHARS.knightKid, "I want the kid-favorite cartoons! The studio with the lamp! The ones that make my dad cry in the first ten minutes!",
      "Animated Pixar Film"),
    hint(CHARS.bride, "I want the absolute most iconic movie couples — the ones you write essays about, where the romance is the whole point.",
      "Famous Movie Couple"),
    hint(CHARS.businessman, "Need films where the whole movie happens in real-time, no time skips. Watch goes from 2pm to 4pm both onscreen and on my wrist.",
      "Whole Movie in Real Time"),
    story(CHARS.joker, "Why did the movie within a movie need a movie within a movie? Because it was Adapt-AT-INCEPTION! ...look, layered film theory is HARD.",
      "Christopher Nolan would laugh"),
    story(CHARS.chef, "I had my staff watch Ratatouille for inspiration. Now half of them think a rat is going to crawl in tonight and rescue the soufflé. The other half quit.",
      "Service is doomed"),
    story(CHARS.oldWoman, "Watched The Notebook with my book club. Five widows, eight tissues, two arguments about whether real love exists. Tuesdays are intense.",
      "Pass the chardonnay"),
  ],

  '2026-05-03': [
    // Sunday Cinema | Samuel L. Jackson Yells | Set During Christmas | Band or Musician Biopic | Has a Mid-Credits or Post-Credits Scene
    trivia(CHARS.vikingMan, "PULP FICTION! Samuel L. Jackson recites a passage from what biblical book?",
      ["Revelation", "Ezekiel", "Genesis", "Psalms"], 1),
    trivia(CHARS.policeman, "Die Hard — what building is John McClane trying to save?",
      ["The Empire State Building", "Nakatomi Plaza", "City Hall", "The Chrysler Building"], 1),
    trivia(CHARS.businessman, "Walk the Line is about which musician?",
      ["Elvis Presley", "Johnny Cash", "Buddy Holly", "Hank Williams"], 1),
    trivia(CHARS.goblinKid, "FERRIS BUELLER! After the credits, what does Ferris tell the audience?",
      ["See you tomorrow", "You're still here? It's over. Go home.", "I'll be back", "Save Ferris"], 1),
    hint(CHARS.farmer, "I want the loud-talking actor — purple lightsaber, snakes on a plane, the man can YELL. Most quotable man alive.",
      "Samuel L. Jackson Yells"),
    hint(CHARS.bride, "Movies set during the holidays — Christmas trees, snow, family chaos. Even the action ones count if Santa is anywhere on screen.",
      "Set During Christmas"),
    hint(CHARS.blueWoman, "I want the music biopics — the rise, the fall, the addiction arc, the redemption tour. Real artists, real-life drama.",
      "Band or Musician Biopic"),
    story(CHARS.joker, "Why do I always sit through the credits? Because every Marvel movie taught me FOMO is real! Bathroom can wait, the post-credits cannot!",
      "Bladder of steel"),
    story(CHARS.firefighter, "Coworker insists Die Hard is a Christmas movie. Other coworker insists it's not. We solved it by watching it every December for ten years. Verdict: yes.",
      "Yippee ki-yay"),
    story(CHARS.punkKidBoy, "I quoted Samuel L. Jackson at the bus driver. Loud. He just looked at me. Just LOOKED. Worst day of my life.",
      "Never again"),
  ],

  '2026-05-04': [
    // May the Fourth | George Lucas Involvement | Has a Lightsaber (or Laser Sword) | Famous Movie Robot | Han Solo Would Love This
    trivia(CHARS.knightKid, "Star Wars original — what's the moisture farmer's name who raises Luke?",
      ["Uncle Ben", "Uncle Owen", "Uncle Phil", "Uncle Mort"], 1),
    trivia(CHARS.vikingMan, "EMPIRE STRIKES BACK! What does Vader say to Luke in the famous scene?",
      ["Luke, I am your father", "I am your father", "You will join me, Luke", "Luke, search your feelings"], 1),
    trivia(CHARS.businessman, "WALL-E — what does WALL-E stand for?",
      ["Waste Allocation Load Lifter Earth-class", "World Active Linguistic Learner Earth", "Watch and Linger Long Earth-Edition", "Waste Avoiding Living Lifter Earth"], 0),
    trivia(CHARS.farmer, "Smokey and the Bandit — what's the Bandit smuggling across state lines?",
      ["Whiskey", "Coors beer", "Cigarettes", "Moonshine"], 1),
    hint(CHARS.knight, "I seek the works of the GREAT Beardless Bearded One — Lucas! Director, producer, creator of galaxies far away.",
      "George Lucas Involvement"),
    hint(CHARS.vikingKidBoy, "I want the SWORDS made of LIGHT! Or laser swords! Anything where the hero swings a glowing blade and it goes WHOOM!",
      "Has a Lightsaber (or Laser Sword)"),
    hint(CHARS.goblinKid, "I want movies with COOL ROBOTS! The famous ones! T-800, the cube guy, the little binocular one, the metal one with the heart!",
      "Famous Movie Robot"),
    story(CHARS.joker, "Why does Han Solo love a good road movie? Because he never tells you the ODDS, just the BAUD! ...okay that one was modem-era.",
      "Update your hardware"),
    story(CHARS.policeman, "Pulled a guy over doing 95 on the highway. Asked his name. He said 'Bandit.' I said 'license please, Bo.' He laughed. I laughed. I still wrote the ticket.",
      "Smokey wins"),
    story(CHARS.bride, "My fiancé wants Star Wars at the wedding. I want Pretty Woman. We are negotiating with all the seriousness of treaty signatories.",
      "May the Force compromise"),
  ],

  '2026-05-05': [
    // Cinco de Cinema | Set in a Desert | Features Twins | Quentin Tarantino Movie | Title Sounds Like a Question
    trivia(CHARS.vikingMan, "MAD MAX FURY ROAD! What does Immortan Joe ride into battle on?",
      ["A motorcycle", "A war rig", "A horse", "A monster truck"], 1),
    trivia(CHARS.blondeWoman, "In The Parent Trap, where do the twins meet?",
      ["Boarding school", "Summer camp", "A mall", "A wedding"], 1),
    trivia(CHARS.punkWoman, "Kill Bill — what's the name of the bride's hit list?",
      ["The Five Vipers", "The Death List Five", "The Final Five", "The Bride's Revenge"], 1),
    trivia(CHARS.joker, "Dude, Where's My Car? Famous catchphrase response when you ask a question?",
      ["What?", "And then?", "Sweet!", "Whatever"], 2),
    hint(CHARS.farmer, "Looking for movies set out in the deep desert — sand, sun, no water for miles. Could be a chase, could be archeology, could be camels.",
      "Set in a Desert"),
    hint(CHARS.bride, "Movies featuring TWINS as a major part of the plot — identical, fraternal, evil twin twist, doesn't matter as long as there's two.",
      "Features Twins"),
    hint(CHARS.punkMan, "I want the Tarantino joints. You know — non-linear, soundtrack rips, dialogue goes off, and somebody bleeds out by minute 90.",
      "Quentin Tarantino Movie"),
    story(CHARS.joker, "Why are question-mark movies the best? Because the title is doing the WORK for the trailer! What about Bob? Who knows!? Who CARES!?",
      "Sold tickets, didn't it"),
    story(CHARS.chef, "Tried to make tacos while watching Django Unchained. Spilled hot sauce in three places, screamed twice, and gave the cat a heart attack. 10/10.",
      "Quentin would approve"),
    story(CHARS.vikingWoman, "I gave my twin sister a copy of Twins. She gave me back a copy of Dead Ringers. We have not spoken since.",
      "She knows what she did"),
  ],

  // === EXTRA SHIFT PUZZLES =================================================

  'extra-shift-1': [
    // The Midnight Marathon | The Hero Dies | Title Has a Number | Based on a True Story | Directed by Ridley Scott
    trivia(CHARS.vikingMan, "GLADIATOR! What is Maximus's full name in Latin?",
      ["Maximus Decimus Meridius", "Marcus Aurelius Maximus", "Maximus Aurelius Romanus", "Maximus Caesar Decimus"], 0),
    trivia(CHARS.businessman, "Apollo 13 — what famous understatement does the crew transmit?",
      ["We have a problem", "Houston, we have a problem", "We have a malfunction", "Mission abort"], 1),
    trivia(CHARS.ninja, "Whisper... in Se7en, the killer's name is...",
      ["Jigsaw", "John Doe", "Hannibal", "Buffalo Bill"], 1),
    trivia(CHARS.farmer, "BLADE RUNNER — Ridley Scott. Replicants are hunted by what kind of cop?",
      ["Hunters", "Replicant Officers", "Blade Runners", "Cleaners"], 2),
    hint(CHARS.knight, "I seek tales where the hero meets a NOBLE END! Sacrifice, glory, the final breath as the music swells. No happy walks into the sunset!",
      "The Hero Dies"),
    hint(CHARS.businessman, "Movies whose titles have a number in them — could be sevens, sixes, elevens, thirteens. I'm cataloging by digit, weird hobby.",
      "Title Has a Number"),
    hint(CHARS.oldMan, "I want the based-on-real-events stuff. Could be inspirational, could be tragic. Just want to know it actually HAPPENED.",
      "Based on a True Story"),
    story(CHARS.joker, "Why is Ridley Scott's number one rule? Always have a CAT in the spaceship! Saved the budget on extras AND scares! Genius!",
      "Cinema 101"),
    story(CHARS.farmer, "Watched Gladiator with the boys. By the end we were all yellin' STRENGTH AND HONOR at the dog. Dog wasn't impressed.",
      "Tough crowd"),
    story(CHARS.firefighter, "Captain made us watch Apollo 13 for 'team-building.' Now everyone says HOUSTON WE HAVE A PROBLEM when the coffee maker breaks. Great.",
      "Send a rescue"),
  ],

  'extra-shift-2': [
    // Double Feature Friday | Takes Place in Space | Robin Williams Stars | Won Best Picture | Has a Twist Ending
    trivia(CHARS.vikingKidBoy, "Star Wars — what's Han Solo's ship?",
      ["Slave I", "The Millennium Falcon", "The Razor Crest", "The Ghost"], 1),
    trivia(CHARS.oldMan, "Good Will Hunting — what's Will Hunting's job at the start?",
      ["Bartender", "Teacher's aide", "MIT janitor", "Construction worker"], 2),
    trivia(CHARS.joker, "FORREST GUMP! What does Forrest's mom say life is like?",
      ["A box of chocolates", "A long walk", "A bowl of grits", "A movie"], 0),
    trivia(CHARS.ninja, "Whisper... in Fight Club, who is Tyler Durden REALLY?",
      ["The Narrator's brother", "An imaginary alter ego of the Narrator", "An old friend", "A real person they both know"], 1),
    hint(CHARS.knight, "I seek tales among the STARS! Spaceships, alien planets, the cold dark of the void! Anywhere but a ground-level setting.",
      "Takes Place in Space"),
    hint(CHARS.bride, "Looking for that one comedian — could go from manic improv to deeply heartbreaking dramatic in the same scene. Voice of a generation.",
      "Robin Williams Stars"),
    hint(CHARS.businessman, "Need the Best Picture winners — the Academy gold standard. Want to fill in some blind spots from my Oscar marathon list.",
      "Won Best Picture"),
    story(CHARS.joker, "Why was the twist ending so SHOCKING? Because the screenwriter didn't tell the AUDIENCE the rules! That's just CHEATING. ...also brilliant.",
      "M. Night approves"),
    story(CHARS.chef, "Watched Good Will Hunting and now I write differential equations on the kitchen blackboard. Sous chef thinks I've cracked. Maybe.",
      "How do you like them apples"),
    story(CHARS.punkWoman, "Saw Fight Club at 16 and made the worst decisions of my life for two years. Recommend... not... watching it that young.",
      "Lessons learned"),
  ],

  'extra-shift-3': [
    // Rewind Required | One-Word Title | Tom Hanks Leads | Set in High School | Villain is a Machine
    trivia(CHARS.vikingMan, "JAWS! What does Quint famously say is the only sound a shark makes?",
      ["The roar", "Nothing — silent", "Splashing", "The crunch"], 1),
    trivia(CHARS.farmer, "Cast Away — what's the volleyball's name?",
      ["Spalding", "Wilson", "Buddy", "Companion"], 1),
    trivia(CHARS.blondeKidGirl, "The Breakfast Club — they're in detention on what day of the week?",
      ["Friday", "Saturday", "Sunday", "Monday"], 1),
    trivia(CHARS.punkMan, "Terminator — what year does Skynet become self-aware (in T2)?",
      ["1995", "1997", "1999", "2001"], 1),
    hint(CHARS.businessman, "Looking for movies whose ENTIRE title is a single word. Punchy, iconic, no subtitle, no franchise — just one word.",
      "One-Word Title"),
    hint(CHARS.bride, "Want America's dad — the Oscars guy who can do astronaut, lawyer, war hero, FedEx delivery man, all of it. Reliable Tom.",
      "Tom Hanks Leads"),
    hint(CHARS.knight, "I seek tales of villainous MACHINES! Where the antagonist is not flesh but circuitry — a dread invention turned to evil.",
      "Villain is a Machine"),
    story(CHARS.joker, "Why is Wilson the best supporting actor of all time? Because he NEVER asked for top billing! Just float, Wilson, just float!",
      "Volleyball mvp"),
    story(CHARS.policeman, "Saw The Breakfast Club at the academy. Now we can't run Saturday detail without quoting it. Dispatch is fed up.",
      "Don't you forget about me"),
    story(CHARS.chef, "Watched Cast Away. Now every coconut that comes through the kitchen, I look at it differently. With respect. With understanding.",
      "Wilson would approve"),
  ],

  'extra-shift-4': [
    // Staff Picks Wall | Jim Carrey Vehicle | Heist Movie | Soundtrack is Iconic | Set During a War
    trivia(CHARS.joker, "JIM CARREY! In The Mask, what's Stanley's dog's name?",
      ["Max", "Milo", "Buddy", "Rocky"], 1),
    trivia(CHARS.businessman, "The Italian Job — what kind of cars do they use for the heist?",
      ["Mini Coopers", "BMWs", "Ferraris", "VW Beetles"], 0),
    trivia(CHARS.vikingMan, "PULP FICTION! What dance does Vincent and Mia do at Jack Rabbit Slim's?",
      ["The Charleston", "The Twist", "The Mashed Potato", "The Lindy Hop"], 1),
    trivia(CHARS.firefighter, "Apocalypse Now — what's Colonel Kurtz's famous final word?",
      ["Mother", "Death", "The horror", "Mercy"], 2),
    hint(CHARS.punkKidBoy, "I want the rubber-face guy! The one who can do all the WACKY stuff with his mouth and eyes and body — comedy on overdrive!",
      "Jim Carrey Vehicle"),
    hint(CHARS.businessman, "Need heist movies — planning, montage, the score, the double-cross, the getaway. A whole ensemble robbing one big thing.",
      "Heist Movie"),
    hint(CHARS.blueWoman, "I want movies where the SOUNDTRACK is half the experience. Open the album and you're back in the theater. Iconic needle drops.",
      "Soundtrack is Iconic"),
    story(CHARS.joker, "Why are heist movies always two and a half hours? Because half is PLANNING, half is HEISTING, and half is GETTING AWAY! ...wait, that's three halves. Math is hard.",
      "Cut me a check"),
    story(CHARS.knight, "Verily, I was forced into a Jim Carrey marathon by my squire. By film three I had become him. I cannot stop the eyebrow.",
      "Curse you, Carrey"),
    story(CHARS.firefighter, "Department made us watch Apocalypse Now for 'context.' One guy now smells napalm in the morning, says he loves it. We're worried.",
      "Reassign him"),
  ],

  'extra-shift-5': [
    // Late Return Fees | Starts With 'The' | Will Smith Era | Features a Wedding | Sequel Outdid the Original
    trivia(CHARS.vikingMan, "THE FUGITIVE! What is Dr. Kimble's wife's killer missing?",
      ["A finger", "An eye", "An arm", "A leg"], 2),
    trivia(CHARS.policeman, "Independence Day — what date does the alien attack happen on?",
      ["July 2nd", "July 3rd", "July 4th", "July 5th"], 1),
    trivia(CHARS.bride, "The Wedding Singer — what is Robbie Hart's dream career?",
      ["Movie star", "Rock star", "Wedding planner", "Comedian"], 1),
    trivia(CHARS.businessman, "Empire Strikes Back ranks above Star Wars for many fans. What's the planet of the AT-AT battle?",
      ["Tatooine", "Hoth", "Endor", "Dagobah"], 1),
    hint(CHARS.knight, "I seek titles that begin with THE! The this, The that, The other! Definite articles, definite movies!",
      "Starts With 'The'"),
    hint(CHARS.punkKidBoy, "Yo I want the Fresh Prince era — the cocky young leading-man Will Smith stuff. Aliens, agents, summer blockbuster vibes.",
      "Will Smith Era"),
    hint(CHARS.bride, "Looking for movies where there's an actual WEDDING on screen — ceremony, reception, dramatic objection, the works.",
      "Features a Wedding"),
    story(CHARS.joker, "Why is Empire Strikes Back better than Star Wars? Because the SEQUEL knew it had to TRY! No pressure being second!",
      "Hot take"),
    story(CHARS.bride, "I made my wedding playlist during my third Wedding Singer rewatch. Six Adam Sandler songs made it onto the cocktail hour. Husband still hasn't forgiven me.",
      "Worth it"),
    story(CHARS.farmer, "Independence Day comes on TV every July, and every July I make tri-tip and yell WELCOME TO EARTH at the screen. Tradition.",
      "America"),
  ],

  'extra-shift-6': [
    // The Bargain Bin | Adam Sandler Classic | Animal in the Title | Set in New York City | Director Also Stars in It
    trivia(CHARS.punkKidBoy, "Billy Madison — what does Billy have to do to inherit the hotel chain?",
      ["Pass a math test", "Repeat grades 1-12 in two weeks", "Marry a stranger", "Run a hotel for a year"], 1),
    trivia(CHARS.vikingMan, "SNAKES ON A PLANE! What's Samuel L. Jackson's character's profession?",
      ["FBI agent", "DEA agent", "U.S. Marshal", "TSA agent"], 0),
    trivia(CHARS.policeman, "Taxi Driver — what does Travis Bickle do for a living?",
      ["Cop", "Cab driver", "Bartender", "Doorman"], 1),
    trivia(CHARS.oldMan, "Goodfellas was directed by AND starred... wait, no, it was Rocky! Who directed AND starred in Rocky?",
      ["Robert De Niro", "Sylvester Stallone", "John Avildsen", "Sergio Leone"], 1),
    hint(CHARS.punkWoman, "I want the Sandler classics — voice-cracking yelling, sports comedies, romcoms with a heart. Happy Madison era stuff.",
      "Adam Sandler Classic"),
    hint(CHARS.farmer, "I want movies with a critter in the title. Could be the lead, could be a metaphor, could be a code name. Just animals on the cover.",
      "Animal in the Title"),
    hint(CHARS.businessman, "Movies set in New York — skyline shots, taxi cabs, the energy. Manhattan as a character. Bonus if there's a montage.",
      "Set in New York City"),
    story(CHARS.joker, "Why do directors put themselves in their own movies? Because they finally found someone who'll do EXACTLY what they say! Genius casting!",
      "Stay in your lane"),
    story(CHARS.bride, "Got married in Manhattan. Wedding photographer kept doing the Taxi Driver 'you talkin' to me' bit at us during portraits. Got fired mid-shoot.",
      "No tip"),
    story(CHARS.chef, "Tried Adam Sandler's Big Daddy parenting techniques on my new line cook. He ended up wearing an oversized hoodie and crying. Effective somehow.",
      "Promote him"),
  ],

  'extra-shift-7': [
    // Be Kind, Rewind | Has a Car Chase | Morgan Freeman Narrates | Takes Place on a Boat | Features Time Travel
    trivia(CHARS.policeman, "Bullitt — what's the iconic car?",
      ["A Ford Mustang GT", "A Chevy Camaro", "A Dodge Charger", "A Pontiac GTO"], 0),
    trivia(CHARS.farmer, "Shawshank Redemption — what does Andy use to escape?",
      ["A spoon", "A rock hammer hidden in a Bible", "A pickaxe", "A drill"], 1),
    trivia(CHARS.vikingMan, "TITANIC! How many people fit on the door at the end?",
      ["Just Rose", "Just Jack", "Both of them, easily — that's the controversy", "Three"], 2),
    trivia(CHARS.knightKid, "Back to the Future — what speed does the DeLorean need to hit?",
      ["77 mph", "88 mph", "99 mph", "100 mph"], 1),
    hint(CHARS.firefighter, "I want movies with a CAR CHASE — tires squealing, side mirrors flying, somebody jumps a bridge. The longer the chase, the better.",
      "Has a Car Chase"),
    hint(CHARS.knight, "I seek tales narrated by THE Voice — wise, calm, golden. The man who could read a takeout menu and make it profound.",
      "Morgan Freeman Narrates"),
    hint(CHARS.bride, "Want movies set on a BOAT — cruise ships, submarines, sailboats, pirate ships. Whole story floats from start to finish.",
      "Takes Place on a Boat"),
    story(CHARS.joker, "Why is time travel always a mess? Because the rules CHANGE in every movie! Some say one thing, some say another! Pick a paradox already!",
      "Sci-fi committee"),
    story(CHARS.farmer, "Tried to drive my truck like Bullitt. Got pulled over in three minutes. Officer said 'this ain't San Francisco.' Fair point.",
      "Worth a shot"),
    story(CHARS.oldWoman, "Dearie, I watched Titanic seven times. James Cameron is correct — there was room on that door. I will die on this hill.",
      "And I will float"),
  ],

  'extra-shift-8': [
    // Employee Discount | Nicolas Cage Goes Big | Sports Movie | Takes Place in a Prison | Last Movie in a Trilogy
    trivia(CHARS.vikingMan, "CON AIR! What does Cage's character say his hair is?",
      ["A statement", "His glory", "Always perfect", "His ticket home"], 0),
    trivia(CHARS.firefighter, "Remember the Titans — what's Coach Boone's motto?",
      ["No surrender", "Leave no man behind", "We will be perfect", "One team"], 2),
    trivia(CHARS.policeman, "Escape from Alcatraz — based on a real escape attempt in what year?",
      ["1962", "1965", "1968", "1971"], 0),
    trivia(CHARS.knightKid, "Return of the Jedi — what's the planet with the Ewoks?",
      ["Hoth", "Endor", "Naboo", "Dagobah"], 1),
    hint(CHARS.punkMan, "I want Nic Cage UNHINGED. Maximum acting energy. Whether it's a bad movie or a great one — just give me the WILD performance.",
      "Nicolas Cage Goes Big"),
    hint(CHARS.firefighter, "I want sports movies — football, hockey, boxing, baseball, doesn't matter. Gotta have the big game, the underdog, the win speech.",
      "Sports Movie"),
    hint(CHARS.knight, "I seek tales set within prison walls! Iron bars, hardened souls, perhaps a daring escape! Captivity as drama!",
      "Takes Place in a Prison"),
    story(CHARS.joker, "Why does the LAST movie in a trilogy always feel rushed? Because the studio finally noticed the BUDGET! Three's a crowd!",
      "Cinematic universe"),
    story(CHARS.bride, "We had Indiana Jones movies playing during cocktail hour. By Last Crusade, my mother-in-law was lecturing the bartender about archaeology.",
      "It was educational"),
    story(CHARS.farmer, "Watched Cool Hand Luke with the cousins. Now we have egg-eating contests every Easter. The doctor has asked us to stop.",
      "We will not stop"),
  ],

  'extra-shift-9': [
    // Manager's Stash | Set in the Future | Jack Nicholson Steals It | Remake of an Older Film | Character's Name is the Title
    trivia(CHARS.vikingMan, "TOTAL RECALL! What planet does Quaid keep dreaming about?",
      ["Jupiter", "Saturn", "Mars", "Venus"], 2),
    trivia(CHARS.businessman, "The Shining — what's the famous repeated phrase Jack types?",
      ["Redrum redrum redrum", "All work and no play makes Jack a dull boy", "Here's Johnny", "Heeeeere's Jack"], 1),
    trivia(CHARS.farmer, "True Grit (2010) is a remake — what year was the original?",
      ["1955", "1969", "1975", "1981"], 1),
    trivia(CHARS.bride, "Annie Hall — what's Annie's famous catchphrase?",
      ["La-di-da", "Whatever", "Oh well", "Cool beans"], 0),
    hint(CHARS.knight, "I seek visions of a world YET TO COME! Cyberpunk, dystopia, hovercars, the days that have not yet arrived but loom large.",
      "Set in the Future"),
    hint(CHARS.businessman, "Need the Nicholson scene-stealers. The eyebrow guy. The grin. He shows up and walks off with the whole movie. Even cameos count.",
      "Jack Nicholson Steals It"),
    hint(CHARS.oldMan, "I want movies that are REMAKES of older ones. Hollywood does it all the time — same story, new cast, modern budget.",
      "Remake of an Older Film"),
    story(CHARS.joker, "Why did the future-set movie always look so OUTDATED? Because in the 80s 'the future' was 1995! Time keeps marching, the predictions don't!",
      "Hovercar where"),
    story(CHARS.firefighter, "Watched The Shining at the firehouse on Halloween. One rookie hasn't entered the bathroom alone since. We're rotating shifts to escort him.",
      "Brave kid"),
    story(CHARS.chef, "Tried to give my line cook a Nicholson 'You can't handle the truth' moment about plating. He quit. Worth it.",
      "Better off"),
  ],

  'extra-shift-10': [
    // Closing Time | It Was All a Dream | Quentin Tarantino Directed | City Gets Destroyed | Movie Within a Movie
    trivia(CHARS.vikingMan, "INCEPTION! What's the team's term for a dream within a dream?",
      ["Layer", "Level", "Limbo", "Stack"], 1),
    trivia(CHARS.punkMan, "Reservoir Dogs — what color name does Mr. Pink complain about?",
      ["Mr. Pink", "Mr. Brown", "Mr. White", "Mr. Blue"], 0),
    trivia(CHARS.firefighter, "Cloverfield — what creature attacks New York?",
      ["Aliens", "A giant monster", "Ghosts", "Zombies"], 1),
    trivia(CHARS.businessman, "Tropic Thunder — Robert Downey Jr.'s character is a method actor playing what?",
      ["A robot", "A monkey", "An African American sergeant", "A dragon"], 2),
    hint(CHARS.blueKidGirl, "I want movies where SURPRISE — none of it actually happened! Big dream reveal, sometimes awesome, sometimes a cop-out.",
      "It Was All a Dream"),
    hint(CHARS.punkMan, "Quentin's joints. Dialogue that goes off, soundtrack that rips, blood when you least expect it, and chapter titles in big yellow font.",
      "Quentin Tarantino Directed"),
    hint(CHARS.knight, "I seek visions of GLORIOUS DESTRUCTION! Cities crumbling, landmarks falling, civilization in ruins! The grand spectacle!",
      "City Gets Destroyed"),
    story(CHARS.joker, "Why do all dream-reveal movies feel like a CHEAT? Because two hours of stakes EVAPORATE in one cut! 'It was all a dream' is screenwriter SURRENDER!",
      "Lazy lazy lazy"),
    story(CHARS.farmer, "Watched Cloverfield. Got motion sick in twenty minutes. Wife laughed. I rented Cloverfield Lane next week out of spite. She got motion sick. We're even.",
      "Marriage"),
    story(CHARS.policeman, "Captain made us watch Inception for 'team strategy.' Now nothing gets done because we're all arguing about whether we're awake. Dispatch is suing.",
      "Spinning the top"),
  ],

  'extra-shift-11': [
    // The Late Return | Tom Hanks Before He Got Serious | The Villain Wins in the End | Set at Christmastime (Not a Christmas Movie) | Director's Last Name + a Number = the Title
    trivia(CHARS.vikingMan, "TURNER & HOOCH! What kind of dog is Hooch?",
      ["A Saint Bernard", "A Mastiff", "A Dogue de Bordeaux", "A Bulldog"], 2),
    trivia(CHARS.ninja, "Whisper... in No Country for Old Men, who survives at the end?",
      ["The hero", "The sheriff", "The villain", "Nobody"], 2),
    trivia(CHARS.bride, "Eyes Wide Shut takes place during what holiday?",
      ["New Year's", "Halloween", "Christmas", "Easter"], 2),
    trivia(CHARS.businessman, "Signs is a 2002 M. Night Shyamalan movie. What's the recurring symbol?",
      ["Snakes", "Crop circles", "Aliens at windows", "Doors"], 1),
    hint(CHARS.knightKid, "I want EARLY Tom Hanks — the goofy comedy years, before he won all the Oscars. Bachelor parties, mermaids, big city stuff.",
      "Tom Hanks Before He Got Serious"),
    hint(CHARS.knight, "I seek tales where the dark forces TRIUMPH! Where the credits roll and evil walks free, smug and victorious. A hard ending.",
      "The Villain Wins in the End"),
    hint(CHARS.bride, "Movies set during Christmas but NOT Christmas movies. Tree's in the background, but the plot has nothing to do with the holiday.",
      "Set at Christmastime (Not a Christmas Movie)"),
    story(CHARS.joker, "Why do the bad guys win in artsy films? Because the AUDIENCE has to suffer too! Misery loves a Sundance distribution deal!",
      "Indie tax"),
    story(CHARS.policeman, "Showed Eyes Wide Shut at Christmas precinct party. Captain has not made eye contact with me since. Won't be doing that again.",
      "Lesson learned"),
    story(CHARS.chef, "Watched Splash and tried to make seafood with my staff. Now everyone keeps asking if Daryl Hannah is a saltwater or freshwater consultant. Productivity tanked.",
      "Send help"),
  ],

  'extra-shift-12': [
    // Rewind & Restock | One-Word Titles | Directed by a Woman | Lead Actor Also Directed It | Title Contains a Body Part
    trivia(CHARS.blondeWoman, "Clueless — what's the main character's name?",
      ["Tai", "Cher", "Dionne", "Amber"], 1),
    trivia(CHARS.bride, "Lost in Translation was directed by Sofia Coppola. Set where?",
      ["Paris", "Tokyo", "Rome", "Hong Kong"], 1),
    trivia(CHARS.vikingMan, "GOOD WILL HUNTING! Matt Damon co-wrote and starred. Who DIRECTED it?",
      ["Matt Damon", "Ben Affleck", "Gus Van Sant", "Robin Williams"], 2),
    trivia(CHARS.farmer, "The Iron Giant — where does the giant come from?",
      ["Underground", "From the sky / outer space", "Out of the ocean", "From a lab"], 1),
    hint(CHARS.businessman, "Movies whose titles are JUST one word — punchy, marketable, often a noun. Iconic in their brevity.",
      "One-Word Titles"),
    hint(CHARS.blueWoman, "Want movies DIRECTED by women — historically rare, getting better. Looking for the canon and the under-appreciated.",
      "Directed by a Woman"),
    hint(CHARS.knight, "I seek tales whose own LEAD did wield the director's chair! Star and storyteller in one — bold, ambitious work.",
      "Lead Actor Also Directed It"),
    story(CHARS.joker, "Why do one-word titles get so much love? Because they fit on a SINGLE marquee letter! Theaters love savings on signage!",
      "Practical art"),
    story(CHARS.chef, "Watched Tron at the kitchen. Now everyone's calling the deep-fryer 'the Grid' and yelling 'END OF LINE' when service ends. I love them.",
      "Best team ever"),
    story(CHARS.bride, "We screened Sleepless in Seattle on date night. Husband cried. Cried. CRIED. He blames the onions. I had not cooked anything.",
      "Onions everywhere"),
  ],

  'extra-shift-13': [
    // Shelf Shuffle | Based on a Stephen King Novel | Has a Colon in the Title | Famous Dance Scene Everyone Remembers | Sequel That Outgrossed the Original
    trivia(CHARS.ninja, "Whisper... 1408 is based on a Stephen King story. What does '1408' refer to?",
      ["A street address", "A hotel room number", "A page number", "A year"], 1),
    trivia(CHARS.vikingMan, "MISSION IMPOSSIBLE! Ethan Hunt's signature stunt is hanging from...?",
      ["A helicopter", "A ceiling on wires", "A skyscraper", "A train"], 1),
    trivia(CHARS.punkKidBoy, "Yo — Napoleon Dynamite's dance scene is set to what song?",
      ["Footloose", "Canned Heat by Jamiroquai", "Eye of the Tiger", "Dancing Queen"], 1),
    trivia(CHARS.businessman, "Toy Story 2 outgrossed Toy Story 1. Who voices Buzz Lightyear?",
      ["Tom Hanks", "Tim Allen", "John Ratzenberger", "Wallace Shawn"], 1),
    hint(CHARS.oldWoman, "Dearie, I want films from that prolific horror author — the Maine man. Maximum-overdrive type fellow. Sells a billion books.",
      "Based on a Stephen King Novel"),
    hint(CHARS.businessman, "Looking for movies whose titles have a COLON in them — Title: Subtitle. Franchise giveaway, usually.",
      "Has a Colon in the Title"),
    hint(CHARS.punkWoman, "I want movies with the dance scene EVERYBODY can do at weddings. The choreography is the whole legacy.",
      "Famous Dance Scene Everyone Remembers"),
    story(CHARS.joker, "Why did the sequel make more money than the original? Because the SEQUEL knew the audience already showed UP! Half the marketing!",
      "Cha-ching"),
    story(CHARS.farmer, "Did the Napoleon Dynamite dance at the harvest festival. Got a standing ovation from the chickens. People were less impressed.",
      "Tough crowd"),
    story(CHARS.bride, "Made my fiancé learn the Pulp Fiction Twist scene for our first dance. The DJ played the song. We forgot the moves. We did the chicken dance instead.",
      "Pivot pivot"),
  ],

  'extra-shift-14': [
    // Behind the Curtain | The Hero Dies at the End | Features an Iconic Car Chase | Won Best Picture but Nobody Remembers | Sports Movie Where They Lose the Big Game
    trivia(CHARS.vikingMan, "TITANIC! Who said 'I'm the king of the world'?",
      ["Jack", "Rose", "The captain", "Cal"], 0),
    trivia(CHARS.policeman, "Smokey and the Bandit — what's the Bandit's car?",
      ["A Pontiac Trans Am", "A Dodge Charger", "A Ford Mustang", "A Camaro"], 0),
    trivia(CHARS.businessman, "Crash (2004) won Best Picture and... most people forgot about it. Set in what city?",
      ["New York", "Chicago", "Los Angeles", "Miami"], 2),
    trivia(CHARS.firefighter, "Rocky — does Rocky win or lose the title fight at the end of the original?",
      ["Wins by KO", "Wins by decision", "Loses by decision", "It's a draw"], 2),
    hint(CHARS.knight, "I seek tales where the protagonist meets a NOBLE END! No happy ending — the hero falls, the credits roll, the audience weeps.",
      "The Hero Dies at the End"),
    hint(CHARS.farmer, "I want movies known for their CAR CHASE — when you think of the film, you think of the chase scene first. Tires, sirens, mayhem.",
      "Features an Iconic Car Chase"),
    hint(CHARS.oldMan, "Need Best Picture winners that NOBODY talks about anymore. The forgotten Oscars — won the night, vanished from culture.",
      "Won Best Picture but Nobody Remembers"),
    story(CHARS.joker, "Why is a sports movie where they LOSE the big game so popular? Because life lesson! WINNING isn't everything! ...but losing twice is just sad.",
      "Try harder"),
    story(CHARS.farmer, "Tried to do the Smokey and the Bandit double-clutch in my pickup. Truck made a noise I have never heard before. The mechanic laughed for an hour.",
      "Diamond in the rough"),
    story(CHARS.firefighter, "We watched Rocky. Now everyone in the firehouse runs the stairs and yells YO ADRIAN at the top. Property values are dropping.",
      "Hit the gym"),
  ],

  'extra-shift-15': [
    // After Hours | The Whole Movie Takes Place in One Night | Features a Real U.S. President as a Character | Most of the Movie Takes Place Underwater | Title Is a Character's Full Name
    trivia(CHARS.punkKidBoy, "Superbad — what is McLovin's age on the fake ID?",
      ["18", "21", "25", "30"], 2),
    trivia(CHARS.businessman, "JFK by Oliver Stone — who plays Jim Garrison?",
      ["Tommy Lee Jones", "Kevin Costner", "Gary Oldman", "Joe Pesci"], 1),
    trivia(CHARS.vikingMan, "THE ABYSS! James Cameron! What's underwater?",
      ["A sunken ship", "A drilling platform crew encountering aliens", "A submarine", "A hidden city"], 1),
    trivia(CHARS.bride, "Erin Brockovich — what's the lawsuit she works on about?",
      ["Big Tobacco", "Contaminated water from a power company", "Defective cars", "Asbestos"], 1),
    hint(CHARS.knight, "I seek tales whose entire story unfolds in a SINGLE NIGHT! Sunset to sunrise, no fade-outs to next morning! One wild evening!",
      "The Whole Movie Takes Place in One Night"),
    hint(CHARS.policeman, "I want movies where a real American President shows up as a character. Not actor playing fictional pres — actual historical leader.",
      "Features a Real U.S. President as a Character"),
    hint(CHARS.bride, "Movies set MOSTLY underwater — submarines, deep-sea expeditions, ocean exploration. Bubbles and pressure as far as the camera can see.",
      "Most of the Movie Takes Place Underwater"),
    story(CHARS.joker, "Why is McLovin the BEST fake ID name? Because no real person was DUMB enough to have just one name! Hawaiian or LIVING SOMETHING ELSE!",
      "Fogell forever"),
    story(CHARS.farmer, "Watched The Abyss with the crew. The pressure scenes made my ears pop just SITTING THERE. James Cameron knows his physics.",
      "Director of the deep"),
    story(CHARS.chef, "I named my new sous chef 'Erin Brockovich' because she's relentless about ingredient sourcing. She has now sued our pesto vendor. Effective.",
      "Promote her"),
  ],

  'extra-shift-16': [
    // The Bargain Bin | Has a Number in the Title (Not a Sequel Number) | The Twist Ending Changes Everything | Set in Outer Space | Animal in the Title That Isn't in the Movie
    trivia(CHARS.businessman, "Se7en — David Fincher film. Each murder is themed around what?",
      ["The Ten Commandments", "The Seven Deadly Sins", "Greek tragedy", "Tarot cards"], 1),
    trivia(CHARS.ninja, "Whisper... in The Sixth Sense, what is Bruce Willis's character's secret?",
      ["He's the killer", "He's a ghost", "He's M. Night in disguise", "It's all a dream"], 1),
    trivia(CHARS.vikingMan, "ALIEN! What's the spaceship's name?",
      ["Sulaco", "Nostromo", "Discovery", "Enterprise"], 1),
    trivia(CHARS.farmer, "Reservoir Dogs — there are no actual dogs in the movie. It's a heist film. Where do they meet?",
      ["A diner", "A warehouse", "A bar", "A motel"], 1),
    hint(CHARS.businessman, "Want movies with a NUMBER in the title that ISN'T a sequel number. Could be 7, 13, 11 — but not 'Part 2' or 'Vol. 1'.",
      "Has a Number in the Title (Not a Sequel Number)"),
    hint(CHARS.blueWoman, "Movies with a TWIST ENDING that recontextualizes the entire story. Walk out and immediately want to rewatch from frame one.",
      "The Twist Ending Changes Everything"),
    hint(CHARS.knightKid, "I want movies in OUTER SPACE! Stars, spaceships, planets, weightlessness! As far from Earth as possible!",
      "Set in Outer Space"),
    story(CHARS.joker, "Why was the twist ending so TWISTED? Because it BENT itself in half to surprise you! M. Night, your back must be sore!",
      "Stretch first"),
    story(CHARS.bride, "Friend told me the Sixth Sense twist before I saw it. Had to act surprised in the theater for two hours. Acting is hard.",
      "Oscar worthy"),
    story(CHARS.chef, "Reservoir Dogs has no dogs. Snakes on a Plane has snakes. Audiences are unpredictable. Marketing is a nightmare.",
      "Truth in advertising"),
  ],

  'extra-shift-17': [
    // Double Feature | Shot in Black and White (After 1960) | Remake of a Foreign Film | Had a Completely Different Working Title | Unreliable Narrator
    trivia(CHARS.businessman, "Schindler's List is mostly black and white. What color appears for the famous girl?",
      ["Yellow", "Red", "Blue", "Green"], 1),
    trivia(CHARS.policeman, "The Departed is a remake of what 2002 Hong Kong film?",
      ["Hard Boiled", "Infernal Affairs", "A Better Tomorrow", "Police Story"], 1),
    trivia(CHARS.vikingMan, "E.T.! Working title was 'Night Skies.' What does E.T. famously want to do?",
      ["Watch movies", "Eat candy", "Phone home", "Ride bikes"], 2),
    trivia(CHARS.ninja, "Whisper... in The Usual Suspects, who is Keyser Söze?",
      ["The cop", "Verbal Kint", "Dean Keaton", "Hockney"], 1),
    hint(CHARS.blueWoman, "I want black-and-white films from after 1960 — when color was already standard but a director chose monochrome anyway. An aesthetic choice.",
      "Shot in Black and White (After 1960)"),
    hint(CHARS.businessman, "Movies that are American REMAKES of foreign films — could be Asian originals, European originals, doesn't matter as long as it's a remake.",
      "Remake of a Foreign Film"),
    hint(CHARS.knight, "I seek films that bore a DIFFERENT name during production! The working title and the released title are not the same — a Hollywood pivot!",
      "Had a Completely Different Working Title"),
    story(CHARS.joker, "Why don't I trust narrators? Because half of them ARE the killer! 'I am thirty-five and unmarried' — yeah, AND a SECRET MURDERER!",
      "Read the room"),
    story(CHARS.chef, "Watched The Departed and Infernal Affairs back to back. My pasta course took 4 hours. The cannoli sided with one and the tiramisu with the other.",
      "Cinema fight night"),
    story(CHARS.farmer, "I've been narrating my morning chores aloud for a week. Wife says I'm 'unreliable.' I disagree. The chickens know what I did.",
      "The chickens lie too"),
  ],

  'extra-shift-18': [
    // Manager's Special | The Main Character Narrates | Set Almost Entirely in One Building | A Star's Surprising Movie Debut | The Poster Is More Famous Than the Film
    trivia(CHARS.vikingMan, "GOODFELLAS! What does the narrator say he always WANTED to be?",
      ["A cop", "A movie star", "A gangster", "A chef"], 2),
    trivia(CHARS.firefighter, "Die Hard — what building does the action take place in?",
      ["The Empire State Building", "Nakatomi Plaza", "City Hall", "The Pentagon"], 1),
    trivia(CHARS.policeman, "Johnny Depp's first movie role was in what 1984 horror?",
      ["Friday the 13th", "Halloween II", "A Nightmare on Elm Street", "The Evil Dead"], 2),
    trivia(CHARS.bride, "Breakfast at Tiffany's — what does Holly Golightly's cat name itself?",
      ["Cat", "Tiffany", "Holly", "It has no name"], 0),
    hint(CHARS.knight, "I seek tales where the LEAD speaks DIRECTLY to the audience! Voiceover from start to finish, the protagonist as your guide!",
      "The Main Character Narrates"),
    hint(CHARS.businessman, "Movies that take place ALMOST ENTIRELY in one building. Confined location, single setting, claustrophobia as a feature.",
      "Set Almost Entirely in One Building"),
    hint(CHARS.blueWoman, "Want movies that gave us a famous actor's SURPRISING FIRST role. The 'wait, that was them?' moment when you spot a young face.",
      "A Star's Surprising Movie Debut"),
    story(CHARS.joker, "Why is The Warriors poster better than the movie? Because the POSTER doesn't have the COSTUMES! Iconic art, questionable jumpsuits!",
      "Strong poster game"),
    story(CHARS.farmer, "Watched Die Hard at the firehouse. Now every December the captain does the Hans Gruber accent. He's been doing it since 1992. Help.",
      "Send help December"),
    story(CHARS.knightKid, "I quoted Goodfellas at the lunch table — 'as far back as I can remember.' Cafeteria worker said 'just take the chicken nuggets, kid.'",
      "Lost on her"),
  ],

  'extra-shift-19': [
    // Closing Time | Famous Training Montage | Morgan Freeman Plays God (or Close to It) | Based on a True Heist or Con | John Williams Composed the Score
    trivia(CHARS.vikingKidBoy, "ROCKY! What does Rocky drink raw for breakfast?",
      ["Milk", "Eggs", "Beer", "Protein shake"], 1),
    trivia(CHARS.bride, "Bruce Almighty — Morgan Freeman plays God. Who plays Bruce?",
      ["Jim Carrey", "Adam Sandler", "Will Ferrell", "Steve Carell"], 0),
    trivia(CHARS.policeman, "Catch Me If You Can — based on the real life of con man...?",
      ["Charles Ponzi", "Frank Abagnale Jr.", "Bernie Madoff", "Victor Lustig"], 1),
    trivia(CHARS.knightKid, "STAR WARS! Who composed the iconic score?",
      ["Hans Zimmer", "John Williams", "Danny Elfman", "James Horner"], 1),
    hint(CHARS.firefighter, "Movies with the iconic GET STRONG sequence — punching meat, climbing stairs, running mountains, music goes BIG. Sweat and triumph.",
      "Famous Training Montage"),
    hint(CHARS.knight, "I seek tales where the great voice plays the DIVINE himself — or close to it! All-knowing, all-narrating, the man IS authority!",
      "Morgan Freeman Plays God (or Close to It)"),
    hint(CHARS.businessman, "I want movies based on REAL heists or cons. Bank robberies, billion-dollar scams, swindles that actually happened. Truth stranger than fiction.",
      "Based on a True Heist or Con"),
    story(CHARS.joker, "Why does John Williams compose the BEST scores? Because he writes the same TWO NOTES and we all show up! Da-dun! Da-dun! That's a billion dollars!",
      "Genius two-note system"),
    story(CHARS.chef, "Tried Rocky's raw eggs for breakfast. Spent three days regretting it. The Italian Stallion is built different. I am not.",
      "Boil them next time"),
    story(CHARS.farmer, "Got conned at the county fair by a kid running a shell game. Catch Me If You Can vibes. The kid was eleven. I'm forty-six. Humbling.",
      "Smart kid"),
  ],

  'extra-shift-20': [
    // The Lost Tape | Takes Place in a High School | Harrison Ford Gets Chased | Title Sounds Like a Board Game | Bill Murray Being Bill Murray
    trivia(CHARS.blueKidGirl, "Clueless — Cher's stepbrother is played by who?",
      ["Brad Pitt", "Paul Rudd", "Matthew McConaughey", "Adam Sandler"], 1),
    trivia(CHARS.vikingMan, "THE FUGITIVE! Where does Kimble jump from to escape the marshals?",
      ["A bridge", "A dam", "A train", "A helicopter"], 1),
    trivia(CHARS.knight, "JUMANJI! When you finish the game, what happens?",
      ["You get a prize", "It resets, the players go free", "The animals stay", "Nothing"], 1),
    trivia(CHARS.joker, "Groundhog Day — what's the song that wakes Phil up every morning?",
      ["Heart of Gold", "I Got You Babe", "What a Wonderful World", "Take On Me"], 1),
    hint(CHARS.knightKid, "I want movies that take place in HIGH SCHOOL! Lockers, cafeterias, the prom, the bullies, the awkward years. All the classics!",
      "Takes Place in a High School"),
    hint(CHARS.firefighter, "Want movies where Harrison Ford is RUNNING from somebody! Doesn't matter what — Nazis, replicants, marshals, Russians. He's just being chased.",
      "Harrison Ford Gets Chased"),
    hint(CHARS.businessman, "Movies whose title SOUNDS like a board game. Could literally be one, could just have that vibe — Clue, Twister, that family-game-night energy.",
      "Title Sounds Like a Board Game"),
    story(CHARS.joker, "Why is Bill Murray the perfect movie star? Because he just SHOWS UP and you accept whatever he's doing! The man IS the genre!",
      "Bless him"),
    story(CHARS.bride, "I want our wedding photographer to follow us around like Harrison Ford was being chased. My fiancé says that's not a real photo style. We are negotiating.",
      "It IS a style"),
    story(CHARS.farmer, "Watched Groundhog Day. Now every February 2 my wife wakes me with I Got You Babe. We've been doing this for eleven years. I might break.",
      "Send help, Phil"),
  ],
};

// ---------------------------------------------------------------------------
// Merge into interrupts.json + apply other fixes
// ---------------------------------------------------------------------------
const interrupts = JSON.parse(fs.readFileSync(INTERRUPTS_PATH, 'utf8'));

// 1) Add the new content. Don't overwrite anything that already exists —
//    if a date is already populated, this is a no-op (caller error).
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

// 2) Bug 2: swap the entire arrays for 2026-04-16 and 2026-04-17. Every
//    interrupt belongs to the OTHER puzzle's content — clean swap fixes it.
if (interrupts['2026-04-16'] && interrupts['2026-04-17']) {
  const tmp = interrupts['2026-04-16'];
  interrupts['2026-04-16'] = interrupts['2026-04-17'];
  interrupts['2026-04-17'] = tmp;
  console.log('Swapped 2026-04-16 ↔ 2026-04-17 interrupt arrays');
}

// 3) Bug 3: fix punk_man → punk_men sprite references everywhere. The actual
//    file on disk is characters/Punk Man/punk_men.png (note the plural).
let punkFixed = 0;
for (const items of Object.values(interrupts)) {
  for (const item of items) {
    if (item.sprite === 'punk_man' && item.folder === 'Punk Man') {
      item.sprite = 'punk_men';
      punkFixed++;
    }
  }
}
console.log(`Fixed ${punkFixed} punk_man sprite references`);

// 4) Bug 4: schema drift in legacy entries. Runtime expects:
//    - trivia.correct  (some entries had correctAnswer)
//    - story.dismiss   (some entries had dismissLabel)
//    - hint.cost       (some entries omitted it; runtime falls back to 3 anyway,
//                       but the verifier flags missing cost so add it explicitly)
let renamed = 0, defaulted = 0;
for (const items of Object.values(interrupts)) {
  for (const item of items) {
    if (item.type === 'trivia' && item.correct === undefined && item.correctAnswer !== undefined) {
      item.correct = item.correctAnswer;
      delete item.correctAnswer;
      renamed++;
    }
    if (item.type === 'story' && item.dismiss === undefined && item.dismissLabel !== undefined) {
      item.dismiss = item.dismissLabel;
      delete item.dismissLabel;
      renamed++;
    }
    // Trivia entries can also have a stray `question` field that duplicates
    // `dialogue` — strip it so the data has one source of truth.
    if (item.type === 'trivia' && item.question !== undefined) {
      delete item.question;
      renamed++;
    }
    if (item.type === 'hint' && (item.cost === undefined || item.cost === null)) {
      item.cost = 3;
      defaulted++;
    }
  }
}
console.log(`Renamed ${renamed} drifted fields; defaulted cost on ${defaulted} hints`);

fs.writeFileSync(INTERRUPTS_PATH, JSON.stringify(interrupts, null, 2));
console.log('Wrote', INTERRUPTS_PATH);
