// The lessons themselves. Wording drafted by Claude and approved on 2026-10-06 (Khaya replied "Approved" to the
// draft in the Claude Doc "Growfit coach lessons: first batch"). Edit the wording here, in a pull request.
// One lesson per block, a blank line between blocks, each line "name: text". `parseLessons` (lib/lessons.ts)
// turns a block into a lesson with four fixed parts and drops any block that is missing a field or names an
// unknown area, so a typo hides a lesson rather than showing half of one.

import { parseLessons } from "@/lib/lessons";

const LESSON_TEXT = String.raw`
problem: ip-lose-playing-out
slug: playing-out-from-the-back
area: tactical
title: Playing out from the back
summary: Why short passes from the back get lost, and how to give the player on the ball a way out.
see: The keeper or defenders pass short and the other team wins the ball near your goal.
why: The player on the ball has no safe pass, because teammates stand behind the opponents or too close together. Or the pass is rushed because the player has not looked first.
try: Play 4 v 2 in a small grid so the player on the ball always has two ways out. Teach "look before you receive": check over your shoulder, then take the ball on your back foot. Give the full-backs permission to go wide and the keeper permission to kick long when there is no safe pass.
watch: Does the player on the ball have a pass on, or are they forced?

problem: ip-long-balls
slug: too-many-long-balls
area: tactical
title: Too many long balls
summary: Why the long ball keeps coming back, and how to build trust in the short pass.
see: The ball is kicked forward from everywhere and comes straight back.
why: Players do not trust the short pass, or nobody is close enough to receive one. Long balls feel safe because they take the ball away from your goal.
try: Set a rule in a practice game: three passes before any long ball. Praise the brave short pass even when it goes wrong.
watch: Are there teammates within a short pass when the long ball is kicked?

problem: ip-no-width
slug: spreading-out
area: tactical
title: Spreading out to give the ball carrier a pass
summary: How to get children to use the whole pitch instead of crowding the ball.
see: Everyone is bunched on one side and the player with the ball is surrounded.
why: Children chase the ball. They do not yet see the whole pitch.
try: Mark width with cones near the touchlines. Play a game where a goal only counts if a wide player touched the ball first. Younger children: "stand on the chalk".
watch: Is there a player near each touchline when you attack?

problem: ip-no-shot
slug: taking-the-shot
area: technical
title: Taking the shot in the box
summary: Why children pass up shots in the box, and how to make shooting welcome.
see: Players dribble or pass sideways in the box and the chance is gone.
why: Fear of missing, or wanting to pass to a friend. Sometimes they simply have not been told shooting is welcome.
try: Finishing games with many shots and no blame for misses. Celebrate the shot, not only the goal. Ask: "What did you see before you decided?"
watch: Count the shots, not only the goals.

problem: ip-deep-block
slug: breaking-a-deep-block
area: tactical
title: Breaking a team that sits deep
summary: For U13 and U15: how to make space against a team that keeps everyone behind the ball.
see: The other team keeps everyone behind the ball and you keep passing in front of them.
why: There is no space behind them, so you need movement and patience to make some.
try: Practise switching the ball quickly side to side so defenders have to shift. Add a runner who moves between two defenders. Shots from the edge of the box make deep teams come out.
watch: Does your team keep moving the ball, or stop and wait?

problem: oop-bunching
slug: bunching-around-the-ball
area: tactical
title: Bunching around the ball
summary: How to stop five or six players chasing the ball and leaving the rest of the pitch empty.
see: Five or six of your players surround the ball while the rest of the pitch is empty.
why: Everyone wants to help, so everyone goes to the ball.
try: Give each player a zone and a job: one pressures, one covers behind, the rest hold their line. Play a small game where only two players may go to the ball.
watch: When the other team switches play, is anyone free?

problem: oop-no-pressure
slug: pressuring-the-ball
area: tactical
title: Pressuring the player with the ball
summary: How to make sure someone always goes to the ball carrier.
see: The other team's player dribbles forward with no one close to them.
why: Each player thinks someone else will go. Nobody owns the decision.
try: Teach "nearest player goes". Practise 1 v 1 defending: approach fast, then slow down and stay low. Call a name, not "someone".
watch: Who goes to the ball first when it is won by the other team?

problem: oop-far-apart
slug: staying-connected-between-the-lines
area: tactical
title: Staying connected between the lines
summary: How to keep defenders, midfielders and forwards close enough to support each other.
see: There is a big gap between defenders, midfielders and forwards.
why: Some players stay back for safety, others push up. Nobody keeps the team connected.
try: Practise moving as a unit: when the ball goes forward, everyone steps up together. Use a rope or bibs held between three players to show the right distance.
watch: Can a pass travel through your team without a gap?

problem: oop-press-timing
slug: pressing-together
area: tactical
title: Pressing together
summary: For U13 and U15: how to agree when the team presses so the press does not break.
see: One player runs at the ball and the others stay put.
why: There is no agreed signal for when to press.
try: Agree a trigger, for example a backward pass or a poor touch. Everyone presses together on the trigger, or no one does. Practise it in a small grid with a rest between rounds.
watch: Does everyone start pressing at the same moment?

problem: oop-back-post
slug: defending-the-back-post
area: tactical
title: Defending the back post
summary: For U13 and U15: how to stop runners getting free at the far post.
see: The other team scores from a cross at the far post.
why: Players watch the ball and forget the runner behind them.
try: Teach "see the ball and your player". Practise defending crosses with two attackers and two defenders. Name who marks the back post before every corner and cross.
watch: Does anyone check behind them before the cross?

problem: at-kick-away
slug: keeping-the-ball-when-you-win-it
area: tactical
title: Keeping the ball when you win it
summary: How to stay calm in the moment after winning the ball.
see: The ball is won and immediately booted forward or out.
why: The moment after winning the ball feels dangerous.
try: Practise the first pass after winning it: look up and play to a free teammate. Praise the calm touch.
watch: What is the first thing your team does when it wins the ball?

problem: at-no-support
slug: supporting-the-player-who-wins-it
area: tactical
title: Supporting the player who wins the ball
summary: How to get teammates running forward the moment the ball is won.
see: One player wins the ball and is alone.
why: The rest of the team is still in defensive mode.
try: Teach "win it, run": the two nearest teammates move into space at once. Play a transition game where winning the ball means three players go.
watch: How many teammates are within a pass when the ball is won?

problem: at-use-space
slug: using-the-space-when-they-lose-it
area: tactical
title: Using the space when the other team loses the ball
summary: For U13 and U15: how to punish a team that is out of position.
see: The other team loses the ball with players out of position and your team is slow to punish it.
why: Players do not scan for open space in the first seconds.
try: Practise a quick forward pass in the first three seconds. Ask: "Where was the space? Who saw it?"
watch: Is there a pass forward in the first three seconds after winning it?

problem: dt-watch
slug: chasing-after-you-lose-it
area: psychological
title: Chasing after you lose the ball
summary: How to get players working to win the ball back instead of standing and watching.
see: The ball is lost and players stand still.
why: Disappointment, or they think it is someone else's job.
try: Teach the "five-second chase": everyone near the ball tries to win it back for five seconds. Make it a game with a prize for winning it back.
watch: What do players do in the first moments after losing it?

problem: dt-slow-recovery
slug: getting-back-behind-the-ball
area: tactical
title: Getting back behind the ball
summary: How to help players know where to run when the ball is lost.
see: The other team breaks while your players are still up the pitch.
why: Players do not know where to run back to.
try: Practise "get goal-side": run back between the ball and your goal. Use cones to mark a recovery line.
watch: How long until your team is back behind the ball?

problem: dt-counter
slug: stopping-the-counter-attack
area: tactical
title: Stopping the counter-attack
summary: For U13 and U15: how to slow the other team's break in the first seconds.
see: You lose the ball and they are through before you react.
why: Too many players are ahead of the ball and the nearest ones do not delay.
try: Teach the nearest player to slow the ball carrier and not dive in, so teammates can recover. Keep one or two players back when you attack.
watch: Who is the nearest player when the ball is lost, and what do they do?

problem: sp-marking
slug: marking-at-corners
area: tactical
title: Marking at corners
summary: How to agree who marks whom before the corner is taken.
see: Attackers are free in the box.
why: Marking was never agreed.
try: Write the marking down before the match and tell each child their player. Practise corners in training with a simple plan.
watch: Does each defender know their player before the corner?

problem: sp-waste-own
slug: our-own-corners-and-free-kicks
area: tactical
title: Making use of our own corners and free kicks
summary: How to give your own set pieces a simple plan.
see: The ball goes to the first defender or out.
why: No plan for where the ball goes.
try: Agree one or two simple routines, like a short corner or a near-post run. Practise them often.
watch: Does the set piece end with a shot or a pass?

problem: sp-throw-ins
slug: keeping-the-ball-from-throw-ins
area: technical
title: Keeping the ball from throw-ins
summary: How to give the thrower two good options.
see: The thrower has nobody to throw to, or the receiver is marked.
why: Players stand still waiting for the throw.
try: Teach two players to move: one close, one a bit further. The thrower looks first, then throws. Practise throw-ins in a game.
watch: Does the thrower have two options?

problem: sp-second-balls
slug: second-balls-after-set-pieces
area: tactical
title: Second balls after set pieces
summary: For U13 and U15: how to stay switched on after the first clearance.
see: The first ball is cleared but the ball drops and they score.
why: The team relaxes after the first contact.
try: Place two players just outside the box to win the second ball. Practise reacting after a clearance.
watch: Who is outside the box after the first contact?
`;

export const LESSONS = parseLessons(LESSON_TEXT);
