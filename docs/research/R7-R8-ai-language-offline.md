# R7–R8 — AI patterns & cost; languages, offline & WhatsApp

Desk research, captured 2026-10-06. Labels: **FACT** = stated by an official/primary source; **FINDING** = reported by a credible secondary source or study; **INFERENCE** = our reasoning from the facts. Prices are USD and change often, so check them again before budgeting.

---

## R7.1 Gemini API: models, cost, data use

### What this means for Growfit
- **Blocker to resolve first:** the Gemini API Terms say the Services must not be used in an app "directed towards or is likely to be accessed by individuals under the age of 18". Growfit has a player role (`claim_player_profile`, migration 034). Either (a) keep AI features completely out of player-facing surfaces and say so in writing, or (b) get a legal read, or move to Vertex AI (Google Cloud terms) for AI calls. Treat this as a legal question, not a technical one.
- **Do not send children's data to the free tier.** The terms say unpaid-tier prompts and responses are used to improve Google products, may be read by human reviewers, and that you should "not submit sensitive, confidential, or personal information". This conflicts with POPIA duties for children's data. Switch on billing (the Paid tier) before any player name, medical note, attendance pattern or voice note reaches Gemini. Until then, pseudonymise (replace names with IDs, remove ID numbers and medical details).
- **Model choice:** the code uses `gemini-3.6-flash` ($0.75 in / $3.75 out per 1M tokens until 31 Dec 2026, then double). For bulk summarisation, `gemini-3.5-flash-lite` ($0.30 / $2.50, audio input included) is about 2–3× cheaper. Keep Flash for reasoning-heavy reports. Use Pro only on demand (`gemini-3.1-pro-preview` has no free tier).
- **Budget for the 1 Jan 2027 price step-up** on the 3.6/3.7/3.8 Flash family. Pin model IDs in config, not code, so you can switch with one change.
- **Batch mode (50% off, 24-hour target)** suits the weekly or termly jobs: the academy-health report, season development summaries, attendance-welfare digests. It does not suit interactive coach flows.
- **Caching:** implicit caching is on by default (2.5+). Put the stable system prompt and policy text *first* so it is a shared prefix. The minimum is 4,096 tokens on the 3.x Flash models, so caching only helps with long policy or context preambles.
- **Structured output:** always use a JSON schema (Zod in the JS SDK). Google itself says to "always validate values in your application". Validate with Zod server-side and reject or flag the output rather than auto-repairing it.
- **Grounding with Google Search:** 5,000 free requests a month, then $14 per 1K on the 3.x models. It is rarely needed: Growfit's answers should be grounded in *its own* data and policies, not the web.
- **Free-tier rate limits are not published as numbers** on the docs page. Read them in AI Studio and keep the existing retry, fallback and backoff.

### Findings
| Label | Finding | Source | Date | URL |
|---|---|---|---|---|
| FACT | API users must be 18+ and must not use the Services in an app "directed towards or is likely to be accessed by individuals under the age of 18". | Gemini API Additional Terms (eff. 23 Mar 2026, upd. 28 Apr 2026) | 2026-10-06 | https://ai.google.dev/gemini-api/terms |
| FACT | Unpaid Services: Google uses submitted content and responses to "provide, improve, and develop Google products…"; human reviewers may read API input/output; "Do not submit sensitive, confidential, or personal information to the Unpaid Services." Paid Services: prompts are not used to improve products and are processed under the DPA. | Gemini API Terms | 2026-10-06 | https://ai.google.dev/gemini-api/terms |
| FACT | gemini-3.6/3.7/3.8-flash: $0.75 in / $3.75 out per 1M (through 31 Dec 2026), then $1.50 / $7.50; caching $0.075/1M; free tier yes. | Gemini pricing | 2026-10-06 | https://ai.google.dev/gemini-api/docs/pricing |
| FACT | gemini-3.5-flash-lite: $0.30 in (text/image/video/audio) / $2.50 out; batch $0.15 / $1.25; free tier yes. gemini-3.1-flash-lite: $0.25 text, $0.50 audio in / $1.50 out. | Gemini pricing | 2026-10-06 | https://ai.google.dev/gemini-api/docs/pricing |
| FACT | gemini-3.1-pro-preview: $2.00 / $12.00 per 1M (≤200k context); no free tier. | Gemini pricing | 2026-10-06 | https://ai.google.dev/gemini-api/docs/pricing |
| FACT | Grounding with Google Search (3.x models): 5,000 free requests/month, then $14 per 1,000. | Gemini pricing | 2026-10-06 | https://ai.google.dev/gemini-api/docs/pricing |
| FACT | Batch API: 50% discount, 24-hour target, inline up to 20 MB or JSONL up to 2 GB; results kept 6 weeks. | Batch mode docs | 2026-10-06 | https://ai.google.dev/gemini-api/docs/batch-mode |
| FACT | Implicit caching is on by default for Gemini 2.5+; minimum 4,096 tokens on 3.5–3.8 Flash. | Caching docs | 2026-10-06 | https://ai.google.dev/gemini-api/docs/caching |
| FACT | Structured output guarantees syntactically valid JSON; "always validate values in your application"; large or deeply nested schemas may be rejected. | Structured output docs | 2026-10-06 | https://ai.google.dev/gemini-api/docs/structured-output |
| FACT | Rate limits vary by tier and are shown in AI Studio; no fixed numbers on the docs page. | Rate limits docs | 2026-10-06 | https://ai.google.dev/gemini-api/docs/rate-limits |
| INFERENCE | Growfit's player role makes the app "likely to be accessed" by under-18s, so the Gemini API age clause applies unless AI is architecturally isolated from player access. | Repo + terms | 2026-10-06 | (repo: supabase/migrations/034_claim_player_profile_verification.sql) |

