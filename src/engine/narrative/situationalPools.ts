/**
 * Situational Text Pools
 *
 * High-specificity strings for key narrative moments — fired by the rules engine
 * when context matches. These supplement (not replace) the general stat-tier pools
 * in textPools.ts.
 *
 * Tokens: {batter}, {pitcher}, {abs}, {hits}, {k} (strikeout count)
 * Add new strings freely — engine picks one at random.
 */

// ─────────────────────────────────────────────────────────────────────────────
// HOME RUN SITUATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** 4-run bomb — grand slam */
export const GRAND_SLAM_TEXTS = [
  "GRAND SLAM! {batter} clears the bases!",
  "It's a GRAND SLAM! {batter} sends all four home!",
  "{batter} with the bases loaded — GONE. Grand slam!",
  "Four runs score! {batter} deposits a grand slam into the seats!",
  "The bases were loaded. They aren't anymore. {batter} — GRAND SLAM!",
  "EVERYONE SCORES! {batter} hits a walk-off grand slam!",
  "{batter} unloads on it. Grand slam. The dugout erupts.",
];

/** Walk-off homer — trailing/tied, late game, inning ends */
export const WALKOFF_HOMER_TEXTS = [
  "{batter} launches it — and that's a walk-off! GAME OVER!",
  "It's gone! Walk-off home run! {batter} ends it right here!",
  "{batter} does it! The crowd goes wild — walk-off!",
  "What a finish. {batter} with the walk-off blast.",
  "IT'S OVER! {batter} hits it out. Walk-off home run!",
  "{batter} had one more in him. Walk-off homer — ballgame!",
  "The crowd was waiting. {batter} gave them everything. WALK-OFF.",
];

/** Redemption homer — batter was hitless before this AB */
export const REDEMPTION_HOMER_TEXTS = [
  "{batter} was 0-for-{abs}. Not anymore. Gone.",
  "The drought ends — and in the biggest way. {batter} hits it out.",
  "{batter}, hitless all game, launches one over the fence. There it is.",
  "All that struggle, paid off in one swing. {batter} — HOME RUN.",
  "After a rough day at the plate, {batter} does something about it.",
  "0-for-{abs}, then this. {batter} with the redemption shot.",
  "{batter} finally finds the barrel — and it clears the fence.",
];

/** Clutch homer — high-leverage, non-walkoff */
export const CLUTCH_HOMER_TEXTS = [
  "{batter} rises to the moment. That ball is GONE.",
  "Clutch. {batter} puts one into the seats at exactly the right time.",
  "You could feel it building. {batter} doesn't disappoint.",
  "The crowd erupts — {batter} with the big fly.",
  "Big spot. Bigger swing. {batter} goes deep.",
  "{batter} senses the moment and rises to it. Home run.",
  "That's a home run, and it couldn't have come at a better moment.",
];

// ─────────────────────────────────────────────────────────────────────────────
// STRIKEOUT SITUATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Pitcher dominates in a key moment */
export const CLUTCH_K_TEXTS = [
  "{pitcher} slams the door. Strikeout — huge out.",
  "Lights out. {pitcher} blows it by the hitter when it mattered most.",
  "{pitcher} rises when it counts. Strikeout — the threat is over.",
  "Key pitch. Key out. {pitcher} was not letting that run score.",
  "That's how you pitch under pressure. {pitcher} finishes the inning.",
  "{pitcher} with the swing-and-miss everyone needed. Strikeout.",
  "Dominant. {pitcher} punches out the side in the biggest spot of the game.",
];

/** Batter has already struck out multiple times */
export const FRUSTRATION_K_TEXTS = [
  "{batter} goes down swinging again. A tough day at the plate continues.",
  "Strike three — that's {k} on the day for {batter}.",
  "{batter} can't find a pitch to hit. Another strikeout.",
  "The struggle continues for {batter}. Punched out again.",
  "{batter} chases. {k} strikeouts today and counting.",
  "Another K for {batter}. The plate hasn't been kind today.",
  "{batter} flails at it. Still looking for a quality at-bat.",
];

/** Late-game tension K — neither clutch pitcher nor frustrated batter, but high stakes */
export const TENSION_K_TEXTS = [
  "{pitcher} gets the big out. Strike three.",
  "{pitcher} comes up huge. Strikeout to end the threat.",
  "That's a massive strikeout from {pitcher}. Inning over.",
  "{batter} can't deliver. Strike three — the rally dies.",
  "{pitcher} escapes the jam with a punch-out.",
];

// ─────────────────────────────────────────────────────────────────────────────
// HIT SITUATIONS (single / double / triple)
// ─────────────────────────────────────────────────────────────────────────────

