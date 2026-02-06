/**
 * Curated list of notable individual tech/AI Twitter accounts.
 * ICs only — no corporate/brand accounts (no @OpenAI, @CNBC, @GitHub, etc.)
 *
 * Used for:
 *   1. Boosting importance_score for tweets from these accounts
 *   2. Providing the notable handle list to the LLM scoring prompt
 *
 * tier 1 = major figure (CEO, top researcher, massive following) → +4 score boost
 * tier 2 = well-known in tech circles → +3 score boost
 * tier 3 = notable in specific communities → +2 score boost
 */

interface NotableAccount {
  handle: string; // case-sensitive as on Twitter, no @
  name: string;
  tier: 1 | 2 | 3;
}

const ACCOUNTS: NotableAccount[] = [
  // ═══════════════════════════════════════════════════════════
  // AI LAB LEADERS & EXECUTIVES
  // ═══════════════════════════════════════════════════════════
  { handle: "sama", name: "Sam Altman", tier: 1 },
  { handle: "gdb", name: "Greg Brockman", tier: 1 },
  { handle: "karpathy", name: "Andrej Karpathy", tier: 1 },
  { handle: "ylecun", name: "Yann LeCun", tier: 1 },
  { handle: "demishassabis", name: "Demis Hassabis", tier: 1 },
  { handle: "DarioAmodei", name: "Dario Amodei", tier: 1 },
  { handle: "AndrewYNg", name: "Andrew Ng", tier: 1 },
  { handle: "drfeifei", name: "Fei-Fei Li", tier: 1 },
  { handle: "geoffreyhinton", name: "Geoffrey Hinton", tier: 1 },
  { handle: "jackclarkSF", name: "Jack Clark", tier: 1 },
  { handle: "mustafasuleyman", name: "Mustafa Suleyman", tier: 1 },
  { handle: "jeffdean", name: "Jeff Dean", tier: 1 },
  { handle: "AmandaAskell", name: "Amanda Askell", tier: 2 },
  { handle: "janleike", name: "Jan Leike", tier: 2 },
  { handle: "OfficialLoganK", name: "Logan Kilpatrick", tier: 2 },
  { handle: "alexalbert__", name: "Alex Albert", tier: 2 },
  { handle: "mark_riedl", name: "Mark Riedl", tier: 2 },
  { handle: "drjimfan", name: "Jim Fan", tier: 2 },

  // ═══════════════════════════════════════════════════════════
  // AI RESEARCHERS & SCIENTISTS
  // ═══════════════════════════════════════════════════════════
  { handle: "fchollet", name: "Francois Chollet", tier: 1 },
  { handle: "goodfellow_ian", name: "Ian Goodfellow", tier: 1 },
  { handle: "hardmaru", name: "David Ha", tier: 2 },
  { handle: "ESYudkowsky", name: "Eliezer Yudkowsky", tier: 1 },
  { handle: "GaryMarcus", name: "Gary Marcus", tier: 1 },
  { handle: "jeremyphoward", name: "Jeremy Howard", tier: 2 },
  { handle: "Thom_Wolf", name: "Thomas Wolf", tier: 2 },
  { handle: "pmddomingos", name: "Pedro Domingos", tier: 2 },
  { handle: "OriolVinyalsML", name: "Oriol Vinyals", tier: 2 },
  { handle: "percyliang", name: "Percy Liang", tier: 2 },
  { handle: "miles_brundage", name: "Miles Brundage", tier: 2 },
  { handle: "emollick", name: "Ethan Mollick", tier: 1 },
  { handle: "michael_nielsen", name: "Michael Nielsen", tier: 2 },
  { handle: "TheZvi", name: "Zvi Mowshowitz", tier: 2 },
  { handle: "chrisalbon", name: "Chris Albon", tier: 2 },
  { handle: "erikbryn", name: "Erik Brynjolfsson", tier: 2 },
  { handle: "GrahamNeubig", name: "Graham Neubig", tier: 2 },
  { handle: "chiphuyen", name: "Chip Huyen", tier: 2 },
  { handle: "stuhlmueller", name: "Andreas Stuhlmueller", tier: 3 },
  { handle: "jaseweston", name: "Jason Weston", tier: 2 },
  { handle: "lilianweng", name: "Lillian Weng", tier: 2 },
  { handle: "_akhaliq", name: "AK (Papers Curator)", tier: 2 },
  { handle: "_jasonwei", name: "Jason Wei", tier: 2 },
  { handle: "quaesita", name: "Cassie Kozyrkov", tier: 2 },
  { handle: "katecrawford", name: "Kate Crawford", tier: 2 },
  { handle: "DanHendrycks", name: "Dan Hendrycks", tier: 2 },
  { handle: "NeelNanda5", name: "Neel Nanda", tier: 3 },
  { handle: "NPCollapse", name: "Connor Leahy", tier: 2 },
  { handle: "SchmidhuberAI", name: "Jurgen Schmidhuber", tier: 2 },
  { handle: "rasbt", name: "Sebastian Raschka", tier: 2 },
  { handle: "svpino", name: "Santiago Valdarrama", tier: 2 },
  { handle: "goodside", name: "Riley Goodside", tier: 2 },

  // ═══════════════════════════════════════════════════════════
  // TECH CEOs & FOUNDERS (as individuals)
  // ═══════════════════════════════════════════════════════════
  { handle: "elonmusk", name: "Elon Musk", tier: 1 },
  { handle: "satyanadella", name: "Satya Nadella", tier: 1 },
  { handle: "sundarpichai", name: "Sundar Pichai", tier: 1 },
  { handle: "tim_cook", name: "Tim Cook", tier: 1 },
  { handle: "tobi", name: "Tobi Lutke", tier: 1 },
  { handle: "dhh", name: "David Heinemeier Hansson", tier: 1 },
  { handle: "rauchg", name: "Guillermo Rauch", tier: 1 },
  { handle: "natfriedman", name: "Nat Friedman", tier: 1 },
  { handle: "paulgraham", name: "Paul Graham", tier: 1 },
  { handle: "patrickc", name: "Patrick Collison", tier: 1 },
  { handle: "amasad", name: "Amjad Masad", tier: 1 },
  { handle: "levelsio", name: "Pieter Levels", tier: 2 },
  { handle: "jasonfried", name: "Jason Fried", tier: 2 },
  { handle: "shl", name: "Sahil Lavingia", tier: 2 },
  { handle: "mitchellh", name: "Mitchell Hashimoto", tier: 2 },
  { handle: "AravSrinivas", name: "Arav Srinivas", tier: 2 },
  { handle: "skirano", name: "Suhail Doshi", tier: 2 },
  { handle: "EladGil", name: "Elad Gil", tier: 2 },
  { handle: "naval", name: "Naval Ravikant", tier: 1 },
  { handle: "Om", name: "Om Malik", tier: 2 },
  { handle: "fredwilson", name: "Fred Wilson", tier: 2 },
  { handle: "dannypostma", name: "Danny Postma", tier: 3 },
  { handle: "tdinh_me", name: "Tony Dinh", tier: 3 },
  { handle: "realGeorgeHotz", name: "George Hotz", tier: 2 },
  { handle: "ClementDelangue", name: "Clement Delangue", tier: 2 },
  { handle: "alexandr_wang", name: "Alexandr Wang", tier: 2 },
  { handle: "EMostaque", name: "Emad Mostaque", tier: 2 },
  { handle: "aidangomez", name: "Aidan Gomez", tier: 2 },
  { handle: "arthurmensch", name: "Arthur Mensch", tier: 2 },
  { handle: "zoink", name: "Dylan Field", tier: 2 },
  { handle: "clattner_llvm", name: "Chris Lattner", tier: 2 },
  { handle: "kaifulee", name: "Kai-Fu Lee", tier: 1 },
  { handle: "hwchase17", name: "Harrison Chase", tier: 2 },

  // ═══════════════════════════════════════════════════════════
  // NOTABLE ENGINEERS & DEVELOPERS
  // ═══════════════════════════════════════════════════════════
  { handle: "swyx", name: "swyx", tier: 2 },
  { handle: "simonw", name: "Simon Willison", tier: 2 },
  { handle: "kelseyhightower", name: "Kelsey Hightower", tier: 1 },
  { handle: "ThePrimeagen", name: "ThePrimeagen", tier: 2 },
  { handle: "addyosmani", name: "Addy Osmani", tier: 2 },
  { handle: "kentcdodds", name: "Kent C. Dodds", tier: 2 },
  { handle: "dan_abramov", name: "Dan Abramov", tier: 2 },
  { handle: "Rich_Harris", name: "Rich Harris", tier: 2 },
  { handle: "sarah_edo", name: "Sarah Drasner", tier: 2 },
  { handle: "jaredpalmer", name: "Jared Palmer", tier: 2 },
  { handle: "leerob", name: "Lee Robinson", tier: 2 },
  { handle: "antirez", name: "Salvatore Sanfilippo", tier: 2 },
  { handle: "jessfraz", name: "Jessie Frazelle", tier: 2 },
  { handle: "ID_AA_Carmack", name: "John Carmack", tier: 1 },
  { handle: "VictorTaelin", name: "Victor Taelin", tier: 2 },
  { handle: "mckaywrigley", name: "McKay Wrigley", tier: 2 },
  { handle: "mattshumer_", name: "Matt Shumer", tier: 2 },
  { handle: "deedydas", name: "Deedy Das", tier: 2 },
  { handle: "kennethreitz42", name: "Kenneth Reitz", tier: 2 },
  { handle: "bryanhelmig", name: "Bryan Helmig", tier: 3 },
  { handle: "cramforce", name: "Malte Ubl", tier: 3 },
  { handle: "timneutkens", name: "Tim Neutkens", tier: 3 },
  { handle: "sophiebits", name: "Sophie Alpert", tier: 2 },
  { handle: "markdalgleish", name: "Mark Dalgleish", tier: 3 },
  { handle: "LeaVerou", name: "Lea Verou", tier: 2 },
  { handle: "thekitze", name: "Kitze", tier: 2 },
  { handle: "thdxr", name: "Dax Raad", tier: 3 },
  { handle: "t3dotgg", name: "Theo", tier: 2 },
  { handle: "fireship_dev", name: "Jeff Delaney", tier: 2 },
  { handle: "benawad", name: "Ben Awad", tier: 2 },
  { handle: "GergelyOrosz", name: "Gergely Orosz", tier: 2 },
  { handle: "patio11", name: "Patrick McKenzie", tier: 2 },

  // ═══════════════════════════════════════════════════════════
  // VCs & INVESTORS (individuals only)
  // ═══════════════════════════════════════════════════════════
  { handle: "pmarca", name: "Marc Andreessen", tier: 1 },
  { handle: "benhorowitz", name: "Ben Horowitz", tier: 2 },
  { handle: "andrewchen", name: "Andrew Chen", tier: 2 },
  { handle: "benedictevans", name: "Benedict Evans", tier: 2 },
  { handle: "garrytan", name: "Garry Tan", tier: 1 },
  { handle: "tunguz", name: "Tomasz Tunguz", tier: 2 },
  { handle: "balajis", name: "Balaji Srinivasan", tier: 1 },
  { handle: "semil", name: "Semil Shah", tier: 3 },
  { handle: "erictor", name: "Eric Torenberg", tier: 3 },
  { handle: "friedmandave", name: "David Friedberg", tier: 2 },
  { handle: "chamath", name: "Chamath Palihapitiya", tier: 1 },
  { handle: "kteare", name: "Keith Teare", tier: 3 },
  { handle: "venturetwins", name: "Justine Moore", tier: 3 },
  { handle: "saranormous", name: "Sarah Guo", tier: 2 },

  // ═══════════════════════════════════════════════════════════
  // TECH JOURNALISTS, WRITERS & COMMENTATORS (individuals only)
  // ═══════════════════════════════════════════════════════════
  { handle: "lexfridman", name: "Lex Fridman", tier: 1 },
  { handle: "rowancheung", name: "Rowan Cheung", tier: 2 },
  { handle: "alliekmiller", name: "Allie K. Miller", tier: 2 },
  { handle: "Ronald_vanLoon", name: "Ronald van Loon", tier: 2 },
  { handle: "antgrasso", name: "Antonio Grasso", tier: 3 },
  { handle: "WesRoth", name: "Wes Roth", tier: 3 },
  { handle: "LinusEkenstam", name: "Linus Ekenstam", tier: 3 },
  { handle: "waitin4agi_", name: "Waiting for AGI", tier: 3 },
  { handle: "v_vashishta", name: "Vin Vashishta", tier: 3 },
  { handle: "petitegeek", name: "Tamara McCleary", tier: 3 },
  { handle: "bentossell", name: "Ben Tossell", tier: 2 },
  { handle: "TrungTPhan", name: "Trung Phan", tier: 2 },
  { handle: "_karenhao", name: "Karen Hao", tier: 2 },
  { handle: "bernardmarr", name: "Bernard Marr", tier: 2 },
  { handle: "KirkDBorne", name: "Kirk Borne", tier: 3 },
  { handle: "arvidkahl", name: "Arvid Kahl", tier: 3 },
  { handle: "csallen", name: "Courtland Allen", tier: 3 },

  // ═══════════════════════════════════════════════════════════
  // NOTABLE HANDLES FOUND IN OUR TWEET DB
  // (verified real handles from Exa-discovered tweets)
  // ═══════════════════════════════════════════════════════════
  { handle: "GaelBreton", name: "Gael Breton", tier: 3 },
  { handle: "CHItraders", name: "CHI Traders", tier: 3 },
  { handle: "bytes032", name: "bytes032", tier: 3 },
  { handle: "dfinke", name: "Doug Finke", tier: 3 },
  { handle: "MarwaEldiwiny", name: "Marwa Eldiwiny", tier: 3 },
  { handle: "BradMichelson", name: "Brad Michelson", tier: 3 },
  { handle: "corbtt", name: "Corbett Barr", tier: 3 },
  { handle: "pierceboggan", name: "Pierce Boggan", tier: 3 },
  { handle: "sterlingcrispin", name: "Sterling Crispin", tier: 3 },
  { handle: "pseudotheos", name: "PseudoTheos", tier: 3 },
  { handle: "ChristopherA", name: "Christopher Allen", tier: 3 },
  { handle: "davidmanheim", name: "David Manheim", tier: 3 },
  { handle: "scaling01", name: "Scaling01", tier: 3 },
  { handle: "techdevnotes", name: "TechDevNotes", tier: 3 },
  { handle: "ArtificialAnlys", name: "Artificial Analysis", tier: 2 },
  { handle: "rohanpaul_ai", name: "Rohan Paul", tier: 3 },
  { handle: "tylerwillis", name: "Tyler Willis", tier: 3 },
  { handle: "ninzo121", name: "ninzo", tier: 3 },
  { handle: "yush_g", name: "Yush G", tier: 3 },
  { handle: "cedric_chee", name: "Cedric Chee", tier: 3 },
];

