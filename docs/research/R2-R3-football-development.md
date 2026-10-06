# R2–R3: Football development frameworks and Match → Training → Follow-up

Desk research for Growfit (Growfit Sports Academy, Greater Durban, U11/U13/U15). Researched 2026-10-06. Growfit is **not** endorsed by SAFA, CAF or FIFA; the sources below are background reading only.

Labels: **FACT** = stated directly by an official body or document. **FINDING** = peer-reviewed research result. **INFERENCE** = our interpretation for Growfit.

---

## R2 — Development frameworks relevant to a SA grassroots academy

### What this means for Growfit

1. **Build the competency framework as configurable data, not hard-coded.** SAFA's public material describes a philosophy (2018) and a National Development Plan, but we found no current, public age-band youth curriculum we could adopt. Ship a default framework (our 5 categories + 30 attributes) and let the academy director remap it later, e.g. to the FA 4 Corners or a future SAFA document.
2. **Use age bands that match published curricula.** Football Australia: 9–13 = "Skill Acquisition Phase" (first touch, striking the ball, 1v1, running with the ball); 13–17 = "Game Training Phase". In practice U11 and U13 fall under functional skills and U15 under team application. The framework should carry an `age_band` on every competency, so U11 objectives default to individual skills and not to team shape.
3. **Keep assessment multidimensional and never collapse it into one score.** The FA 4 Corner Model says a player "could be both mature and immature within a single corner". The IOC says selection should be based on a "long-term, individually variable developmental context". Show profiles and trends. Do not rank players by one composite number.
4. **Add relative-age and maturation guardrails.** Show birth quarter next to ratings, and flag squads or "top player" lists that are heavily Q1 (January–March births). Relatively older and early-maturing players are over-selected, while long-term outcomes often reverse.
5. **Treat enjoyment and retention as core outcomes.** Dropout is driven by lack of enjoyment, perceived competence, relationships, lack of playing time and later birthdate. Growfit already tracks minutes and attendance, so it can surface "low minutes + falling attendance" as a retention risk next to the existing 75% welfare trigger.
6. **Model coach qualifications.** SAFA/CAF licences run D → C → B → A → Pro. The D licence is the grassroots entry point, and the C licence requires a D certificate at least 8 months old plus an activity report. Store each coach's licence and date, and let the platform export coaching activity logs, which helps volunteer coaches with C-licence applications.
7. **Safeguarding is a licensing-grade expectation.** CAF club licensing expects a child safeguarding officer and policy, and FIFA Guardians sets out 5 principles and 5 steps. This supports filling the open Safeguarding Officer seat and giving it a named role in the platform.
8. **Keep MYSAFA as the source of truth for registration.** MYSAFA is SAFA's registration system and checks IDs against Home Affairs. Growfit should store the SAFA/MYSAFA number and status and should not try to replicate MYSAFA.
9. **CAF's youth development programme checklist can serve as a maturity roadmap:** written philosophy, organisation chart, staff qualifications, age-group education programme, medical support, and schooling commitment. These are useful health-report sections even though Growfit is not subject to CAF licensing.

### Findings

