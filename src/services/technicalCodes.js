/**
 * Technical Codes & Railway Identifier Engine
 * Translates alphanumeric railway track circuits, signal names, point machines,
 * and abbreviation codes into Devanagari Unicode according to official standards.
 */

import { DEFAULT_RAILWAY_ABBREVIATIONS, ALPHABET_HINDI_MAP } from './railwayGlossary.js';

// Exact Pre-mapped Technical Identifiers from Specifications
const EXACT_TECHNICAL_CODES = {
    // AXT series
    "505AXT": "505ए.एक्स.टी.",
    "505BXT": "505बी.एक्स.टी.",
    "507AXT": "507ए.एक्स.टी.",
    "507BXT": "507बी.एक्स.टी.",
    "509AXT": "509ए.एक्स.टी.",
    "509BXT": "509बी.एक्स.टी.",
    "511AXT": "511ए.एक्स.टी.",
    "511BXT": "511बी.एक्स.टी.",
    "513AXT": "513ए.एक्स.टी.",
    "513BXT": "513बी.एक्स.टी.",
    "515AXT": "515ए.एक्स.टी.",
    "515BXT": "515बी.एक्स.टी.",
    "517AXT": "517ए.एक्स.टी.",
    "517BXT": "517बी.एक्स.टी.",
    "519AXT": "519ए.एक्स.टी.",
    "519BXT": "519बी.एक्स.टी.",
    "521AXT": "521ए.एक्स.टी.",
    "521BXT": "521बी.एक्स.टी.",

    // DP series
    "DP519A": "डी.पी.519ए.",
    "DP519B": "डी.पी.519बी.",
    "DP521A": "डी.पी.521ए.",
    "DP521B": "डी.पी.521बी.",

    // Railway rule references & operating forms
    "G & SR": "जी. एंड एस.आर.",
    "G and SR": "जी. एंड एस.आर.",
    "G&SR": "जी. एंड एस.आर.",
    "G. & S.R.": "जी. एंड एस.आर.",
    "G.& S.R.": "जी. एंड एस.आर.",
    "G.&S.R.": "जी. एंड एस.आर.",
    "G. and S.R.": "जी. एंड एस.आर.",
    "G.R.": "जी.आर.",
    "S.R.": "एस.आर.",
    "G.R": "जी.आर.",
    "S.R": "एस.आर.",
    "GR": "जी.आर.",
    "SR": "एस.आर.",
    "T/369": "टी/369",
    "T/369(3b)": "टी/369(3b)",
    "T/369(1)": "टी/369(1)",
    "ETC": "आदि",
    "etc.": "आदि",
    "etc": "आदि",

    // ODP series
    "ODP507A": "ओ.डी.पी.507ए.",
    "ODP507B": "ओ.डी.पी.507बी.",
    "ODP511A": "ओ.डी.पी.511ए.",
    "ODP511B": "ओ.डी.पी.511बी.",
    "ODP515A": "ओ.डी.पी.515ए.",
    "ODP515B": "ओ.डी.पी.515बी.",
    "ODP519A": "ओ.डी.पी.519ए.",
    "ODP519B": "ओ.डी.पी.519बी.",
    "ODP521A": "ओ.डी.पी.521ए.",
    "ODP521B": "ओ.डी.पी.521बी.",

    // Special expressions
    "i.e.": "अर्थात्",
    "i.e": "अर्थात्",
    "ie.": "अर्थात्",
    "ie": "अर्थात्",

    // S Signal series
    "S9XT": "एस9.एक्स.टी.",
    "S9AXT": "एस9ए.एक्स.टी.",
    "S9BXT": "एस9बी.एक्स.टी.",
    "S507XT": "एस507.एक्स.टी.",
    "S511XT": "एस511.एक्स.टी.",
    "S515XT": "एस515.एक्स.टी.",
    "S519XT": "एस519.एक्स.टी.",

    // Axle Counter series
    "A-517": "ए-517",
    "A-504": "ए-504",
    "A-519": "ए-519",
    "A-502": "ए-502",

    // Base abbreviations & requested railway codes
    "DLI": "डी.एल.आई.",
    "MSDAC": "एम.एस.डी.ए.सी.",
    "D.L.I.": "डी.एल.आई.",
    "M.S.D.A.C.": "एम.एस.डी.ए.सी.",
    "M.N.P.": "एम.एन.पी.",
    "D.S.T.E.": "डी.एस.टी.ई.",
    "V.D.U.": "वी.डी.यू.",
    "V.D.O.": "वी.डी.ओ.",
    "E.L.B.": "ई.एल.बी.",
    "E.K.T.": "ई.के.टी.",
    "G.W.R.": "जी.डब्ल्यू.आर.",
    "T.V.U.": "टी.वी.यू.",
    "K.E.U.": "के.ई.यू.",
    "A.X.T.": "ए.एक्स.टी.",
    "B.X.T.": "बी.एक्स.टी.",
    "AXT": "ए.एक्स.टी.",
    "BXT": "बी.एक्स.टी.",
    "DP": "डी.पी.",
    "ODP": "ओ.डी.पी.",
    "UP": "अप",
    "DN": "डाउन",
    "MNP": "एम.एन.पी.",
    "ELB": "ई.एल.बी.",
    "EKT": "ई.के.टी.",
    "DSTE": "डी.एस.टी.ई.",
    "VDO": "वी.डी.ओ.",
    "VDU": "वी.डी.यू.",
    "KEU": "के.ई.यू.",
    "GWR": "जी.डब्ल्यू.आर.",
    "SI-24": "एस.आई.-24",
    "TVU": "टी.वी.यू.",
    "DLV": "डी.एल.वी.",
    "NOTE:": "टिप्पणी:",
    "NOTE:-": "टिप्पणी:-",
    "NOTE": "टिप्पणी",
    "Note:": "टिप्पणी:",
    "Note": "टिप्पणी",
    "CAL65 METER LONG": "65 मीटर लंबी",
    "CAL65 Meter Long": "65 मीटर लंबी",
    "CAL65": "सी.ए.एल. 65",
    "CAL": "सी.ए.एल.",
    "C.A.L.": "सी.ए.एल.",
    "ENGG SIDING": "इंजीनियरिंग साइडिंग",
    "HOT METAL SIDING": "हॉट मेटल साइडिंग",
    "NON-RUNNING LINE": "गैर-रनिंग लाइन",
    "NON-RUNNING LINES": "गैर-रनिंग लाइन्स",
    "CSR": "सी.एस.आर.",
    "C.S.R.": "सी.एस.आर.",
    "CSL": "सी.एस.एल.",
    "C.S.L.": "सी.एस.एल.",
    "HASSDAC": "एच.ए.एस.एस.डी.ए.सी.",
    "H.A.S.S.D.A.C.": "एच.ए.एस.एस.डी.ए.सी.",
    "MACLS": "एम.ए.सी.एल.एस.",
    "M.A.C.L.S.": "एम.ए.सी.एल.एस.",
    "IBH": "आई.बी.एच.",
    "I.B.H.": "आई.बी.एच.",
    "CSTE": "सी.एस.टी.ई.",
    "C.S.T.E.": "सी.एस.टी.ई.",
    "ECR": "ई.सी.आर.",
    "E.C.R.": "ई.सी.आर.",
    "SIP": "एस.आई.पी.",
    "S.I.P.": "एस.आई.पी.",
    "DNR": "डी.एन.आर.",
    "D.N.R.": "डी.एन.आर.",
    "SM": "एस.एम.",
    "S.M.": "एस.एम.",
    "VDU": "वी.डी.यू.",
    "V.D.U.": "वी.डी.यू.",
    "KIUL": "किऊल",
    "GAYA": "गया",
    "KARJARA": "करजरा",
    "B.G.": "बड़ी लाइन",
    "B.G": "बड़ी लाइन",
    "BG": "बड़ी लाइन"
};