### Open questions
- Will the academy enable Paid billing, and who holds the card and budget (Buhle, as Finance)?
- Is Vertex AI (Google Cloud terms) a better contractual fit for a children's platform? This needs a legal or Google answer.
- What are the actual free-tier RPM/RPD figures on Growfit's key? Check in AI Studio.

---

## R7.2 Speech-to-text: isiZulu and South African English voice notes

### What this means for Growfit
- **Gemini audio is cheap.** Audio costs 32 tokens per second, so a 2-minute note is 3,840 tokens. On `gemini-3.5-flash-lite`, transcribing and summarising one note costs about **$0.0025** (≈3,840 × $0.30/1M + ~500 output × $2.50/1M). That is under 5 SA cents (INFERENCE). Cost is not the constraint. Accuracy is.
- **isiZulu accuracy is unproven.** The dedicated `gemini-3.5-transcribe` model does **not** list Zulu, Xhosa or en-ZA (it lists af-ZA). General Gemini models accept any audio, but Google publishes no quality figure for isiZulu.
- **Google Cloud Speech-to-Text Chirp 3 does list `zu-ZA`** (also af-ZA and xh-ZA). It is the officially supported Google route for isiZulu ASR. en-ZA is not listed for v2.
- **Lelapa AI Vulavula** (South African, isiZulu-focused) publishes its own isiZulu WER of 45.7%, or 36.9% after post-processing (call-centre/general domain, model dated Nov 2023). Even a specialist gets roughly 1 word in 3 wrong. Plans start at $9.99/month for 1,000 calls.
- **Recommendation:** treat a voice note as a *draft aid*, never a record. Run the pipeline as: voice note → transcript shown to the coach → coach edits → AI summary → coach approves. Store the coach-approved text and delete the raw audio after a short retention period (POPIA minimisation).
- **Pilot before committing:** collect 20 real 1–2 minute coach notes (English, isiZulu, code-switched). Run them through Gemini Flash-Lite, Chirp 3 zu-ZA and Vulavula, and have a fluent coach (Sphe or Khaya) score them. Expect code-switching (isiZulu with English football terms) to be the hardest case.
- Inline audio is capped at 20 MB per request, which is fine for compressed Opus/WebM voice notes of a few minutes.