/** Walk-off hit — trailing/tied, late game, runs score */
export const WALKOFF_HIT_TEXTS = [
  "{batter} pokes one through — the winning run scores! WALK-OFF!",
  "Base hit! The runner comes home — BALLGAME!",
  "{batter} punches it into the gap — walk-off! Game over!",
  "A single to end it all! {batter} wins it in dramatic fashion!",
  "They needed a hit — {batter} delivered. WALK-OFF base hit.",
];

/** Batter gets first hit after being hitless */
export const REDEMPTION_HIT_TEXTS = [
  "{batter} finally gets one. Base hit — the drought is over.",
  "0-for-{abs} no more. {batter} sneaks one through.",
  "It's through for a hit! {batter} finally finds one.",
  "{batter} punches one into the gap. First hit of the day.",
  "The hitless streak ends. {batter} with a well-earned base knock.",
  "{batter} finds it. About time — base hit.",
  "There it is for {batter}. First hit of the game.",
];

/** Clutch hit — RISP, high-leverage */
export const CLUTCH_HIT_TEXTS = [
  "{batter} comes through. Runners will score.",
  "Big hit. {batter} delivers in the clutch.",
  "{batter} wasn't going to be the out here. Base hit — runs score.",
  "You need the big hit — {batter} provides it.",
  "Clutch. {batter} puts the ball in play when it counts.",
  "{batter} with a hit in the biggest spot of the game.",
  "That's what you need. {batter} gets the timely knock.",
];

/** Comeback hit — trailing, RISP */
export const COMEBACK_HIT_TEXTS = [
  "{batter} keeps the comeback alive. Base hit!",
  "Down but not out — {batter} puts one in play.",
  "They needed that. {batter} delivers when it counts.",
  "{batter} refuses to let this one slip away. Base hit.",
  "The momentum shifts — {batter} with a clutch knock.",
  "Still alive. {batter} keeps them in it with a hit.",
];

// ─────────────────────────────────────────────────────────────────────────────
// REDEMPTION ARC (tracked flag)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Batter failed in a key spot last AB; this one matters.
 * Fires when redemptionOpportunity is set and the batter does NOT get a hit.
 * Tokens: {batter}, {pitcher}
 */
export const REDEMPTION_SETUP_TEXTS = [
  "Still haunted by that last at-bat. {batter} steps back in — and can't deliver.",
  "The ghosts are still there. {batter} has another chance and comes up short.",
  "Opportunity knocks again for {batter}. Knocks go unanswered — out.",
  "{batter} looking to erase that last memory. The out hangs in the air instead.",
  "That moment is still on everyone's mind. {batter} at the plate — still searching.",
  "Another at-bat, another chance to make it right. {batter} can't quite get there.",
  "The weight of that last at-bat is still on {batter}'s shoulders. Doesn't shake it this time.",
];

/**
 * Batter gets a hit after failing in a key spot — the payoff.
 * Fires when redemptionOpportunity is set and the batter gets any hit.
 * Tokens: {batter}, {pitcher}
 */
export const REDEMPTION_PAYOFF_TEXTS = [
  "{batter} makes up for it. Right here, right now — base hit!",
  "That's the redemption. {batter} doesn't miss this one.",
  "Last time hurt. This time {batter} makes it count. Hit!",
  "Been waiting for this. {batter} delivers — the comeback starts here.",
  "That previous at-bat? Forgotten. {batter} comes through with a clutch knock.",
  "The story writes itself — {batter} erases the bad memory with a base hit.",
  "{batter} had unfinished business. Settled right here. Hit!",
];

// ─────────────────────────────────────────────────────────────────────────────
// OUT SITUATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Big spot, runner left on base, tension moment */
export const CLUTCH_OUT_TEXTS = [
  "{batter} grounds out. The runner doesn't score. Heartbreaker.",
  "So close — {batter} hits it right at the fielder. Inning over.",
  "The rally dies. {batter} grounds into the out.",
  "{batter} needed to come through. Didn't. Inning over.",
  "Big spot. {batter} can't deliver. Rally stalled.",
  "{batter} hits it hard — but right at them. That's the inning.",
  "Agonizing. {batter} couldn't get it done. Runners stranded.",
];

// ─────────────────────────────────────────────────────────────────────────────
// BREAKTHROUGH MOMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Contrast Moment — Player does opposite of their identity, succeeds
 * Used when breakthrough archetype is 'contrast_moment'
 * Tokens: {playerName}, {skillName}
 */
export const BREAKTHROUGH_CONTRAST_TEXTS = [
  "{playerName} did something unexpected. {skillName} clicked. And it worked.",
  "For the first time this season, {playerName} broke their own pattern. The result was perfect.",
  "{playerName} understood something new about {skillName} today.",
  "Nobody expected that. {playerName} least of all. But {skillName} showed up anyway.",
  "{playerName}'s instinct was all wrong — and exactly right when it mattered.",
];

