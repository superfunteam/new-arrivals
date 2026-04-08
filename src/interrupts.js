// Customer Interrupts — RPG-style chat box system
// Fires every 60s during gameplay with animated sprites, typed dialogue, garbled voice, and haptic feedback.

import * as Tone from 'tone';
import { adjustWage } from './game-logic.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let intervalId = null;
let queue = [];          // shuffled array of interrupt objects
let queueIndex = 0;
let paused = false;
let active = false;      // true while an interrupt is on screen
let stopped = false;

let spriteAnimInterval = null;
let typeTimeout = null;
let dismissTimeout = null;
let containerEl = null;

// Saved options from initInterrupts
let opts = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initInterrupts(options) {
  opts = options;
  stopped = false;
  active = false;
  paused = false;
  queueIndex = 0;

  // Load + shuffle the 10 interrupts for this puzzle
  const puzzleInterrupts = options.interruptsData[options.puzzleId];
  if (!puzzleInterrupts || puzzleInterrupts.length === 0) {
    console.warn('No interrupts found for puzzle:', options.puzzleId);
    return;
  }

  queue = shuffleArray([...puzzleInterrupts]);

  // Start the 60-second interval
  intervalId = setInterval(() => {
    if (paused || active || stopped) return;
    fireNext();
  }, 60000);
}

export function stopInterrupts() {
  stopped = true;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  cleanup();
}

export function pauseInterrupts() {
  paused = true;
}

export function resumeInterrupts() {
  paused = false;
}

// ---------------------------------------------------------------------------
// Internal — fire the next interrupt
// ---------------------------------------------------------------------------

function fireNext() {
  if (queueIndex >= queue.length || stopped) {
    stopInterrupts();
    return;
  }

  const interrupt = queue[queueIndex];
  queueIndex++;
  active = true;

  // Pause game timer
  if (opts.onPause) opts.onPause();

  // Show the chat box
  showInterrupt(interrupt);
}

// ---------------------------------------------------------------------------
// Shuffle utility
// ---------------------------------------------------------------------------

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Show interrupt UI
// ---------------------------------------------------------------------------

function showInterrupt(interrupt) {
  // Create container element appended to body
  containerEl = document.createElement('div');
  containerEl.id = 'interrupt-container';

  const spritePath = `/characters/${interrupt.folder}/${interrupt.sprite}.png`;

  containerEl.innerHTML = `
    <div class="interrupt-box">
      <div class="interrupt-header">
        <div class="interrupt-sprite" id="interrupt-sprite"
             style="background-image: url('${spritePath}')"></div>
        <div class="interrupt-name">${interrupt.character}</div>
      </div>
      <div class="interrupt-dialogue" id="interrupt-dialogue"></div>
      <div class="interrupt-actions" id="interrupt-actions"></div>
    </div>
  `;

  document.body.appendChild(containerEl);

  // Start sprite animation (top row: 4 frames at 4fps)
  startSpriteAnimation();

  // Type in the dialogue
  typeDialogue(interrupt.dialogue, interrupt, () => {
    // After typing completes, show action buttons
    showActions(interrupt);
  });
}

// ---------------------------------------------------------------------------
// Sprite animation — 4 frames at 4fps (250ms per frame)
// ---------------------------------------------------------------------------

function startSpriteAnimation() {
  let frame = 0;
  const spriteEl = document.getElementById('interrupt-sprite');
  if (!spriteEl) return;

  spriteAnimInterval = setInterval(() => {
    // Each frame is 32x32 in the sheet, displayed at 2x (64x64)
    // background-size is 256px 512px (128*2 x 256*2)
    // Top row (y=0), columns 0-3
    const xOffset = -(frame * 64);
    spriteEl.style.backgroundPosition = `${xOffset}px 0px`;
    frame = (frame + 1) % 4;
  }, 250);
}

function stopSpriteAnimation() {
  if (spriteAnimInterval) {
    clearInterval(spriteAnimInterval);
    spriteAnimInterval = null;
  }
}

// ---------------------------------------------------------------------------
// Type-in dialogue with garble voice + haptic
// ---------------------------------------------------------------------------

function typeDialogue(text, interrupt, onComplete) {
  const dialogueEl = document.getElementById('interrupt-dialogue');
  if (!dialogueEl) return;

  let charIndex = 0;

  function typeNext() {
    if (stopped || charIndex >= text.length) {
      if (onComplete) onComplete();
      return;
    }

    charIndex++;
    dialogueEl.textContent = text.slice(0, charIndex);

    // Garble voice
    playGarble(interrupt.character);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    typeTimeout = setTimeout(typeNext, 40);
  }

  typeNext();
}

// ---------------------------------------------------------------------------
// Garble voice synthesis (Tone.js oscillator bursts)
// ---------------------------------------------------------------------------

function playGarble(characterName) {
  try {
    let minHz, maxHz, waveType;
    const nameLower = characterName.toLowerCase();

    if (nameLower.includes('kid') || nameLower.includes('boy') || nameLower.includes('girl')) {
      minHz = 400;
      maxHz = 900;
      waveType = 'square';
    } else if (nameLower.includes('old')) {
      minHz = 150;
      maxHz = 400;
      waveType = 'sine';
    } else {
      minHz = 200;
      maxHz = 600;
      waveType = 'square';
    }

    const freq = minHz + Math.random() * (maxHz - minHz);
    const osc = new Tone.Oscillator(freq, waveType).toDestination();
    osc.volume.value = -18;
    osc.start();
    setTimeout(() => {
      osc.stop();
      osc.dispose();
    }, 20);
  } catch {
    // Silently ignore audio errors
  }
}