### Findings
| Label | Finding | Source | Date | URL |
|---|---|---|---|---|
| FACT | Gemini audio = 32 tokens/sec (1 min = 1,920 tokens); max 9.5 h per prompt; inline request ≤20 MB; audio is downsampled to 16 kbps mono. | Gemini audio docs | 2026-10-06 | https://ai.google.dev/gemini-api/docs/audio |
| FACT | gemini-3.5-transcribe: $0.003/min audio in + $0.002/min text out; supported list includes af-ZA but not Zulu, Xhosa or en-ZA. | Pricing; model page | 2026-10-06 | https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe |
| FACT | Cloud Speech-to-Text v2 lists zu-ZA for chirp_3 (punctuation, model adaptation), chirp_2 (+ word-level confidence) and chirp; no en-ZA row found. | Cloud STT language table | 2026-10-06 | https://docs.cloud.google.com/speech-to-text/v2/docs/speech-to-text-supported-languages |
| FACT | Vulavula isiZulu WER 0.4570 (general + call centre); 0.3692 after post-processing; model released 7 Nov 2023. | Lelapa docs | 2026-10-06 | https://docs.lelapa.ai/transcribe/model/isizulu-sesotho |
| FINDING | Vulavula plans: Dev $9.99/mo (1,000 calls), SMME $49/mo (10,000 calls); 100 free calls per key. | Lelapa pricing (via search summary) | 2026-10-06 | https://lelapa.ai/pricing |
| FINDING | AfriVox-v2 (May 2026) benchmarks Gemini 3 Flash against African-specialist ASR on noisy, in-the-wild African speech and reports a substantial generalisation gap. Per-language figures were not verified here. | arXiv 2605.03590 | 2026-10-06 | https://arxiv.org/abs/2605.03590 |
| INFERENCE | About $0.0025 per 2-minute note on Flash-Lite; 500 notes per season ≈ $1.25. | Calculation from pricing | 2026-10-06 | — |

### Open questions
- What is the Cloud STT Chirp 3 price per minute? The pricing page could not be read; check https://cloud.google.com/speech-to-text/pricing.
- Will coaches actually record notes, or type? Test this in the pilot.

---

## R7.3 Evaluation, hallucination control, provenance

### What this means for Growfit
- **Build a small "golden set"** of 30–50 real, anonymised cases per AI feature (match report, development summary, welfare flag). Re-run it on every prompt or model change and diff the results. Have a coach grade them on a 1–3 rubric: accurate / useful / safe.
- **Ground every claim in Growfit data.** Pass the records in, require the model to cite record IDs (attendance row, match, milestone), and reject any output that cites an ID not in the input.
- **Do not let the model compute numbers.** Calculate attendance %, ratings and thresholds in SQL. The model only phrases them.
- **Show provenance on every AI draft:** an "AI draft — not yet approved" badge, "Based on: 6 sessions, 2 matches (dates)", the model name and generation time. On approval, log the approver, timestamp and any edits.
- **Avoid fake confidence numbers.** LLM self-reported confidence is not calibrated. Show *data sufficiency* instead (for example "only 2 sessions this term — low evidence").
- **Never auto-send** safeguarding, discipline or medical wording. Use fixed, human-written templates for those, with AI suggesting at most.
- **UNICEF Guidance on AI and Children v3 (2025):** be transparent that content is AI-generated, avoid anthropomorphising, use age-appropriate language and protect child data. Adopt it as the reference policy.

### Findings
| Label | Finding | Source | Date | URL |
|---|---|---|---|---|
| FACT | UNICEF Guidance on AI and Children 3.0 (Dec 2025) sets 10 requirements, including safety, data/privacy protection, and transparency/explainability/accountability. It says to disclose AI to children and caregivers and to avoid anthropomorphism. | UNICEF Innocenti | 2026-10-06 | https://www.unicef.org/innocenti/reports/policy-guidance-ai-children |
| FACT | Google: schema-valid JSON still needs semantic validation. | Gemini structured output docs | 2026-10-06 | https://ai.google.dev/gemini-api/docs/structured-output |
| INFERENCE | Human-in-the-loop approval is already Growfit policy. The gaps are a regression set, citation checks and an approval audit trail. | — | 2026-10-06 | — |

---

## R8.1 Language demographics and preference

### What this means for Growfit
- **80% of KwaZulu-Natal residents speak isiZulu most often at home; 14.4% speak English** (Census 2022). Most Growfit parents are likely isiZulu-first.
- Keep **English as the canonical and legal language** (consent forms, policies). Offer **isiZulu versions of parent-facing messages** such as fixtures, reminders and match summaries.
- Evidence on language preference is mixed. Studies show many SA parents prefer *English instruction* for their children, yet researchers routinely use the home language to engage parents. **Ask each parent** at registration ("Messages in: English / isiZulu / both") rather than assuming.
- Default to **both** (short isiZulu first, then English) for broadcast announcements during a pilot, and measure read and response rates.