const STRICT_ROMAN_SET = new Set([
    'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
    'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX'
]);

/**
 * Transliterate Latin acronym to dot-separated Hindi
 * e.g. AXT -> ए.एक्स.टी., DP -> डी.पी., DLI -> डी.एल.आई.
 */
export function acronymToHindi(letters) {
    if (!letters) return '';
    const clean = letters.replace(/\./g, '');
    const upper = clean.toUpperCase();
    if (DEFAULT_RAILWAY_ABBREVIATIONS[upper]) {
        return DEFAULT_RAILWAY_ABBREVIATIONS[upper];
    }
    // Generate letter-by-letter dot separated form
    const parts = [];
    for (let char of upper) {
        if (ALPHABET_HINDI_MAP[char]) {
            parts.push(ALPHABET_HINDI_MAP[char]);
        } else {
            parts.push(char);
        }
    }
    return parts.join('.') + '.';
}

/**
 * Transliterate single suffix letter (without trailing dot)
 * e.g. 'A' in 'DP519A' -> 'ए'
 */
function suffixLetterToHindi(char) {
    return ALPHABET_HINDI_MAP[char.toUpperCase()] || char;
}

/**
 * Replace all technical codes in a string with their Hindi representations
 */
export function translateTechnicalCodes(text, customCodes = {}) {
    if (!text) return '';

    // Merge exact codes with any user-provided custom dictionary codes
    const codesMap = { ...EXACT_TECHNICAL_CODES, ...customCodes };

    // Sort keys descending by length so longer tokens match first
    const sortedExactKeys = Object.keys(codesMap).sort((a, b) => b.length - a.length);

    let result = text;

    // 1. First pass: exact matches on word boundaries or standalone
    for (const key of sortedExactKeys) {
        // Regex with word boundaries or punctuation boundaries
        const regex = new RegExp(`(?<=[^a-zA-Z0-9]|^)${escapeRegExp(key)}(?=[^a-zA-Z0-9]|$)`, 'g');
        result = result.replace(regex, codesMap[key]);
    }

    // 2. Second pass: Rule-based regexes for dynamic railway numbers

    // Pattern A: \b(\d+)(AXT|BXT)\b -> e.g. 523AXT -> 523ए.एक्स.टी.
    result = result.replace(/\b(\d+)(AXT|BXT)\b/g, (match, num, letters) => {
        return `${num}${acronymToHindi(letters)}`;
    });

    // Pattern B: \b(DP|ODP)(\d+)([A-Za-z])\b -> e.g. DP523A -> डी.पी.523ए., ODP523B -> ओ.डी.पी.523बी.
    result = result.replace(/\b(DP|ODP)(\d+)([A-Za-z])\b/g, (match, prefix, num, suffix) => {
        const prefixHindi = prefix === 'ODP' ? 'ओ.डी.पी.' : 'डी.पी.';
        const suffixHindi = suffixLetterToHindi(suffix);
        return `${prefixHindi}${num}${suffixHindi}.`;
    });

    // Pattern C: \b(S)(\d+)(AXT|BXT)\b -> e.g. S12AXT -> एस12ए.एक्स.टी.
    result = result.replace(/\bS(\d+)(AXT|BXT)\b/g, (match, num, letters) => {
        return `एस${num}${acronymToHindi(letters)}`;
    });

    // Pattern D: \b(S)(\d+)XT\b -> e.g. S523XT -> एस523.एक्स.टी.
    result = result.replace(/\bS(\d+)XT\b/g, (match, num) => {
        return `एस${num}.एक्स.टी.`;
    });

    // Pattern E: \b([A-Z])-(\d+)\b -> e.g. A-517 -> ए-517, B-204 -> बी-204
    result = result.replace(/\b([A-Z])-(\d+)\b/g, (match, letter, num) => {
        const letterHindi = ALPHABET_HINDI_MAP[letter] || letter;
        return `${letterHindi}-${num}`;
    });

    // Pattern E2: \b([A-Z]{2,4})-(\d+)\b -> e.g. SI-24 -> एस.आई.-24
    result = result.replace(/\b([A-Z]{2,4})-(\d+)\b/g, (match, letters, num) => {
        const lettersHindi = acronymToHindi(letters);
        return `${lettersHindi}-${num}`;
    });

    // Pattern E3: CAL number pattern (e.g. CAL65 METER LONG -> 65 मीटर लंबी, CAL98.90 -> सी.ए.एल. 98.90)
    result = result.replace(/\bCAL\s*(\d+(?:\.\d+)?)\s*(?:Mtr|Mtrs|Meter|Meters|Metre|Metres)?\s*(?:Long|LONG)\b/gi, '$1 मीटर लंबी');
    result = result.replace(/\bCAL\s*(\d+(?:\.\d+)?)\b/gi, 'सी.ए.एल. $1');

    // Pattern E4: Railway forms pattern (e.g. T/369 -> टी/369, T/369(3b) -> टी/369(3b), T/409 -> टी/409)
    result = result.replace(/\b([A-Z])\/(\d+(?:\([a-zA-Z0-9]+\))?)\b/g, (match, letter, num) => {
        const letterHindi = ALPHABET_HINDI_MAP[letter.toUpperCase()] || letter;
        return `${letterHindi}/${num}`;
    });

    // Pattern E5: Railway rule books and abbreviations (G & SR, G and SR, G.R., S.R.)
    result = result.replace(/\b(G\s*(?:&|and)\s*SR)\b/gi, 'जी. एंड एस.आर.');
    result = result.replace(/\b(G\.?\s*(?:&|and)\s*S\.?R\.?)\b/gi, 'जी. एंड एस.आर.');
    result = result.replace(/\b(G)\.(R)\.?\b/g, 'जी.आर.');
    result = result.replace(/\b(S)\.(R)\.?\b/g, 'एस.आर.');

    // Pattern E6: Ordinary expression etc. / ETC meaning आदि, and i.e. meaning अर्थात्
    result = result.replace(/(?<=[^a-zA-Z0-9]|^)(?:etc\.|etc|ETC)(?=[^a-zA-Z0-9]|$)/g, 'आदि');
    result = result.replace(/(?<=[^a-zA-Z0-9]|^)(?:i\.e\.|i\.e|ie\.)(?=[^a-zA-Z0-9]|$)/gi, 'अर्थात्');

    // Pattern F: Standalone technical acronyms: e.g. SM, JMU, BSQP, SWR, VDU, etc.
    const abbrKeys = Object.keys(DEFAULT_RAILWAY_ABBREVIATIONS).sort((a, b) => b.length - a.length);
    for (const abbr of abbrKeys) {
        // Exclude common single words like "A", "I" from blanket replacement
        if (abbr.length <= 1) continue;
        const regex = new RegExp(`(?<=[^a-zA-Z0-9]|^)${escapeRegExp(abbr)}(?=[^a-zA-Z0-9]|$)`, 'g');
        result = result.replace(regex, DEFAULT_RAILWAY_ABBREVIATIONS[abbr]);
    }

// Set of full meaningful English words that must NEVER be converted to abbreviations
const MEANINGFUL_ENGLISH_WORDS = new Set([
    'BLOCK', 'BLOCKS', 'WORKING', 'WORKS', 'WORK', 'RULES', 'RULE',
    'STATION', 'STATIONS', 'GENERAL', 'DATE', 'DATES', 'ISSUE', 'ISSUES',
    'DUTIES', 'DUTY', 'SIGNAL', 'SIGNALS', 'CLEARANCE', 'PROCEDURE', 'PROCEDURES',
    'POINT', 'POINTS', 'MACHINE', 'MACHINES', 'TECHNICAL', 'CODE', 'CODES',
    'TRACK', 'TRACKS', 'SECTION', 'SECTIONS', 'LINE', 'LINES', 'MAIN', 'LOOP',
    'CLEAR', 'BEFORE', 'GIVING', 'GIVE', 'NORMAL', 'REVERSE', 'DETECTED', 'REMAIN',
    'PASS', 'DANGER', 'WITHOUT', 'AUTHORITY', 'CHAPTER', 'PARA', 'ORDER', 'ORDERS',
    'NOTICE', 'NOTICES', 'SAFETY', 'CIRCULAR', 'CIRCULARS', 'NORTHERN', 'RAILWAY',
    'RAILWAYS', 'HOME', 'ADVANCED', 'STARTER', 'CIRCUIT', 'CIRCUITS', 'SPEED',
    'RESTRICTION', 'RESTRICTIONS', 'CAUTION', 'BOARD', 'BOARDS', 'STOP', 'WHISTLE',
    'DISTANCE', 'DISTANCES', 'GRADIENT', 'GRADIENTS', 'BUILDING', 'BUILDINGS',
    'YARD', 'YARDS', 'SIDING', 'SIDINGS', 'PLATFORM', 'PLATFORMS', 'LEVEL',
    'CROSSING', 'CROSSINGS', 'TRAFFIC', 'MOVEMENT', 'TRAIN', 'TRAINS', 'DRIVER',
    'DRIVERS', 'GUARD', 'GUARDS', 'PILOT', 'PILOTS', 'ASSISTANT', 'POINTSMAN',
    'CABIN', 'TELEPHONE', 'CONTROL', 'METER', 'METERS', 'METRE', 'METRES',
    'KILOMETER', 'KILOMETERS', 'KILOMETRE', 'KILOMETRES', 'HEIGHT', 'WIDTH',
    'DEPTH', 'LENGTH', 'FALLING', 'RISING', 'STEEPEST', 'RULING', 'TOTAL',
    'NAME', 'NAMES', 'NUMBER', 'NUMBERS', 'REPORT', 'REPORTS', 'INSTRUCTION',
    'INSTRUCTIONS', 'HEADER', 'FOOTER', 'PAGE', 'PAGES', 'BOOK', 'BOOKS',
    'REFER', 'CHECK', 'TABLE', 'TABLES', 'COLUMN', 'ROW', 'TIME',
    'HOURS', 'MINUTES', 'SECONDS', 'FORCE', 'FORCIBLY', 'BROUGHT', 'LOCKED',
    'OCCUPIED', 'RECEIVED', 'APPLICABLE', 'UPDATED', 'ISSUED', 'POSITION',
    'ASPECT', 'CROSSOVER', 'DETECTION', 'SET', 'PART', 'PARTS', 'AND', 'THE',
    'FOR', 'WITH', 'FROM', 'INTO', 'OVER', 'UNDER', 'AFTER', 'DURING', 'THAT',
    'THIS', 'THESE', 'THOSE', 'HAVE', 'BEEN', 'WERE', 'WILL', 'SHALL', 'MUST',
    'SHOULD', 'EACH', 'BOTH', 'SOME', 'MANY', 'MORE', 'MOST', 'LESS',
    'NON', 'RUNNING', 'ENGINEERING', 'SLEEPER', 'SLEEPERS', 'CAPACITY', 'CAPACITIES',
    'THEIR', 'LONG', 'HOT', 'METAL',
    'WHENEVER', 'BALLAST', 'REMOVE', 'SECURED', 'CLAMP', 'PADLOCKS', 'SINCE',
    'PROVIDED', 'ADOPT', 'PHYSICALLY', 'INSPECT', 'ALTERNATIVE', 'SUITABLE',
    'PURPOSE', 'FORMAT', 'BELOW', 'APPROACH', 'WITHIN', 'UNTIL', 'CALLING',
    'FAILS', 'COUNTER', 'PANEL', 'SIGNAL', 'RESET', 'RECORD', 'CLEAR',
    'DEFECTIVE', 'ARRANGE', 'DISPATCHING', 'INFORM', 'VERIFY', 'OBSTRUCTION'
]);

    // Pattern F2: Abbreviations and initialisms:
    // A. Dot-separated initialisms: e.g. N.O.T.E., D.L.I., M.N.P., V.D.U.
    result = result.replace(/\b([A-Z](?:\.[A-Z])+\.?)\b/g, (match) => {
        const cleanUpper = match.replace(/\./g, '').toUpperCase();
        if (STRICT_ROMAN_SET.has(cleanUpper)) {
            return match;
        }
        return acronymToHindi(match);
    });

    // B. Known abbreviations or all-caps consonant clusters (2-6 letters without vowels, e.g. MSDAC, MNP, GWR, CSR, DLV)
    result = result.replace(/\b([A-Z]{2,6})\b/g, (match) => {
        const upper = match.toUpperCase();
        if (STRICT_ROMAN_SET.has(upper) || MEANINGFUL_ENGLISH_WORDS.has(upper)) {
            return match;
        }
        if (DEFAULT_RAILWAY_ABBREVIATIONS[upper]) {
            return DEFAULT_RAILWAY_ABBREVIATIONS[upper];
        }
        // If word contains vowels (like WORD, LINE), don't treat as acronym unless in DEFAULT_RAILWAY_ABBREVIATIONS
        const hasVowels = /[AEIOU]/.test(upper);
        if (hasVowels) {
            return match;
        }
        // Consonant-only acronym (e.g. CSR, DLV, GWR, MNP, BXT, AXT)
        return acronymToHindi(match);
    });

    // Clean up accidental double dots created when an abbreviation dot meets a sentence dot
    result = result.replace(/([\u0900-\u097F]\.)\.(?!\.)/g, '$1');

    // Pattern G: Technical notation in parentheses like (F) 303, (R) 303, (F), (R)
    result = result.replace(/\(([A-Za-z])\)(\s*\d+)/g, (match, letter, num) => {
        const letterHindi = ALPHABET_HINDI_MAP[letter.toUpperCase()] || letter;
        return `(${letterHindi})${num}`;
    });
    result = result.replace(/(?<=[^a-zA-Z0-9]|^)\(([Ff])\)(?=[^a-zA-Z0-9]|$)/g, '(एफ)');
    result = result.replace(/(?<=[^a-zA-Z0-9]|^)\(([Rr])\)(?=[^a-zA-Z0-9]|$)/g, '(आर)');

    // Pattern H: Technical designation letter followed by number: e.g. F 303 -> एफ 303
    result = result.replace(/(?<=[^a-zA-Z0-9]|^)([A-Z])(?=\s+\d+)/g, (match, letter) => {
        return ALPHABET_HINDI_MAP[letter] || letter;
    });

    // Pattern I: Technical designations after railway keywords: e.g. Point A -> पॉइंट ए
    result = result.replace(/\b(Track|Point|Line|Platform|Signal|ट्रैक|पॉइंट|लाइन|प्लेटफ़ॉर्म|सिग्नल)\s+([A-Za-z])\b/g, (match, kw, letter) => {
        const letterHindi = ALPHABET_HINDI_MAP[letter.toUpperCase()] || letter;
        return `${kw} ${letterHindi}`;
    });

    // Final clean up of double dots on Devanagari abbreviation endings
    result = result.replace(/([\u0900-\u097F]\.)\.(?!\.)/g, '$1');

    return result;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