| Label | Finding | Source | Date | URL |
|---|---|---|---|---|
| FACT | SAFA approved minimum coaching licences from the 2024/25 season: CAF C minimum for ABC Motsepe and Regional League, CAF A/B for PSL/NFD. Officials said the regulations apply "down" to LFAs, but no junior-specific minimum was stated. | SABC Sport | 2023-12-10 | https://www.sabcsport.com/soccer/news/safa-approves-implementation-of-coaching-standards-in-sa-from-2024-2025-season |
| FACT | C licence: 80 hours (2 × 5 days plus 6 weeks distance learning). Prerequisites are a SAFA D licence at least 8 months old, coaching experience and a typed activity report. Coaches register via their SAFA Region. | SAFA | 2014-04-11 (old page, still live) | https://www.safa.net/coaching-departmental-news/level-1-coaching-course/ |
| FACT | SAFA's old Level 1/2/Pro qualifications were mapped to CAF B/A licences via an upgrade process that was later suspended while CAF revised its curriculum. | SAFA | 2019-04-10 | https://www.safa.net/news/caf-coaching-licensing-system-leave-safa-systems-levels/ |
| FACT | SAFA published a 2025–26 course calendar. The linked PDF returned 404 when checked, so specialist courses (GK, futsal, etc.) could **not be verified**. | SAFA | 2025 | https://www.safa.net/coaching-departmental-news/caf-safa-coaching-courses-for-2025/ |
| FACT | Vision 2022 goals: a top-3 Africa ranking, 10% of the population playing, schools football and women's football. The page is **dated (2016) and the plan's target year has passed**. | SAFA | 2016-09-19 | https://safa.net/vision-2022/ |
| FACT | SA Football Philosophy: "players learn the game by playing the game", individual expression serving the team, sessions that mirror match conditions, versatility. Search snippets also list 7 NDP streams, including talent ID "starting at U13". | SAFA | 2018-02-09 | https://www.safa.net/news/understanding-south-african-football-philosophy-part-1/ |
| FACT | MYSAFA: FIFA-integrated registration verified against Home Affairs, with player ID cards and a verifier app. In 2019 it covered 342 LFAs and over 40,000 clubs; KZN had the most registrations (57,113). | SAFA | 2019-05-14 | https://www.safa.net/news/mysafa-player-registration-system-hits-250k-mark/ |
| FACT | SAFA launched a Women's Football Strategy for a grassroots-to-professional pathway. No public detail on girls' U11–U15 programmes was found. | SAFA | 2025-03-31 | https://www.safa.net/news/safa-launches-womens-football-strategy/ |
| FACT | A SAFA × FIFA TDS U15 interprovincial tournament was set up for talent ID and a player database. | SAFA | 2023-02-08 | https://www.safa.net/news/safa-launches-innovative-u15-interprovincial-tournament/ |
| FACT | A FIFA TDS mentor at SAFA said talent ID "has many angles… some players show more maturity than others at a young age". | SAFA | 2023-04-20 | https://www.safa.net/news/fifa-talent-development-scheme-mentors-satisfied-with-safas-progress/ |
| FACT | CAF Men's Club Licensing (2022) requires a written youth development programme for boys and girls, covering philosophy, organisation, staff, age-group football education, laws of the game, medical support and schooling (Art. 25). It also requires one youth team aged 10–14 and one aged 15–21 (Art. 26), a qualified coach per youth team (Art. 51), and states that clubs "should" have a child safeguarding officer and policy (Art. 29). | CAF | 2022 edition | https://www.cafonline.com/media/uc3n4fvm/g8qdfaxgzg0ixkcvmh5t.pdf |
| FACT | FIFA TDS: elite academies in member associations, with 12–15-year-olds needing at least 5 sessions and 1 game per week. USD 200m for 2023–26. | FIFA | 2024-01-04 | https://inside.fifa.com/advancing-football/news/fifa-talent-development-scheme-makes-further-strides-in-2023 |
| FACT | FIFA Grassroots Coaching Essentials sets 6 principles: fun, safe, effective (clear learning objectives), inclusive, game-based, and keeping players active. | FIFA Training Centre | 2025-01-21 | https://www.fifatrainingcentre.com/en/practice/grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/jene-general-principles-1.php |
| FACT | FIFA Guardians is a safeguarding toolkit for member associations built on "5 principles and 5 steps", developed with UNICEF and the Council of Europe. | FIFA | 2019-07-09 | https://inside.fifa.com/media-releases/fifa-launches-child-safeguarding-programme-and-toolkit-fifa-guardianstm |
| FACT | Football for Schools launched in SA at the SAFA Technical Centre on 2022-08-26. Teachers from 52 LFAs were trained as coaches. | IOL / search result | 2022 | https://www.iol.co.za/sport/soccer/fifa-football-for-schools-programme-excites-safa-president-danny-jordaan-15481864-2273-40c7-bc49-a4bc69bb6738 |
| FACT | FA 4 Corner Model covers technical/tactical, physical, psychological and social development. The corners interact, and a player can be "both mature and immature within a single corner". | The FA (England Football Learning) | 2020-05-12 | https://learn.englandfootball.com/articles/resources/2022/the-fa-4-corner-model |
| FACT | Football Australia's Skill Acquisition Phase (ages 9–12/13) focuses on 4 functional game skills, said to be about 95% of in-possession actions, with one theme per session. | Football Australia | undated page | https://playfootball.com.au/ncdp/toolkits/football-experience/sap |
| FACT | US Soccer PDIs (2017) set small-sided standards for ages 6–12 and birth-year registration to align with FIFA. | US Soccer | 2017-08-01 | https://www.ussoccer.com/stories/2017/08/us-soccer-player-development-initiatives-officially-roll-out |
| FACT | KNVB plays 6v6 up to U10 and 8v8 for U11/U12 to increase involvement, with post-match rituals. | KNVB | 2018/19 format | https://knvb.h5mag.com/dutch_youth_football/u11s_u12s |
| FINDING | Across team sports, relative age effects favour older-born players in the short term, while long-term career outcomes often reverse in favour of younger-born players. | de la Rubia et al., *Front Psychol* | 2020-09-23 | https://pmc.ncbi.nlm.nih.gov/articles/PMC7538615/ |
| FINDING | In Ireland's national pathway (U13–U16, n=159), early maturers were over-selected in most positions, most strongly at centre-back (d=1.65). | Sweeney et al., *Biol Sport* | 2023 | https://pmc.ncbi.nlm.nih.gov/articles/PMC10286617/ |
| FINDING | Dropout drivers (43 studies): lack of enjoyment, perceived competence, social pressures, competing priorities, and maturation/injury. Contextual drivers include poor coach/teammate relationships, lack of playing time and later birthdate. Abstract seen via search listing only. | Crane & Temple, *Eur Phys Educ Rev* | 2015 | https://journals.sagepub.com/doi/abs/10.1177/1356336x14555294 |
| FINDING | The IOC consensus advises avoiding early specialisation. It says selection should rest on a long-term, individually variable context, coaching should focus on mastery and enjoyment, and organisations should implement safeguarding. | Bergeron et al., *BJSM* | 2015 | https://drugfreesport.org.za/wp-content/uploads/2018/07/IOC-consensus-on-youth-athletic-development-1.pdf |