### Findings
| Label | Finding | Source | Date | URL |
|---|---|---|---|---|
| FACT | KZN, Census 2022: 80.0% (9.6 m people aged 1+) speak isiZulu most often in the household; English 14.4%; isiXhosa 3.1%; no notable change since 2011. | Stats SA, Provincial Profile KZN (Report 03-01-74), p.41 | 2026-10-06 | https://www.statssa.gov.za/publications/Report-03-01-74/Report-03-01-742022.pdf |
| FINDING | Many SA parents favour English as the language of instruction for perceived opportunity, even when isiZulu is the home language. | Mashiya (ERIC); DBE LOLT report | 2026-10-06 | https://files.eric.ed.gov/fulltext/EJ1187409.pdf |

### Open questions
- What is the eThekwini-specific split? Durban metro likely has a higher English share. Check the Stats SA municipal tables or SuperWEB2.

---

## R8.2 Machine translation for isiZulu

### What this means for Growfit
- Use MT (Gemini or Google Translate) **only for low-stakes operational messages**: times, venues, kit reminders. A fluent coach reviews each message before it is sent, which matches the existing approval rule.
- **Never machine-translate consent, safeguarding, discipline or medical text.** Commission a professional isiZulu translation once per template (6 registration documents + 8 policies), store it as a fixed template, and version it.
- Build a **Growfit glossary** (e.g. "consent", "guardian", "suspension", "injury" in isiZulu) reviewed by Khaya/Sphe, and inject it into translation prompts for consistency.
- Research shows LLMs still trail dedicated MT systems for low-resource targets, and isiZulu is mid-tier for Gemini in a 2026 round-trip benchmark. Expect errors in register and in negation, which is dangerous in consent wording.
- Show the English original next to the translation for parents ("Read in English").

### Findings
| Label | Finding | Source | Date | URL |
|---|---|---|---|---|
| FINDING | In a multi-system study, Google Translate generally outperformed Gemini Pro and GPT models, followed by NLLB; general LLMs had not surpassed dedicated MT into non-English, especially low-resource languages. | Akter et al., "An In-depth Look at Gemini's Language Abilities" | 2026-10-06 | https://arxiv.org/pdf/2312.11444 |
| FINDING | SSA-COMET evaluates GPT-4, Gemini-1.5, Claude-3.5, Google Translate and NLLB on under-resourced African languages. Automatic metrics for these languages are themselves unreliable. | arXiv 2506.04557 | 2026-10-06 | https://arxiv.org/pdf/2506.04557 |
| FINDING | AfriSpeech round-trip word-level MT benchmark places Zulu at 53.3% (medium tier) for Gemini. | AfriSpeech GitHub (via search summary; not verified in detail) | 2026-10-06 | https://github.com/AfriSpeech/gemini-afro-mt-bench |

### Open questions
- What is the budget and who supplies a certified isiZulu translation of the 6 registration documents? A university language unit or PanSALB-accredited translator are options.

---

## R8.3 Offline-first PWA with Supabase

### What this means for Growfit
- **Scope offline to the two coach jobs that matter:** taking attendance (P/A/L/E) and entering match ratings/notes at the field. Everything else can be online-only with cached read views.
- **Start with a hand-rolled outbox:** an IndexedDB queue (`idb`) of idempotent mutations (client-generated UUID + `updated_at`). Flush it on the `online` event, on app open and on a manual "Sync now" button. Server upserts by UUID make retries safe.
- **Do not rely on the Background Sync API.** MDN marks it as limited availability and not Baseline, so it is unsupported in major browsers (notably iOS Safari). Treat it as a bonus only.
- **Conflicts:** attendance is naturally per coach, per session, per player. Use last-write-wins on `updated_at` plus an audit row, and surface the rare clash to the coach rather than auto-merging.
- **Service worker:** Serwist is the common Next.js 16 option, but it needs webpack, not Turbopack. Precache the app shell and the coach's own squad list. Never cache other children's data on shared devices, and clear it on logout.
- **When to adopt a sync engine:** if offline needs grow (multi-device edits, large datasets), **PowerSync** is the most Supabase-native option (Free plan: 2 GB synced/month, 50 concurrent clients, deactivates after a week idle; Pro from $49/month). **ElectricSQL** now handles read-sync only (you write your own write path); Cloud billing is per write. **RxDB** has a Supabase replication plugin (PostgREST + Realtime, RLS-aware) but adds a client DB layer.
- **Tiny-team verdict:** outbox + Serwist now; revisit PowerSync if the outbox grows past ~3 tables (INFERENCE).

