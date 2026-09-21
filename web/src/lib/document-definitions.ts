export type CheckboxDef = { id: string; label: string; hint: string };

export type DocDef = {
  type: string;
  label: string;
  form: string;
  signerRole: string;
  terms: string;
  uploadOnly?: boolean;
  accept?: string;
  checkboxes?: CheckboxDef[];
};

export const DOCUMENTS: DocDef[] = [
  {
    type: "registration_agreement",
    label: "Player Registration Agreement",
    form: "GFA-REG-01",
    signerRole: "parent",
    terms:
      "GROWFIT FOOTBALL ACADEMY — PLAYER REGISTRATION AGREEMENT (GFA-REG-01)\n" +
      "This agreement is entered into between Growfit Football Academy (\"the Academy\") and the parent/guardian (\"the Signatory\") of the player named in the profile above.\n\n" +
      "1. ELIGIBILITY & REGISTRATION STATUS\n" +
      "1.1 The Signatory confirms that the player is not currently registered, and will not during this season register, at any other club affiliated to SAFA, GDFA, or any other provincial football association without first obtaining a clearance certificate through the Academy.\n" +
      "1.2 The Signatory confirms that all personal information provided — including the player's full legal name, date of birth, South African ID or birth certificate number, school, and home address — is accurate and truthful.\n" +
      "1.3 The Academy reserves the right to verify age documentation (birth certificate or SA ID) at any time and to immediately suspend the player's participation if documentation cannot be produced or is found to be fraudulent. Such suspension will be reported to SAFA/GDFA.\n" +
      "1.4 Registration is valid for the current season only. A new registration form must be completed each season.\n\n" +
      "2. MEMBERSHIP FEES & PAYMENT\n" +
      "2.1 Monthly membership fees are due on or before the 1st of each calendar month for the duration of the season.\n" +
      "2.2 Payment may be made by EFT, cash, or any method approved by Academy management. Proof of payment must be retained.\n" +
      "2.3 Where fees remain unpaid for 30 days past the due date, the Academy may suspend the player's participation until the account is brought up to date.\n" +
      "2.4 Where fees remain unpaid for 60 days, the Academy may withdraw the player's registration. No refund of fees already paid will be issued in such circumstances.\n" +
      "2.5 Fees will not be refunded for missed training sessions or matches where the player is absent for personal reasons. Partial refunds for serious injury or relocation may be considered at management's discretion.\n" +
      "2.6 Additional costs (tournament entry fees, kit, away-travel meals) will be communicated separately and are not included in the monthly fee unless stated.\n\n" +
      "3. ATTENDANCE & COMMITMENT\n" +
      "3.1 Regular attendance at training sessions and official fixtures is expected. Players are requested to maintain a minimum 70 % attendance rate across the season.\n" +
      "3.2 Absences must be communicated to the coach in advance via the team WhatsApp group or by direct message.\n" +
      "3.3 Persistent unexplained absences may result in loss of squad selection priority or review of the player's registration.\n\n" +
      "4. KIT & EQUIPMENT\n" +
      "4.1 Players are required to wear the official Academy kit for all official fixtures. Kit is the responsibility of the player and must be presented clean and in good condition.\n" +
      "4.2 Shin guards and football boots or appropriate footwear are mandatory for all training sessions and matches. The Academy may refuse a player entry to training without proper equipment in the interest of safety.\n" +
      "4.3 Academy-issued equipment (bibs, cones, balls) may not be removed from training venues or matches without express permission.\n\n" +
      "5. TRANSFERS & CLEARANCES\n" +
      "5.1 A player wishing to transfer to another club must submit a written transfer request to Academy management at least 14 days before the intended effective date.\n" +
      "5.2 A clearance certificate will be issued once all outstanding fees and any Academy property have been returned. The Academy will not withhold clearance unreasonably.\n" +
      "5.3 Any transfer attempted outside this process may be reported to SAFA/GDFA as an irregular transfer.\n\n" +
      "6. INSURANCE & LIABILITY\n" +
      "6.1 The Academy maintains public liability insurance for training and official fixtures. This does not replace personal medical insurance.\n" +
      "6.2 The Academy, its coaches, and volunteers are not liable for injuries sustained during training or matches that occur despite reasonable safety precautions being followed. The parent/guardian accepts the inherent risk of participation in contact sport.\n" +
      "6.3 The Academy is not responsible for loss or damage to personal property (including mobile phones, clothing, or valuables) brought to training venues or matches.\n\n" +
      "7. CONDUCT & DISCIPLINE\n" +
      "7.1 All players and parents/guardians are required to comply with the Academy Code of Ethics (GFA-ETH-04).\n" +
      "7.2 The Academy reserves the right to suspend or withdraw the registration of any player whose conduct, or whose parent's/guardian's conduct, is deemed seriously detrimental to the Academy's reputation or the welfare of other players.\n" +
      "7.3 Disciplinary decisions will be communicated in writing. A right of appeal to Academy management exists within 7 days of notification.\n" +
      "7.4 Serious matters may be referred to SAPA, SAFA/GDFA, and/or law enforcement without further internal process.\n\n" +
      "8. DATA PROTECTION\n" +
      "Personal information is collected and processed in accordance with the Academy's POPIA Privacy Notice (GFA-DAT-05), which the Signatory is required to read and acknowledge separately.\n\n" +
      "9. GOVERNING LAW\n" +
      "This agreement is governed by the laws of the Republic of South Africa. Any dispute not resolved through internal processes will be subject to the jurisdiction of the South African courts or, where applicable, the SAFA/GDFA dispute resolution process.\n\n" +
      "By signing digitally below, the Signatory confirms they are the parent or legal guardian of the player, have read and understood this agreement in full, and agree to be bound by its terms for the current season.",
  },
  {
    type: "consent_form",
    label: "Parent & Player Consent Form",
    form: "GFA-CON-02",
    signerRole: "parent",
    terms:
      "GROWFIT FOOTBALL ACADEMY — PARENT & PLAYER CONSENT FORM (GFA-CON-02)\n" +
      "This form records the informed consent of the parent/guardian for the activities described in each clause below. " +
      "Tick each box only after reading the full description. All four consents are required to complete registration for the current season. " +
      "This form is the authoritative consent record for the current season and supersedes any previously submitted consent. " +
      "Any consent may be withdrawn in writing at any time by contacting Academy administration; note that withdrawal of participation consent will bring the current registration to an end.",
    checkboxes: [
      {
        id: "participation_consent",
        label: "Participation",
        hint: "I consent to my child participating fully in all Growfit Football Academy training sessions, practice matches, official league and cup fixtures, tournaments, development camps, and any other organised Academy activities during the current season. I understand that participation in competitive football involves physical contact and that the Academy will take all reasonable steps to ensure a safe environment, including qualified coaching supervision and adherence to SAFA/GDFA laws of the game.",
      },
      {
        id: "photo_consent",
        label: "Photo & media",
        hint: "I consent to photographs and video footage of my child being captured during training sessions, matches, and Academy events, and to that content being used on Growfit's official digital platforms — including the Academy website, Instagram, Facebook, and WhatsApp parent channels — strictly for the purpose of promoting youth football development. I understand that: (a) my child's first name only may be used in captions; (b) precise location data will not be published; (c) content will not be licensed or sold to third parties; and (d) I may request removal of specific content at any time by contacting administration. This consent does not cover footage captured by other parents or guardians.",
      },
      {
        id: "transport_consent",
        label: "Transport",
        hint: "I consent to my child being transported to and from away fixtures, tournaments, and official Academy activities in vehicles arranged by the Academy. I understand that the Academy will use roadworthy, insured vehicles only, that drivers will hold a valid South African driver's licence appropriate for the vehicle class, and that players will be required to wear seatbelts at all times. For overnight or out-of-province trips, separate written consent will be obtained. The Academy will not release a player into the care of any unauthorised adult without prior written notification from the parent/guardian.",
      },
      {
        id: "risk_acknowledged",
        label: "Risk acknowledgement",
        hint: "I acknowledge that participation in organised football — including training drills, small-sided games, and competitive fixtures — carries inherent physical risks including sprains, fractures, concussion, and other injuries. I confirm that: (a) I have been informed of the Academy's emergency first-aid procedures and the location of the first-aid kit at training venues; (b) qualified first-aid assistance is present or on-call at all official fixtures; (c) emergency contacts recorded in the Academy's system are accurate and reachable; and (d) I accept these risks and do not hold the Academy liable for injuries sustained despite reasonable safety measures being observed.",
      },
    ],
  },
  {
    type: "code_of_ethics",
    label: "Code of Ethics Agreement",
    form: "GFA-ETH-04",
    signerRole: "parent",
    terms:
      "GROWFIT FOOTBALL ACADEMY — CODE OF ETHICS (GFA-ETH-04)\n" +
      "Growfit Football Academy is committed to providing a safe, inclusive, and positive football environment for every young player. " +
      "This Code applies to all players, parents, guardians, siblings, and any other persons attending Academy activities in a supporting capacity. " +
      "Signing this document constitutes a binding commitment to uphold these standards for the duration of the current season and any subsequent season in which the player is registered.\n\n" +

      "ACADEMY VALUES\n" +
      "Respect · Child First · Honesty · Fair Play · Accountability · Inclusion\n\n" +

      "SECTION A — PLAYER OBLIGATIONS\n" +
      "A1. Treat coaches, teammates, opponents, match officials, and Academy staff with dignity and respect at all times, on and off the field.\n" +
      "A2. Arrive at training and fixtures on time, in correct kit, and ready to participate. Notify the coach in advance if you are unable to attend.\n" +
      "A3. Give maximum effort in every training session and match. Understand that player selection is at the sole discretion of the coaching staff based on performance, attitude, and attendance.\n" +
      "A4. Accept the decisions of match officials without argument, complaint, or gesture of dissent. Concerns may be raised calmly with the coach after the match.\n" +
      "A5. Do not engage in dangerous, reckless, or deliberately harmful play. Deliberate foul play or violent conduct will result in immediate removal from the activity and disciplinary review.\n" +
      "A6. Take care of Academy equipment and facilities. Report any damage immediately. Do not remove Academy equipment without permission.\n" +
      "A7. Do not bully, intimidate, or exclude any teammate or opponent — including online or via messaging apps. Any form of bullying, harassment, or discrimination will be treated with the utmost seriousness.\n" +
      "A8. If you witness unsafe, abusive, or inappropriate behaviour by any adult or fellow player, report it immediately to a trusted coach or to Academy management.\n\n" +

      "SECTION B — PARENT & GUARDIAN OBLIGATIONS\n" +
      "B1. Provide positive, encouraging support from the sideline. Do not instruct, coach, or direct players — including your own child — during training or matches. Conflicting instructions undermine the coaching team and confuse players.\n" +
      "B2. Respect all match officials' decisions. Do not approach referees, assistant referees, or fourth officials during or immediately after a match to argue a decision. Concerns may be submitted in writing to Academy management within 48 hours.\n" +
      "B3. Do not approach opposition players, parents, or coaching staff in a confrontational manner. Any dispute with the opposing team must be directed through Academy management.\n" +
      "B4. Abusive, threatening, racist, sexist, or any other discriminatory language or behaviour will result in immediate removal from the venue. A second such incident will result in a ban from attending all Academy activities. The incident may be reported to SAFA/GDFA.\n" +
      "B5. Do not enter the playing field, technical area, or any restricted zone during training or matches without the explicit permission of the coaching staff or match officials.\n" +
      "B6. Model the behaviour you expect from your child. Young players are heavily influenced by how their parents conduct themselves in sport.\n" +
      "B7. Communicate concerns, complaints, or feedback about team matters through the official channels — directly to Academy management — rather than through public posts, group chats, or confrontation at the training ground.\n" +
      "B8. Ensure your child is collected punctually after training and matches. The Academy's duty of care ends at the time agreed for collection. Persistent late collection may result in additional charges or review of the player's registration.\n\n" +

      "SECTION C — SOCIAL MEDIA & DIGITAL CONDUCT\n" +
      "C1. Do not publish or share any post, story, reel, or message that contains negative, offensive, or defamatory commentary about coaches, match officials, opposition players or parents, Academy staff, or fellow Academy families.\n" +
      "C2. Do not share footage, images, or information that could identify, embarrass, or endanger any under-18 player without explicit written consent from that player's parent or guardian.\n" +
      "C3. Do not publish or forward internal Academy communications (messages, team sheets, medical information, financial matters) to persons outside the Academy.\n" +
      "C4. WhatsApp groups and similar platforms are for Academy communication only. Misuse — including off-topic arguments, sharing of misinformation, or harassment — will result in removal from the group and may lead to further disciplinary action.\n\n" +

      "SECTION D — SAFEGUARDING\n" +
      "D1. The safety and wellbeing of every player is the Academy's highest priority. All coaches hold or are working towards a relevant coaching qualification and have undergone safeguarding awareness training.\n" +
      "D2. One-on-one contact between an adult and a player (not that adult's own child) in a private or unsupervised setting is not permitted under any circumstances.\n" +
      "D3. Any adult who has reason to believe that a child is at risk of harm — inside or outside of football — is obligated to report it to the Academy's designated safeguarding lead or directly to the South African Police Service (SAPS) or Department of Social Development.\n\n" +

      "SECTION E — CONSEQUENCES\n" +
      "E1. First offence (minor breach): verbal or written warning. A record will be kept on file.\n" +
      "E2. Second offence or single serious breach: written warning and possible suspension from training or matches for a defined period.\n" +
      "E3. Parent/guardian third offence or serious breach: ban from attending all Academy activities. The player's registration may be reviewed.\n" +
      "E4. Player serious or repeated breach: player's registration may be withdrawn without refund of fees paid.\n" +
      "E5. Matters involving violence, abuse, fraud, or child endangerment will be referred to SAPA, SAFA/GDFA, and/or law enforcement without further internal process.\n\n" +
      "By signing below, both the player and parent/guardian confirm they have read and understood this Code of Ethics in its entirety and commit to upholding it for the duration of their association with Growfit Football Academy.",
  },
  {
    type: "medical_consent",
    label: "Medical Consent & Emergency Form",
    form: "GFA-MED-03",
    signerRole: "parent",
    terms:
      "GROWFIT FOOTBALL ACADEMY — MEDICAL CONSENT & EMERGENCY AUTHORISATION (GFA-MED-03)\n" +
      "This document authorises Growfit Football Academy coaches, administrators, and appointed first-aiders to act on the parent's/guardian's behalf in medical situations when the parent/guardian cannot be reached immediately. " +
      "It must be read together with the medical information recorded in the player's profile (blood type, allergies, chronic conditions, current medication, and emergency contacts).\n\n" +

      "1. FIRST AID AUTHORISATION\n" +
      "I authorise any Academy coach or staff member holding a valid first-aid certificate to administer appropriate first-aid treatment to the player in the event of injury or medical emergency during training, matches, or Academy-organised travel. " +
      "This includes, but is not limited to: wound cleaning and dressing, application of ice/cold packs, splinting of suspected fractures, CPR, and use of an automated external defibrillator (AED).\n\n" +

      "2. EMERGENCY MEDICAL TREATMENT\n" +
      "In the event of a serious injury or acute medical emergency where I am not contactable within a reasonable time:\n" +
      "2.1 I authorise the Academy to call emergency services (National Emergency: 112 | Ambulance: 10177 | ER24: 084 124 | Netcare 911: 082 911) and to transport the player to the nearest appropriate medical facility.\n" +
      "2.2 I authorise the treating medical practitioners at that facility to provide such emergency medical and surgical treatment as they deem necessary to preserve the player's life or prevent serious permanent harm — including anaesthesia, surgery, blood transfusion, or administration of medication.\n" +
      "2.3 I understand that every reasonable effort will be made to contact me or the secondary emergency contact listed in the player's profile before any non-urgent procedure is performed.\n\n" +

      "3. MEDICATION DURING ACTIVITIES\n" +
      "3.1 Where a player requires regular medication (e.g. asthma inhaler, EpiPen, insulin), the parent/guardian is responsible for ensuring the player has the medication with them at every training session and match.\n" +
      "3.2 A clearly labelled supply of the medication may be lodged with the team coach or manager for safekeeping during activities, with written instructions for use. Academy staff will assist the player in self-administering prescribed medication but will not administer injectable medication unless a specific written protocol has been agreed with the parent/guardian and a qualified medical professional.\n" +
      "3.3 The Academy will not administer any over-the-counter pain relief, antihistamines, or other non-prescription medication to a player without prior written consent from the parent/guardian.\n\n" +

      "4. CONCUSSION PROTOCOL\n" +
      "4.1 The Academy follows the SAFA Concussion in Sport guidelines. Any player who shows signs of concussion (confusion, headache, dizziness, loss of consciousness, vomiting) will be immediately removed from play and will not return to activity on the same day — regardless of apparent recovery. This is non-negotiable.\n" +
      "4.2 The player must receive medical clearance before returning to training or matches following a diagnosed or suspected concussion.\n\n" +

      "5. COMMUNICATION OF MEDICAL CHANGES\n" +
      "5.1 I undertake to notify Academy management immediately — and in writing within 48 hours — of any change to the player's medical status, including new diagnoses, prescription changes, allergic reactions, surgeries, or injuries sustained outside of Academy activities.\n" +
      "5.2 Failure to disclose material medical information that subsequently affects the player's safety or the Academy's ability to provide appropriate care may constitute a breach of this agreement.\n\n" +

      "6. MEDICAL AID & COSTS\n" +
      "6.1 Medical costs arising from injuries during Academy activities are not covered by the Academy unless caused by proven gross negligence on the Academy's part.\n" +
      "6.2 Parents/guardians are encouraged to maintain adequate medical aid cover or personal accident insurance for the player.\n" +
      "6.3 Where emergency treatment is provided, I accept responsibility for all resulting medical costs and authorise the Academy to disclose my emergency contact and medical aid details (as recorded in the system) to the treating medical facility.\n\n" +
      "By signing below, I confirm that: (a) the medical and emergency contact information recorded in the Academy's system for this player is complete and accurate; (b) I understand and agree to the terms of this medical consent; and (c) I will notify the Academy of any changes promptly.",
  },
  {
    type: "popia_consent",
    label: "Data Protection & Privacy Notice",
    form: "GFA-DAT-05",
    signerRole: "parent",
    terms:
      "GROWFIT FOOTBALL ACADEMY — DATA PROTECTION & PRIVACY NOTICE (GFA-DAT-05)\n" +
      "Issued in terms of the Protection of Personal Information Act 4 of 2013 (POPIA) and the Promotion of Access to Information Act 2 of 2000 (PAIA).\n\n" +

      "1. RESPONSIBLE PARTY\n" +
      "Growfit Football Academy is the Responsible Party for personal information collected and processed through the Growfit platform. " +
      "Queries relating to personal information may be directed to the Information Officer via the contact details provided by Academy management.\n\n" +

      "2. CATEGORIES OF PERSONAL INFORMATION COLLECTED\n" +
      "The Academy collects and processes the following categories of personal information:\n" +
      "• Identity information: full legal name, date of birth, South African ID number or passport number, birth certificate number, photograph.\n" +
      "• Contact information: home address, email address, telephone numbers (player, parent/guardian, emergency contacts).\n" +
      "• Educational information: school name, grade (for age-group verification and scheduling).\n" +
      "• Medical & health information: blood type, known allergies, chronic conditions, current medication, physical restrictions, treating doctor or clinic, nearest hospital, medical aid scheme and membership number.\n" +
      "• Performance data: match ratings, attribute assessments, coach notes, training attendance records.\n" +
      "• Financial information: payment history, outstanding account status (no full banking details are stored on this platform).\n" +
      "• Digital identifiers: user account email, session data, IP address (for security purposes).\n" +
      "• Media: photographs and videos captured during Academy activities.\n\n" +

      "3. PURPOSE OF PROCESSING\n" +
      "Personal information is collected and used for the following specific, lawful, and legitimate purposes:\n" +
      "3.1 Player registration and season administration.\n" +
      "3.2 SAFA/GDFA and provincial association registration and affiliation compliance.\n" +
      "3.3 Communication with parents/guardians regarding training schedules, fixtures, tournaments, fees, and Academy news.\n" +
      "3.4 Player safety: emergency contact, medical treatment authorisation, concussion management.\n" +
      "3.5 Player development: performance tracking, attribute assessment, personalised coaching.\n" +
      "3.6 Legal and regulatory compliance: age verification, injury record-keeping, insurance claims.\n" +
      "3.7 Promotion of the Academy's activities (subject to separate media consent — GFA-CON-02).\n\n" +

      "4. LAWFUL BASIS FOR PROCESSING\n" +
      "Processing is conducted on one or more of the following grounds as relevant:\n" +
      "• Consent of the data subject or their parent/guardian (for minors).\n" +
      "• Necessity for the performance of the registration agreement (GFA-REG-01).\n" +
      "• Compliance with a legal obligation (SAFA/GDFA registration requirements, POPIA itself).\n" +
      "• Legitimate interests of the Academy, balanced against the data subject's rights.\n" +
      "Health-related information (special personal information under POPIA) is processed only where explicitly authorised by the parent/guardian in the Medical Consent form (GFA-MED-03).\n\n" +

      "5. SHARING OF PERSONAL INFORMATION\n" +
      "Personal information will not be sold, rented, or traded. It is shared only with the following third parties, and only to the extent necessary:\n" +
      "• SAFA, GDFA, and relevant provincial associations: for official player registration and compliance.\n" +
      "• Academy coaches, managers, and administrative staff: on a need-to-know basis for player management.\n" +
      "• Medical and emergency services: in the event of an injury or medical emergency.\n" +
      "• Payment processors: for fee collection (only transaction metadata, not stored card details).\n" +
      "• Technology service providers (hosting, software): subject to data processing agreements.\n" +
      "• Law enforcement or regulatory bodies: where required by law.\n\n" +

      "6. CROSS-BORDER TRANSFERS\n" +
      "Player data is stored on servers located within South Africa or in jurisdictions that provide equivalent data protection under POPIA Section 72. Where data is processed outside South Africa, the Academy ensures contractual safeguards are in place.\n\n" +

      "7. RETENTION PERIOD\n" +
      "Personal information is retained for the following periods:\n" +
      "• Active player records: for the duration of registration plus 3 years after last activity.\n" +
      "• Medical consent and injury records: 6 years (in line with general limitation periods).\n" +
      "• Financial records: 5 years (as required by SARS and the Companies Act).\n" +
      "• Media content: until consent is withdrawn or the Academy ceases operations.\n" +
      "After the applicable retention period, records are securely deleted or anonymised.\n\n" +

      "8. YOUR RIGHTS UNDER POPIA\n" +
      "As the parent/guardian of a minor player, or as a player aged 18 or over, you have the following rights:\n" +
      "• Right of access: request a copy of the personal information held about you or your child.\n" +
      "• Right to correction: request correction of inaccurate or incomplete information.\n" +
      "• Right to deletion: request deletion of personal information where processing is no longer justified (subject to legal retention obligations).\n" +
      "• Right to object: object to processing based on legitimate interests where you have grounds relating to your particular situation.\n" +
      "• Right to withdraw consent: withdraw any previously given consent at any time. Withdrawal does not affect the lawfulness of processing before withdrawal.\n" +
      "• Right to lodge a complaint: with the Information Regulator of South Africa:\n" +
      "  — Website: www.inforegulator.org.za\n" +
      "  — Email: complaints.IR@justice.gov.za\n" +
      "  — POPIAcomplaints@inforegulator.org.za\n" +
      "  — Tel: 010 023 5200\n\n" +

      "9. SECURITY MEASURES\n" +
      "The Academy takes reasonable technical and organisational measures to protect personal information against unauthorised access, loss, or destruction. These include encrypted data storage, access controls, and regular security reviews. In the event of a data breach that poses a risk to data subjects, the Academy will notify the Information Regulator and affected parties as required by POPIA.\n\n" +

      "10. COOKIES & DIGITAL TRACKING\n" +
      "The Growfit web platform uses session cookies for authentication purposes only. No third-party advertising or tracking cookies are used.\n\n" +
      "By signing this document, the parent/guardian confirms they have read and understood this Privacy Notice in full, consent to the processing of personal information as described, and acknowledge their rights under POPIA.",
  },
  {
    type: "id_document",
    label: "Identity Document / Birth Certificate",
    form: "GFA-ID-06",
    signerRole: "parent",
    terms: "",
    uploadOnly: true,
    accept: ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png",
  },
];

/**
 * Whether a document is done for the season — an upload-only document (the
 * ID/birth certificate scan) needs `'uploaded'`, everything else needs a
 * digital `'signed'` status; `'needs_renewal'` and `'unsigned'` are both
 * outstanding. Matches DocumentHub's own per-group counts (signedCount for
 * signable docs, uploadedCount for upload-only ones) as a single per-row
 * check, for the funnel view which needs it document-by-document rather
 * than as one hub-wide total.
 */
export function isDocComplete(def: DocDef, status: string | undefined): boolean {
  if (!status) return false;
  return def.uploadOnly ? status === "uploaded" : status === "signed";
}