/**
 * Streak Moment — Consistent behavior finally pays off at the right time
 * Used when breakthrough archetype is 'streak_moment'
 * Tokens: {playerName}, {skillName}
 */
export const BREAKTHROUGH_STREAK_TEXTS = [
  "{playerName}'s {skillName} finally paid dividends.",
  "Repetition became mastery. {playerName} was ready.",
  "{playerName} had done this a thousand times. The thousand-and-first was different.",
  "All those reps. All that practice. {playerName} made it count.",
  "{playerName}'s {skillName} has always been there. Today, the game was ready for it.",
];

/**
 * Comeback Moment — Redemption after slump or deficit
 * Used when breakthrough archetype is 'comeback_moment'
 * Tokens: {playerName}, {skillName}
 */
export const BREAKTHROUGH_COMEBACK_TEXTS = [
  "{playerName} refused to quit. The game rewarded that refusal.",
  "Back against the wall, {playerName} found something extra.",
  "Redemption. {playerName} understood {skillName} now.",
  "{playerName} had nothing left to lose. That's when {skillName} emerged.",
  "From the brink. {playerName}'s {skillName} carved out a path forward.",
];

/**
 * Specialization Moment — Player cracks the code on a specific opponent or situation
 * Used when breakthrough archetype is 'specialization_moment'
 * Tokens: {playerName}, {skillName}
 */
export const BREAKTHROUGH_SPECIALIZATION_TEXTS = [
  "{playerName} cracked the code.",
  "Years of repetition paid off. {playerName}'s {skillName} was complete.",
  "{playerName} saw something no one else could.",
  "The answer was always there. {playerName} finally found it in {skillName}.",
  "{playerName} understood. This was their moment. This was their skill.",
];

// --- Bad Habit Narrative Pools ---

/** When a habit costs the player — shown in game log (silent formation, this triggers on effect) */
export const BAD_HABIT_COSTS_TEXTS: string[] = [
  "The defense knew it was coming.",
  "They'd seen this move before.",
  "The scouting report was right. {playerName} was predictable.",
  "No mystery left. The opponent had the book.",
  "Same approach. Same result. The defense didn't even flinch.",
];

/** When a player breaks a bad habit */
export const BAD_HABIT_BREAK_TEXTS: string[] = [
  "{playerName} changed it up. They didn't see it coming.",
  "Different look this time. {playerName} had evolved.",
  "The book was wrong. {playerName} rewrote it.",
  "{playerName} caught them off guard — finally.",
  "No pattern to exploit now. {playerName} had broken the mold.",
];

/** When an opponent identifies and adapts to a habit (knowledge escalation) */
export const BAD_HABIT_SCOUTED_TEXTS: string[] = [
  "The coaching staff had seen enough film.",
  "They'd done their homework on {playerName}.",
  "Word travels fast in this league. The tendency was known.",
  "Three games of footage. The pattern was obvious.",
  "Scouts don't miss tendencies like this.",
];

// --- Signature Skill Narrative Pools ---

/** When a signature skill fires at full force */
export const SIGNATURE_SKILL_USE_TEXTS: string[] = [
  "{playerName}'s {signatureName} — right on cue.",
  "There it is. {playerName}'s signature move: {signatureName}.",
  "{signatureName}. {playerName} owns this moment.",
  "Nobody does it quite like {playerName}. {signatureName} on display.",
  "The crowd knew. {playerName} was in their zone. {signatureName}.",
  "Picture-perfect execution. {playerName}'s {signatureName} in full effect.",
  "This is what {playerName} was built for. {signatureName} delivers.",
];

/** When an opponent counters / reads the signature skill */
export const SIGNATURE_COUNTER_TEXTS: string[] = [
  "The catcher called for an adjustment. They know.",
  "The defense shifted. Someone did their homework.",
  "They'd seen {signatureName} enough times now. Counter in place.",
  "Scouting report paid off. {playerName}'s {signatureName} neutralized.",
  "{playerName}'s signature was no longer a secret. The league had adapted.",
  "They played for {signatureName}. Got it exactly right.",
  "Film work. The opponent was a step ahead this time.",
];

/** When opponents first discover / learn about a signature skill */
export const SIGNATURE_REVEAL_TEXTS: string[] = [
  "Word was getting out about {playerName}'s {signatureName}.",
  "The league was taking notes. {playerName}'s {signatureName} was on the radar.",
  "Scouts were filing reports. {signatureName} was becoming a known quantity.",
  "Other dugouts had noticed. {playerName}'s {signatureName} — catalogued.",
  "It couldn't stay hidden forever. {playerName}'s {signatureName} was out there now.",
];