### Open questions (R2)
- Is there a current SAFA youth curriculum or NDP document with U11–U15 competencies? Ask the GDFL/LFA technical officer.
- Do GDFL junior leagues require coach licences or MYSAFA registration for U11?
- Which licences do Buhle, Sphe and Khaya hold, and what does the 2025–26 KZN course calendar look like?
- Should Growfit adopt 8v8 or small-sided norms for U11 (KNVB/US Soccer), or does GDFL fix the format?

---

## R3 — Match → Training → Follow-up, and youth readiness

### What this means for Growfit

1. **Copy Football Australia's "Football Problem" loop almost one-to-one:**
   - **Identify:** which main moment (in possession, out of possession, and the two transitions)
   - **Define with the 5 Ws:** what, who, where, when, why
   - **Write a Session Objective:** "improve my team's ability to…"
   - **Design a session** that ends with a game that re-creates the problem
   - **Evaluate:** objective achieved and problem solved, each rated yes/partially/no, plus next steps

   This is an official, simple, field-tested template for the feature's data model.
2. **Adjust the loop by age band.** For U11/U13, a "problem" should map to one of the 4 functional skills or to a 4-Corner/development category (e.g. "loses ball under pressure → first touch"). For U15 it can map to a team principle. Use the configurable framework to limit the choices.
3. **Follow-up means coach judgement plus a few observable tags, not stats.** Grassroots coaches have no video or GPS. The next-match check should be: "Did we see the problem again? yes / partially / no", plus 1–3 optional tallies the coach defines (e.g. "times we played out from the back"). Track the trend over 2–3 matches before marking an item "resolved".
4. **Build reflection in.** The FA's coach planning and reflective model (player engagement, practice design, intended outcomes, coach behaviour) can be a 4-question post-session prompt. That keeps the loop about coaching quality as well as player deficits.
5. **Don't sell "tactical periodisation".** A systematic review found no empirical studies. Use plain language: "game model → principles → session objective".
6. **Readiness for U11–U15 should avoid adult load metrics.** Don't compute ACWR. The ratio has statistical flaws and the "sweet spot" did not hold up. Use attendance, minutes played, a simple session RPE for U13+ and a 3–4 item wellbeing check, and treat them as conversation prompts, not risk scores.
7. **Track growth, the single most useful readiness signal in this age range.** Measure height (and ideally sitting height and parents' heights) every term. Flag growth of ≥7.2 cm/year, or knee/heel pain (possible Osgood-Schlatter or Sever's), and suggest reduced load and a parent conversation. This links to the existing Injury & Medical Policy.
8. **Pick RPE scales that suit the age.** sRPE validity is weak around age 11 and stronger from about U15, so ask U11s for a smiley-face effort scale or skip it. Use a 0–10 scale for U13/U15 and practise it first.
9. **Hold an IOC hard rule as a product rule:** no training or playing on an injured area while in pain or not fully recovered. A "pain today?" flag should block "ready" status.

### Findings