// ---------------------------------------------------------------------------
// Action buttons per interrupt type
// ---------------------------------------------------------------------------

function showActions(interrupt) {
  const actionsEl = document.getElementById('interrupt-actions');
  if (!actionsEl) return;

  switch (interrupt.type) {
    case 'trivia':
      showTriviaActions(interrupt, actionsEl);
      break;
    case 'hint':
      showHintActions(interrupt, actionsEl);
      break;
    case 'story':
      showStoryActions(interrupt, actionsEl);
      break;
    default:
      dismissInterrupt();
  }
}

// ---------------------------------------------------------------------------
// Trivia: 4 answer buttons
// ---------------------------------------------------------------------------

function showTriviaActions(interrupt, actionsEl) {
  actionsEl.innerHTML = '';

  interrupt.answers.forEach((answer, i) => {
    const btn = document.createElement('button');
    btn.className = 'interrupt-btn secondary';
    btn.textContent = answer;
    btn.addEventListener('click', () => handleTriviaAnswer(interrupt, i, actionsEl));
    actionsEl.appendChild(btn);
  });
}

function handleTriviaAnswer(interrupt, answerIndex, actionsEl) {
  // Disable all buttons
  const buttons = actionsEl.querySelectorAll('.interrupt-btn');
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === interrupt.correct) {
      btn.className = 'interrupt-btn correct';
    } else if (i === answerIndex && i !== interrupt.correct) {
      btn.className = 'interrupt-btn wrong';
    }
  });

  const dialogueEl = document.getElementById('interrupt-dialogue');

  if (answerIndex === interrupt.correct) {
    // Correct answer: +$2
    const newWage = adjustWage(opts.game, 2);
    if (opts.onWageChange) opts.onWageChange(newWage, true);

    // Show result
    if (dialogueEl) {
      const result = document.createElement('div');
      result.className = 'interrupt-result win';
      result.textContent = 'Nice! +$2!';
      dialogueEl.appendChild(result);
    }

    // Play correct sound
    playCorrectSound();
  } else {
    // Wrong: no penalty
    if (dialogueEl) {
      const result = document.createElement('div');
      result.className = 'interrupt-result lose';
      result.textContent = 'Nah...';
      dialogueEl.appendChild(result);
    }
  }

  // Auto-dismiss after 1.5s
  dismissTimeout = setTimeout(() => {
    dismissInterrupt();
  }, 1500);
}

function playCorrectSound() {
  try {
    const s = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0, release: 0.1 },
    }).toDestination();
    s.volume.value = -12;
    s.triggerAttackRelease('C5', '16n');
    setTimeout(() => {
      s.triggerAttackRelease('E5', '16n');
      setTimeout(() => s.dispose(), 500);
    }, 100);
  } catch {
    // Silently ignore
  }
}

// ---------------------------------------------------------------------------
// Hint: [Pay $3] [No thanks]
// ---------------------------------------------------------------------------

function showHintActions(interrupt, actionsEl) {
  actionsEl.innerHTML = '';

  const cost = interrupt.cost || 3;

  const payBtn = document.createElement('button');
  payBtn.className = 'interrupt-btn primary';
  payBtn.textContent = `Pay $${cost}`;
  payBtn.addEventListener('click', () => {
    // Deduct wage
    const newWage = adjustWage(opts.game, -cost);
    if (opts.onWageChange) opts.onWageChange(newWage, false);

    // Check if bankrupt
    if (opts.game.completed && !opts.game.won) {
      dismissInterrupt();
      return;
    }

    // Type in the hint category
    actionsEl.innerHTML = '';
    const dialogueEl = document.getElementById('interrupt-dialogue');
    if (dialogueEl) {
      dialogueEl.textContent = '';
    }

    typeDialogue(`The category is: "${interrupt.hintCategory}"`, interrupt, () => {
      actionsEl.innerHTML = '';
      const gotItBtn = document.createElement('button');
      gotItBtn.className = 'interrupt-btn primary';
      gotItBtn.textContent = 'Got it';
      gotItBtn.addEventListener('click', () => dismissInterrupt());
      actionsEl.appendChild(gotItBtn);
    });
  });
  actionsEl.appendChild(payBtn);

  const noBtn = document.createElement('button');
  noBtn.className = 'interrupt-btn secondary';
  noBtn.textContent = 'No thanks';
  noBtn.addEventListener('click', () => dismissInterrupt());
  actionsEl.appendChild(noBtn);
}

// ---------------------------------------------------------------------------
// Story: single dismiss button
// ---------------------------------------------------------------------------

function showStoryActions(interrupt, actionsEl) {
  actionsEl.innerHTML = '';

  const btn = document.createElement('button');
  btn.className = 'interrupt-btn secondary';
  btn.textContent = interrupt.dismiss || 'OK';
  btn.addEventListener('click', () => dismissInterrupt());
  actionsEl.appendChild(btn);
}

// ---------------------------------------------------------------------------
// Dismiss + cleanup
// ---------------------------------------------------------------------------

function dismissInterrupt() {
  cleanup();
  active = false;

  // Resume game timer
  if (opts && opts.onResume) opts.onResume();

  // If all 10 used or game ended, stop the system
  if (queueIndex >= queue.length || stopped) {
    stopInterrupts();
  }
}

function cleanup() {
  stopSpriteAnimation();

  if (typeTimeout) {
    clearTimeout(typeTimeout);
    typeTimeout = null;
  }

  if (dismissTimeout) {
    clearTimeout(dismissTimeout);
    dismissTimeout = null;
  }

  if (containerEl) {
    containerEl.remove();
    containerEl = null;
  }
}