// Build fast lookup: lowercase handle → { tier, name }
const _handleMap = new Map<string, { tier: 1 | 2 | 3; name: string }>();
for (const acct of ACCOUNTS) {
  _handleMap.set(acct.handle.toLowerCase(), { tier: acct.tier, name: acct.name });
}

/**
 * Check if a Twitter handle is notable.
 * Handles are matched case-insensitively, with or without @ prefix.
 * Returns tier info + score boost, or null if not notable.
 */
export function getNotableInfo(handle: string): { tier: 1 | 2 | 3; name: string; boost: number } | null {
  const clean = handle.replace(/^@/, "").toLowerCase();
  const info = _handleMap.get(clean);
  if (!info) return null;
  const boost = info.tier === 1 ? 4 : info.tier === 2 ? 3 : 2;
  return { ...info, boost };
}

/**
 * Returns a formatted string of notable handles for use in LLM prompts.
 * Helps the scoring model recognize important accounts.
 */
export function getNotableHandlesForPrompt(): string {
  const tier1 = ACCOUNTS.filter(a => a.tier === 1).map(a => `@${a.handle} (${a.name})`);
  const tier2 = ACCOUNTS.filter(a => a.tier === 2).map(a => `@${a.handle} (${a.name})`);
  return `TIER 1 (major figures): ${tier1.join(", ")}\nTIER 2 (well-known): ${tier2.join(", ")}`;
}

export const TOTAL_NOTABLE_ACCOUNTS = ACCOUNTS.length;