| Label | Finding | Source | Date | URL |
|---|---|---|---|---|
| FACT | "Training only exists because there is a Match… we measure the effectiveness of Training by evaluating performance in matches." The Match is the centre of the coaching model. | Football Australia, *The Football Coaching Process* (K. Cross) | 2019-01 | https://playfootball.com.au/sites/play/files/2021-01/The%20Football%20Coaching%20Process.pdf |
| FACT | Same document: a football problem is a Key Principle not seen in a Main Moment. The coach defines it with the 5 Ws, writes a Session Objective, re-creates the problem in the training game, then evaluates "objective achieved? / problem solved?" as yes/partially/no plus next steps. | Football Australia | 2019-01 | https://playfootball.com.au/sites/play/files/2021-01/The%20Football%20Coaching%20Process.pdf |
| FACT | Same document: the coach's role at 9–13 is "to prepare players for team football by developing the functional game skills". At 13–17 it is applying them in a team setting. | Football Australia | 2019-01 | https://playfootball.com.au/sites/play/files/2021-01/The%20Football%20Coaching%20Process.pdf |
| FACT | The coach planning and reflective model (Muir, Morgan & Abraham 2011) covers player engagement, practice design, intended outcomes and coach behaviour, with planning and reflection prompts for each. | England Football Learning | 2025-09-30 | https://learn.englandfootball.com/articles-and-resources/coaching/resources/2025/The-coach-planning-and-reflective-model |
| FACT | Matchday planning: set the match purpose (winning, development or fun) and work backwards to the training focus. Share playing time across quarters or matches at grassroots. | England Football Learning | 2024 | https://learn.englandfootball.com/articles-and-resources/coaching/resources/2024/How-coaches-can-plan-for-matchday |
| FINDING | Systematic review of tactical periodisation: "no empirical research" found, so it is premature to support it scientifically. | Afonso et al., *Human Movement* | 2020-06-16 | https://hummov.awf.wroc.pl/A-systematic-review-of-research-on-Tactical-Periodization-absence-of-empirical-data,122349,0,2.html |
| FINDING | The ACWR "sweet spot" (0.8–1.3) was not associated with lower injury rates in elite female soccer. Most injuries occurred outside it. | Sedeaud et al., *Front Physiol* | 2020-08-28 | https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2020.01034/full |
| FINDING | ACWR has mathematical coupling and other conceptual flaws, and there is no evidence to support using it for injury-risk management. Seen via search listing. | Impellizzeri et al., *IJSPP* | 2020 | https://www.semanticscholar.org/paper/Acute:Chronic-Workload-Ratio:-Conceptual-Issues-and-Impellizzeri-Tenan/ede5743a426fd6429d28f8505500a3f771dbcf8b |
| FINDING | Growth-related injuries cluster around PHV (about ±6 months; boys typically about 13.5 years). Growth of ≥7.2 cm/year is associated with higher injury risk. Osgood-Schlatter and Sever's peak pre/circa-PHV. Serial height measurement is recommended. | Hall & Erskine, *Sports Med* (narrative review, 26 studies) | 2025-11 | https://pmc.ncbi.nlm.nih.gov/articles/PMC12913351/ |
| FINDING | Khamis-Roche (height, weight, age and parents' heights) gives a non-invasive % of predicted adult height, with bands <88% pre-PHV, 88–95% circa-PHV and >95% post-PHV. It is less precise during the U12–15 growth spurt. Seen via search listing. | Parr, PhD thesis, MMU | 2020 | https://e-space.mmu.ac.uk/628342/1/Growthandmaturationineliteyouthsoccerplayers-280721.pdf |
| FINDING | Meta-analysis (16 studies, 278 adolescents): sRPE vs HR r≈0.74, with CR-100 better than CR-10. Validity is much weaker in about 11-year-olds (r 0.17–0.34) and rises with age. Familiarisation is needed. | Liu et al., *BMC Sports Sci Med Rehabil* | 2023-08-12 | https://pmc.ncbi.nlm.nih.gov/articles/PMC10422765/ |
| FINDING | Hooper Index (sleep, stress, fatigue, soreness on 1–10 scales) is widely used in youth football, but its reliability has been tested mainly in adults. Recommended as a daily check in 16–18-year-old national-team players. | Andersen et al., *Front Sports Act Living* | 2023-12-14 | https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2023.1197766/full |
| FINDING | IOC: overuse injury arises from loads that exceed safe thresholds during growth. Recommendations: diversify exposure, ensure rest, and "no youth athlete should compete… when in pain or not completely rehabilitated". | Bergeron et al., *BJSM* | 2015 | https://drugfreesport.org.za/wp-content/uploads/2018/07/IOC-consensus-on-youth-athletic-development-1.pdf |
| INFERENCE | For an academy with 2 training sessions and 1 match a week, attendance plus minutes plus growth plus a pain flag captures most of the readiness value. sRPE and wellbeing add value mainly for U15. | Growfit synthesis | 2026-10-06 | — |

### Open questions (R3)
- Will coaches enter a 5 Ws problem on a phone within 10 minutes of the final whistle? This needs a prototype test with Sphe or Khaya.
- How many open "problems" per squad at once? Football Australia implies one session objective per session, so suggest a limit of 1–2 active items.
- Consent: height, parents' heights and pain flags are health data under POPIA. Can existing medical consent cover them, or is a new clause needed?
- Should players give input through the existing self-assessment ("what did you find hard in the match?") to co-own the follow-up?
- We found no validated wellbeing tool for under-13s. A 3-item smiley scale is a pragmatic guess and should be labelled as such.