### Findings
| Label | Finding | Source | Date | URL |
|---|---|---|---|---|
| FACT | Background Synchronization API: "Limited availability… not Baseline because it does not work in some of the most widely-used browsers." | MDN | 2026-10-06 | https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API |
| FACT | Next.js PWA guide points to Serwist for offline service workers. | Next.js docs | 2026-10-06 | https://nextjs.org/docs/app/guides/progressive-web-apps |
| FINDING | Serwist requires webpack; Next.js 16 defaults to Turbopack. | LogRocket | 2026-10-06 | https://blog.logrocket.com/nextjs-16-pwa-offline-support/ |
| FACT | PowerSync Cloud Free: 2 GB synced/month, 500 MB hosted, 50 peak concurrent clients, deactivates after 1 week idle; Pro from $49/month (30 GB, $1/GB over); self-hostable Open Edition. | PowerSync pricing | 2026-10-06 | https://www.powersync.com/pricing |
| FINDING | Electric Cloud: reads free; $1 per million writes, $0.10/GB-month retention; Electric handles read-path sync only. | Electric blog (2 Apr 2026) | 2026-10-06 | https://electric.ax/blog/2026/04/02/electric-cloud-pricing |
| FACT | RxDB Supabase plugin: two-way sync via PostgREST + Realtime, conflict detection, works with RLS. | RxDB docs | 2026-10-06 | https://rxdb.info/replication-supabase.html |

---

## R8.4 WhatsApp Business Platform vs share links

### What this means for Growfit
- **Default to `wa.me` / share-sheet links.** They are free, need no Meta approval, and the coach (a human) sends from their own WhatsApp. That fits the "coach approves everything" rule and needs no API.
- **Cloud API only if automation is truly needed** (e.g. fixture reminders to 100+ parents). Costs would be: utility templates about $0.0076–0.0095 per message outside the service window, marketing about $0.0379. Every business-initiated message needs a pre-approved template.
- **New in SA from 1 Oct 2026 (reported):** free-form *service* replies are no longer unlimited. Reports say 1,000 free per number per month, then about 12c each. This is reported by SA press; Meta's own page still says service is free, so check before relying on either.
- **Opt-in is mandatory and Growfit's to prove:** record parent opt-in (name the academy, list the message categories, give an opt-out). Add it to the POPIA consent form.
- **Message parents/guardians only, never players.** Meta's explicit under-18 rule covers regulated verticals, but POPIA and the Children's Act make guardian-only contact the safe default.
- **Never put personal information in templates** (ID numbers, medical details). Send a link back to the logged-in app instead (CLAUDE.md: "Never store these in WhatsApp groups").
- An NPC needs a verified Meta Business account, a dedicated number (it can't also be used on the normal app) and a BSP or direct Cloud API setup. That is real admin load for a 3-person team (INFERENCE).

### Findings
| Label | Finding | Source | Date | URL |
|---|---|---|---|---|
| FACT | Per-message pricing since 1 Jul 2025: charged per delivered template by category and recipient country code. Utility and authentication are free inside the 24-hour customer-service window. | Meta developer docs | 2026-10-06 | https://developers.facebook.com/docs/whatsapp/pricing |
| FACT | Meta page states "Service conversations are now free for all businesses" (from 1 Nov 2024). | Meta developer docs | 2026-10-06 | https://developers.facebook.com/docs/whatsapp/pricing |
| FINDING | South Africa rates: marketing $0.0379, utility/authentication $0.0076, rising to $0.0095 on 1 Oct 2026 (aggregator; not verified on Meta's rate card). | Flowcall / ChatMaxima | 2026-10-06 | https://flowcall.co/blog/whatsapp-business-api-pricing-2026 |
| FINDING | From 1 Oct 2026, SA service replies: 1,000 free per number per month, then about 12c each, for both human and AI replies. | Bizcommunity (Everlytic); MyBroadband | 2026-10-06 | https://www.bizcommunity.com/article/whatsapp-support-is-getting-more-expensive-but-not-for-everyone-414759a |
| FACT | Opt-in required ("you have received opt-in permission…"). Business-initiated messages must use approved templates. Regulated-vertical messaging may not be sent to under-18s. Policy last updated 23 Sep 2026. | WhatsApp Business Messaging Policy | 2026-10-06 | https://whatsappbusiness.com/policy/ |

### Open questions
- Confirm SA's current rate card and the service-message change on Meta's official rate-card download. The two sources conflict.
- Is Meta Business verification feasible with the NPC's CIPC documents? Who would own the number?
- Do parents prefer one academy number, or coach-to-parent messages as today?