/** After reinvention — the signature is archived, slate is clean */
export const REINVENTION_ARCHIVE_TEXTS: string[] = [
  "Nobody knows this version of {playerName} yet.",
  "The old {playerName} is gone. What comes next? Nobody knows.",
  "A clean slate. {playerName} is an unknown quantity again.",
  "The scouting reports are useless now. {playerName} has reinvented.",
  "{playerName} burned the book on themselves. Starting fresh.",
];

// --- Opponent Reputation / Scouting Narrative Pools ---

/** When opponent has identified a pull-happy habit and shifted (Tier 1+) */
export const SCOUT_INFIELD_SHIFT_TEXTS: string[] = [
  "The infield shifted before the pitch. They know.",
  "A pre-pitched shift. The catcher called it before the windup.",
  "Pull-shift in place. The scouting report was right.",
  "The defense moved. {playerName}'s tendency was mapped.",
  "Infield shift. Someone had done their homework.",
];

/** When opponent counters signature skill (Tier 2+) */
export const SCOUT_SIGNATURE_COUNTER_TEXTS: string[] = [
  "The catcher called for an adjustment. They know.",
  "The defense shifted. Someone did their homework.",
  "Pitching away from {playerName}'s signature. They'd seen it before.",
  "The game plan had one rule: don't let {playerName} get comfortable.",
  "Counter in place. The signature was scouted.",
];

/** When opponent uses full game plan vs player (Tier 3) */
export const SCOUT_FULL_GAMEPLAN_TEXTS: string[] = [
  "The whole team was ready for this. Film work pays off.",
  "A coordinated response. Every defender in position, every pitcher briefed.",
  "Tier-three preparation. {playerName} was the subject of a full scouting session.",
  "They had a plan for everything {playerName} does. All of it.",
  "Post-season film sessions. {playerName}'s every move, catalogued and countered.",
];

/** Off-season reputation reset (Tier 3 → Tier 1) */
export const SCOUT_OFFSEASON_RESET_TEXTS: string[] = [
  "Rosters change. The book on {playerName} needs updating.",
  "Off-season. Teams forget some of what they knew.",
  "New year, slightly softer intel. {playerName} starts fresh — sort of.",
  "Coaching turnover. Some of the institutional knowledge on {playerName} is lost.",
];

// --- Mentorship / Coaching Voices Narrative Pools ---

/** Style transfer — positive (accelerated discovery) */
export const MENTOR_STYLE_TRANSFER_POSITIVE_TEXTS: string[] = [
  "{mentorName}'s approach to {skillName} is rubbing off on {apprenticeName}.",
  "{apprenticeName} is picking up {mentorName}'s habits — the good ones.",
  "Watching {mentorName} work is an education. {apprenticeName} is paying attention.",
  "Two players, one philosophy. {apprenticeName} is absorbing {mentorName}'s craft.",
  "The lessons are quiet but real. {apprenticeName}'s {skillName} is evolving.",
];

/** Style transfer — negative (bad habit seed) */
export const MENTOR_STYLE_TRANSFER_NEGATIVE_TEXTS: string[] = [
  "{mentorName}'s tendencies don't all transfer cleanly. {apprenticeName} has picked something up.",
  "Even great mentors pass on rough edges. {apprenticeName} has a new quirk to manage.",
  "The imitation game has a cost. {apprenticeName} has inherited a tendency.",
  "Mentorship isn't just glory. {apprenticeName} absorbed a habit that'll need breaking.",
];

/** Lineage narrative — 1 generation */
export const LINEAGE_ONE_GEN_TEXTS: string[] = [
  "{playerName} learned this from {mentorName}. It shows.",
  "The {skillName} lineage runs through {mentorName}. {playerName} carries it forward.",
  "{mentorName} once showed {playerName} how this was done.",
  "This is {mentorName}'s fingerprint. {playerName} made it their own.",
];

/** Lineage narrative — 3 generations */
export const LINEAGE_THREE_GEN_TEXTS: string[] = [
  "Three generations of {skillName}. {playerName} carries the lineage.",
  "This skill has been passed down. {playerName} is the latest keeper.",
  "The chain holds. {playerName} represents the third chapter of this tradition.",
];

/** Coaching voice — Ice Veins */
export const COACHING_VOICE_ICE_VEINS = "Stay calm. You've been here a hundred times.";

/** Coaching voice — Pitch Recognition */
export const COACHING_VOICE_PITCH_RECOGNITION = "You've seen this pattern. It's the slider. Wait for it.";

/** Coaching voice — Clutch Composure */
export const COACHING_VOICE_CLUTCH_COMPOSURE = "This is redemption. Right here. Take it.";

/** Coaching voice — Veteran's Poise */
export const COACHING_VOICE_VETERAN_POISE = "Seven seasons. You know what to do.";

/** Coaching voice — Game Reading */
export const COACHING_VOICE_GAME_READING = "You've cracked his tendencies. Trust the read.";
