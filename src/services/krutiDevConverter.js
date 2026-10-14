/**
 * Kruti Dev 010 Legacy <-> Devanagari Unicode Converter
 * Verified Remington Typewriter layout engine with complete conjunct,
 * matra, reph, nukta, and Roman numeral/punctuation preservation.
 */

// Mapping table for Unicode Devanagari -> Kruti Dev 010
const UNICODE_TO_KRUTI_ONE = [
    // Punctuation & Quotes (preserved / mapped)
    "‘", "’", "“", "”", "(", ")", "{", "}", "=", "।", "?", "µ", "॰", ",", "् ",
    // Numerals (Hindi numerals to Kruti Dev glyphs if needed; English digits 0-9 preserved)
    "०", "१", "२", "३", "४", "५", "६", "७", "८", "९",
    // Nukta consonants
    "फ़्", "क़", "ख़", "ग़", "ज़्", "ज़", "ड़", "ढ़", "फ़", "य़", "ऱ", "ऩ",
    // Complex Conjuncts
    "त्त्", "त्त", "क्त", "दृ", "कृ",
    "ह्न", "ह्य", "हृ", "ह्म", "ह्र", "ह्", "द्द", "क्ष्", "क्ष", "त्र्", "त्र", "ज्ञ",
    "छ्य", "ट्य", "ठ्य", "ड्य", "ढ्य", "द्य", "द्व",
    "श्र", "ट्र", "ड्र", "ढ्र", "छ्र", "क्र", "फ्र", "द्र", "प्र", "ग्र", "रु", "रू",
    "्र",
    // Vowels
    "ओ", "औ", "आ", "अ", "ई", "इ", "उ", "ऊ", "ऐ", "ए", "ऋ",
    // Consonants & Half forms
    "क्", "क", "क्क", "ख्", "ख", "ग्", "ग", "घ्", "घ", "ङ",
    "चै", "च्", "च", "छ", "ज्", "ज", "झ्", "झ", "ञ",
    "ट्ट", "ट्ठ", "ट", "ठ", "ड्ड", "ड्ढ", "ड", "ढ", "ण्", "ण",
    "त्", "त", "थ्", "थ", "द्ध", "द", "ध्", "ध", "न्", "न",
    "प्", "प", "फ्", "फ", "ब्", "ब", "भ्", "भ", "म्", "म",
    "य्", "य", "र", "ल्", "ल", "ळ", "व्", "व",
    "श्", "श", "ष्", "ष", "स्", "स", "ह",
    // Matras & modifiers
    "ऑ", "ॉ", "ो", "ौ", "ा", "ी", "ु", "ू", "ृ", "े", "ै",
    "ं", "ँ", "ः", "ॅ", "ऽ", "्"
];

const UNICODE_TO_KRUTI_TWO = [
    "^", "*", "Þ", "ß", "¼", "½", "¿", "À", "¾", "A", "\\", "&", "Œ", "]", "~ ",
    "å", "ƒ", "„", "…", "†", "‡", "ˆ", "‰", "Š", "‹",
    "¶", "d", "[k", "x", "T", "t", "M+", "<+", "Q", ";", "j", "u",
    "Ù", "Ùk", "ä", "–", "—",
    "à", "á", "â", "ã", "ºz", "º", "í", "{", "{k", "«", "=", "K",
    "Nî", "Vî", "Bî", "Mî", "<î", "|", "}",
    "J", "Vª", "Mª", "<ªª", "Nª", "Ø", "Ý", "æ", "ç", "xz", "#", ":",
    "z",
    "vks", "vkS", "vk", "v", "bZ", "b", "m", "Å", ",s", ",", "_",
    "D", "d", "ô", "[", "[k", "X", "x", "?", "?k", "³",
    "pkS", "P", "p", "N", "T", "t", "÷", ">", "¥",
    "ê", "ë", "V", "B", "ì", "ï", "M", "<", ".", ".k",
    "R", "r", "F", "Fk", ")", "n", "/", "/k", "U", "u",
    "I", "i", "¶", "Q", "C", "c", "H", "Hk", "E", "e",
    "¸", ";", "j", "Y", "y", "G", "O", "o",
    "'", "'k", "\"", "\"k", "L", "l", "g",
    "v‚", "‚", "ks", "kS", "k", "h", "q", "w", "`", "s", "S",
    "a", "¡", "%", "W", "·", "~"
];

// Reverse mapping for Kruti Dev 010 -> Unicode
const KRUTI_TO_UNICODE_ONE = [
    "ñ", "Q+Z", "sas", "aa", ")Z", "ZZ", "‘", "’", "“", "”",
    "å", "ƒ", "„", "…", "†", "‡", "ˆ", "‰", "Š", "‹",
    "¶+", "d+", "[+k", "[+", "x+", "T+", "t+", "M+", "<+", "Q+", ";+", "j+", "u+",
    "Ùk", "Ù", "ä", "–", "—", "é", "™", "=kk", "f=k",
    "à", "á", "â", "ã", "ºz", "º", "í", "{k", "{", "=", "«",
    "Nî", "Vî", "Bî", "Mî", "<î", "|", "K", "}",
    "J", "Vª", "Mª", "<ªª", "Nª", "Ø", "Ý", "nzZ", "æ", "ç", "Á", "xz", "#", ":",
    "v‚", "vks", "vkS", "vk", "v", "b±", "Ã", "bZ", "b", "m", "Å", ",s", ",", "_",
    "ô", "d", "Dk", "D", "[k", "[", "x", "Xk", "X", "Ä", "?k", "?", "³",
    "pkS", "p", "Pk", "P", "N", "t", "Tk", "T", ">", "÷", "¥",
    "ê", "ë", "V", "B", "ì", "ï", "M+", "<+", "M", "<", ".k", ".",
    "r", "Rk", "R", "Fk", "F", ")", "n", "/k", "èk", "/", "Ë", "è", "u", "Uk", "U",
    "i", "Ik", "I", "Q", "¶", "c", "Ck", "C", "Hk", "H", "e", "Ek", "E",
    ";", "¸", "j", "y", "Yk", "Y", "G", "o", "Ok", "O",
    "'k", "'", "\"k", "\"", "l", "Lk", "L", "g",
    "È", "z",
    "Ì", "Í", "Î", "Ï", "Ñ", "Ò", "Ó", "Ô", "Ö", "Ù", "Ük", "Ü",
    "‚", "ks", "kS", "k", "h", "q", "w", "`", "s", "S",
    "a", "¡", "%", "W", "•", "·", "∙", "~j", "~", "\\", "+", " ः",
    "^", "*", "Þ", "ß", "(", "¼", "½", "¿", "À", "¾", "A", "&", "Œ", "]", "~ ", "@"
];

const KRUTI_TO_UNICODE_TWO = [
    "॰", "QZ+", "sa", "a", "र्द्ध", "Z", "\"", "\"", "'", "'",
    "०", "१", "२", "३", "४", "५", "६", "७", "८", "९",
    "फ़्", "क़", "ख़", "ख़्", "ग़", "ज़्", "ज़", "ड़", "ढ़", "फ़", "य़", "ऱ", "ऩ",
    "त्त", "त्त्", "क्त", "दृ", "कृ", "न्न", "न्न्", "=k", "f=",
    "ह्न", "ह्य", "हृ", "ह्म", "ह्र", "ह्", "द्द", "क्ष", "क्ष्", "त्र", "त्र्",
    "छ्य", "ट्य", "ठ्य", "ड्य", "ढ्य", "द्य", "ज्ञ", "द्व",
    "श्र", "ट्र", "ड्र", "ढ्र", "छ्र", "क्र", "फ्र", "र्द्र", "द्र", "प्र", "प्र", "ग्र", "रु", "रू",
    "ऑ", "ओ", "औ", "आ", "अ", "ईं", "ई", "ई", "इ", "उ", "ऊ", "ऐ", "ए", "ऋ",
    "क्क", "क", "क", "क्", "ख", "ख्", "ग", "ग", "ग्", "घ", "घ", "घ्", "ङ",
    "चै", "च", "च", "च्", "छ", "ज", "ज", "ज्", "झ", "झ्", "ञ",
    "ट्ट", "ट्ठ", "ट", "ठ", "ड्ड", "ड्ढ", "ड़", "ढ़", "ड", "ढ", "ण", "ण्",
    "त", "त", "त्", "थ", "थ्", "द्ध", "द", "ध", "ध", "ध्", "ध्", "ध्", "न", "न", "न्",
    "प", "प", "प्", "फ", "फ्", "ब", "ब", "ब्", "भ", "भ्", "म", "म", "म्",
    "य", "य्", "र", "ल", "ल", "ल्", "ळ", "व", "व", "व्",
    "श", "श्", "ष", "ष्", "स", "स", "स्", "ह",
    "ीं", "्र",
    "द्द", "ट्ट", "ट्ठ", "ड्ड", "कृ", "भ", "्य", "ड्ढ", "झ्", "त्त्", "श", "श्",
    "ॉ", "ो", "ौ", "ा", "ी", "ु", "ू", "ृ", "े", "ै",
    "ं", "ँ", "ः", "ॅ", "ऽ", "ऽ", "ऽ", "्र", "्", "?", "़", ":",
    "‘", "’", "“", "”", ";", "(", ")", "{", "}", "=", "।", "&", "॰", ",", "् ", "/"
];

/**
 * Convert Unicode Devanagari string to Kruti Dev 010 legacy format.
 * Preserves Roman numerals, numeric decimals, dots, punctuation, and list markers.
 */
export function unicodeToKrutiDev(unicodeText, options = {}) {
    if (!unicodeText) return '';

    const protectedTokens = [];
    function maskToken(val) {
        const token = `__KDPROT_${protectedTokens.length}__`;
        protectedTokens.push({ token, value: val });
        return token;
    }

    // Step 1: Protect all non-Devanagari sequences:
    // Full stop dots (.), multiple dots (...), ellipsis (…),
    // Arabic numbers (0-9), decimals (2.5.1, 800.00), dates (22.07.2026),
    // Roman numerals (I, II, III, (iv)), list markers ((a), (b), a), b)),
    // and punctuation (/ : - :- & ( ) [ ]).
    // Devanagari range is \u0900-\u097F.
    let text = unicodeText.replace(/([^\u0900-\u097F\s]+)/g, (match) => {
        return maskToken(match);
    });

    // Normalize nukta variants
    text = text.replace(/क़/g, "क़");
    text = text.replace(/ख़/g, "ख़");
    text = text.replace(/ग़/g, "ग़");
    text = text.replace(/ज़/g, "ज़");
    text = text.replace(/ड़/g, "ड़");
    text = text.replace(/ढ़/g, "ढ़");
    text = text.replace(/ऩ/g, "ऩ");
    text = text.replace(/फ़/g, "फ़");
    text = text.replace(/य़/g, "य़");
    text = text.replace(/ऱ/g, "ऱ");

    // 3. Chhoti 'i' matra (ि) reordering
    let pos_f = text.indexOf("ि");
    while (pos_f !== -1) {
        let left_char = text.charAt(pos_f - 1);
        text = text.substring(0, pos_f - 1) + "f" + left_char + text.substring(pos_f + 1);
        pos_f = pos_f - 1;

        while ((pos_f > 0) && (text.charAt(pos_f - 1) === "्")) {
            let half_char = text.charAt(pos_f - 2) + "्";
            text = text.substring(0, pos_f - 2) + "f" + half_char + text.substring(pos_f + 1);
            pos_f = pos_f - 2;
        }
        pos_f = text.indexOf("ि", pos_f + 1);
    }

    // 4. Reph (र्) reordering
    const set_of_matras = "ािीुूृेैोौं:ँॅ";
    text += "  ";
    let pos_half_R = text.indexOf("र्");
    while (pos_half_R > 0) {
        let prob_pos_Z = pos_half_R + 2;
        let right_char = text.charAt(prob_pos_Z + 1);

        while (set_of_matras.indexOf(right_char) !== -1 && prob_pos_Z < text.length - 1) {
            prob_pos_Z = prob_pos_Z + 1;
            right_char = text.charAt(prob_pos_Z + 1);
        }

        let str_to_replace = text.substring(pos_half_R + 2, prob_pos_Z + 1);
        text = text.substring(0, pos_half_R) + str_to_replace + "Z" + text.substring(prob_pos_Z + 1);
        pos_half_R = text.indexOf("र्");
    }
    text = text.substring(0, text.length - 2);

    // 5. Replace Unicode symbols with Kruti Dev 010 legacy characters
    for (let i = 0; i < UNICODE_TO_KRUTI_ONE.length; i++) {
        const u = UNICODE_TO_KRUTI_ONE[i];
        const k = UNICODE_TO_KRUTI_TWO[i];
        if (text.indexOf(u) !== -1) {
            text = text.split(u).join(k);
        }
    }

    // 6. Restore all protected tokens in their exact original values
    for (const item of protectedTokens) {
        text = text.split(item.token).join(item.value);
    }

    return text;
}

/**
 * Convert Kruti Dev 010 legacy string to Unicode Devanagari.
 */
export function krutiDevToUnicode(krutiText) {
    if (!krutiText) return '';

    const protectedTokens = [];
    function maskToken(val) {
        const token = `\uE000${protectedTokens.length}\uE001`;
        protectedTokens.push({ token, value: val });
        return token;
    }

    let text = krutiText;

    // Step 1: Protect Arabic numerals, dates, decimals, and fractional references
    text = text.replace(/\b(\d+(?:\.\d+)+(?:\([a-zA-Z0-9]+\))?|\d{1,4}[-.\/]\d{1,2}[-.\/]\d{2,4}|\d+\/\d+|\d+)\b/g, (match) => {
        return maskToken(match);
    });

    // Step 2: Protect Roman numerals and bracketed Roman numbering
    text = text.replace(/\b(M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{1,4}))\b|(\((?:i|ii|iii|iv|v|vi|vii|viii|ix|x|I|II|III|IV|V|VI)\))/g, (match) => {
        return maskToken(match);
    });

    // Step 3: Protect ASCII parentheses around list markers e.g. (,), (ch), (lh), (Mh)
    text = text.replace(/\(([^()\n\r]+)\)/g, (match, inner) => {
        return maskToken('(') + inner + maskToken(')');
    });

    // Step 4: Convert Kruti Dev '.k' glyph to Devanagari 'ण' before abbreviation dot masking
    text = text.replace(/\.k/g, 'ण');

    // Protect abbreviation dots (e.g. 505,.,Dl.Vh.)
    text = text.replace(/\./g, (match) => {
        return maskToken(match);
    });

    // Direct substitutions from mapping arrays
    for (let i = 0; i < KRUTI_TO_UNICODE_ONE.length; i++) {
        const k = KRUTI_TO_UNICODE_ONE[i];
        const u = KRUTI_TO_UNICODE_TWO[i];
        if (text.indexOf(k) !== -1) {
            text = text.split(k).join(u);
        }
    }

    // Reph + Anusvara glyphs
    text = text.replace(/±/g, "Zं");
    text = text.replace(/Æ/g, "र्f");
    text = text.replace(/Ç/g, "fa");
    text = text.replace(/É/g, "र्fa");
    text = text.replace(/Ê/g, "ीZ");

    // Fix 'f' position (moving it back after consonant)
    let pos_i = text.indexOf("f");
    while (pos_i !== -1) {
        let char_next = text.charAt(pos_i + 1);
        text = text.replace("f" + char_next, char_next + "ि");
        pos_i = text.indexOf("f", pos_i + 1);
    }

    // Fix 'fa' position
    let pos_fa = text.indexOf("fa");
    while (pos_fa !== -1) {
        let char_next = text.charAt(pos_fa + 2);
        text = text.replace("fa" + char_next, char_next + "िं");
        pos_fa = text.indexOf("fa", pos_fa + 2);
    }

    // Fix wrongly positioned 'ि्'
    let pos_wrong_ee = text.indexOf("ि्");
    while (pos_wrong_ee !== -1) {
        let char_next = text.charAt(pos_wrong_ee + 2);
        text = text.replace("ि्" + char_next, "्" + char_next + "ि");
        pos_wrong_ee = text.indexOf("ि्", pos_wrong_ee + 2);
    }

    // Fix Reph "Z"
    const matras = "अ आ इ ई उ ऊ ए ऐ ओ औ ा ि ी ु ू ृ े ै ो ौ ं : ँ ॅ";
    let pos_R = text.indexOf("Z");
    while (pos_R > 0) {
        let prob_pos = pos_R - 1;
        let char_at_prob = text.charAt(prob_pos);

        while (matras.indexOf(char_at_prob) !== -1 && prob_pos > 0) {
            prob_pos--;
            char_at_prob = text.charAt(prob_pos);
        }

        let replace_str = text.substring(prob_pos, pos_R);
        text = text.replace(replace_str + "Z", "र्" + replace_str);
        pos_R = text.indexOf("Z");
    }

    // Restore protected tokens
    for (const item of protectedTokens) {
        text = text.split(item.token).join(item.value);
    }

    return text;
}

// Pure non-ASCII Kruti Dev glyphs (character codes > 127 in Remington layout)
const KRUTI_DEV_GLYPH_REGEX = /[ñåƒ„…†‡ˆ‰Š‹¶Ùäºí«|ØÝæçôêëìï÷¥èË±ÆÇÉÊÈÌÍÎÏÑÒÓÔÖÜ¿À¾ŒÞß]/;

// Structural patterns specific to Kruti Dev (never occurring in valid English words):
// - Word containing lowercase followed by capital 'Z' e.g. dk;Z, ekxZ, o"kZ (in Remington layout 'Z' is reph)
// - Word containing lowercase followed by capital 'A' at word boundary e.g. pkfg,A, gSA, FkkA, djsaA (in Remington layout 'A' is danda)
// - Word starting with 'f' followed by consonant cluster e.g. flXuy, fLFkfr, funsZ'k (chhoti 'i' matra)
// - Word starting with ';' followed by lowercase e.g. ;g, ;k, ;fn
// - Word starting with ',' followed by letters e.g. ,d, ,oa, ,slk, ,l, ,e, ,p
// - Word ending with lowercase then ',' e.g. pkfg,, fd,, fn,, x,, gq,
const KRUTI_DEV_STRUCTURAL_REGEX = /\b[a-z]+Z[a-zA-Z]*\b|\b[a-z]+A(?:\s|$|[.,;:])|\bf[b-df-hj-np-tv-z]{2,}[a-zA-Z]*|\b;[a-z]+|\b,[a-zA-Z]+|\b[a-z]+,(?:\s|$|A)/;

// Characteristic Kruti Dev words / morphemes
const KRUTI_DEV_MARKER_WORDS = new Set([
    'dks', 'ds', 'dh', 'dk', 'esa', 'ij', 'ls', 'us', 'rd',
    'gs', 'gsa', 'fkk', 'fks', 'fkh', 'gks', 'gksxk', 'gksxh', 'gksaxs', 'gksrk', 'gksrs', 'gksrh',
    'dj', 'djsa', 'djuk', 'djus', 'fd;k', 'fd,', 'fn;k', 'fn,', 'x;k', 'x,', 'xbz',
    'pkfg,', 'ldrk', 'ldrs', 'ldrh', 'jgk', 'jgs', 'jgh',
    ';g', 'og', 'bl', 'ml', 'bu', 'un', 'ftldk', 'ftlds', 'ftudh', 'tks', 'tc', 'rc',
    'vksj', 'rfkk', ',oa', ';k', 'vfkok', 'fd', 'd;k', 'd;ksafd', 'vkfn',
    "lvs'ku", 'flxuy', 'eklvj', 'yksdks', 'ikbyv', 'fu;e', 'lqj{kk', "funsz'k", 'vkj'
]);

// Common English words for language identification
const COMMON_ENGLISH_WORDS = new Set([
    'the', 'is', 'are', 'was', 'were', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with',
    'from', 'that', 'this', 'these', 'those', 'it', 'its', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
    'station', 'master', 'signal', 'signals', 'pilot', 'train', 'trains', 'section', 'sections',
    'rule', 'rules', 'operation', 'operations', 'line', 'lines', 'check', 'checked', 'verify', 'verified',
    'block', 'system', 'clear', 'interlocking', 'running', 'point', 'points', 'gear', 'gears',
    'note', 'notes', 'caution', 'warning', 'subject', 'date', 'number', 'reference', 'chapter', 'paragraph',
    'not', 'all', 'safety', 'instructions', 'procedure', 'clearance', 'general', 'subsidiary',
    'inform', 'informed', 'informing', 'action', 'damaged', 'defective', 'defect', 'ballast',
    'remove', 'removed', 'removing', 'clamp', 'padlock', 'padlocks', 'locked', 'physically',
    'inspected', 'inspect', 'register', 'details', 'detail', 'route', 'approach', 'approaching',
    'suitable', 'alternative', 'purpose', 'format', 'below', 'above', 'within', 'until', 'calling',
    'fails', 'counter', 'panel', 'reset', 'whenever', 'since', 'provided', 'adopt', 'recorded'
]);

/**
 * Determine if a text string is encoded in Kruti Dev 010 legacy format
 */
export function isKrutiDevText(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Genuine Kruti Dev 010 legacy text contains ZERO Devanagari Unicode characters (it is 8-bit Remington ASCII)
    const devCount = (trimmed.match(/[\u0900-\u097F]/g) || []).length;
    if (devCount > 0) return false;

    const words = trimmed.toLowerCase().split(/[^a-zA-Z0-9ñåƒ„…†‡ˆ‰Š‹¶Ùäºí«ØÝæçôêëìï÷¥èË±ÆÇÉÊÈÌÍÎÏÑÒÓÔÖÜ¿À¾ŒÞßZ~A,]+/i).filter(Boolean);

    // If any common English word is present, it is not pure Kruti Dev
    for (const w of words) {
        if (COMMON_ENGLISH_WORDS.has(w)) return false;
    }

    if (KRUTI_DEV_GLYPH_REGEX.test(trimmed)) return true;

    const hasKrutiStructure = KRUTI_DEV_STRUCTURAL_REGEX.test(trimmed);
    let krutiScore = 0;

    if (hasKrutiStructure) {
        krutiScore += 4;
    }

    for (const w of words) {
        if (KRUTI_DEV_MARKER_WORDS.has(w)) krutiScore += 3;
    }

    const decoded = krutiDevToUnicode(trimmed);
    const hasMeaningfulHindi = /(?:^|[\s.,!?|।\(\)\[\]\{\}'"—–:;])(स्टेशन|मास्टर|सिग्नल|नियम|सुरक्षा|निर्देश|दस्तावेज़|दस्तावेज|दस्तावेज़|अधिकृत|कार्य|मार्ग|और|तथा|एवं|को|के|की|का|में|पर|से|ने|है|हैं|था|थी|थे|चाहिए|किया|गया|होना|होता|तारीख|दिनांक|अनुसार|यह|वह|एक|डी\.एस\.टी\.ई\.|सी\.एस\.टी\.ई\.)(?:[\s.,!?|।\(\)\[\]\{\}'"—–:;]|$)/.test(decoded);
    if (hasMeaningfulHindi) {
        krutiScore += 6;
    }

    // Must have meaningful decoded Hindi, or strong score from both structural markers and marker words
    if (hasMeaningfulHindi) return true;
    if (krutiScore >= 6) return true;
    if (hasKrutiStructure && words.some(w => KRUTI_DEV_MARKER_WORDS.has(w))) return true;

    return false;
}

/**
 * Detect language and encoding of a text segment:
 * - 'EMPTY': whitespace only
 * - 'PUNCTUATION_OR_NUMBERS': dates, decimals, numbers, Roman numerals, punctuation
 * - 'UNICODE_HINDI': text is already Hindi Devanagari Unicode
 * - 'KRUTI_DEV': text is already Kruti Dev 010 legacy encoding
 * - 'ENGLISH': text is English and needs translation
 */
export function detectSegmentEncoding(text) {
    if (!text || !text.trim()) return 'EMPTY';
    const trimmed = text.trim();

    // Check if strictly numbers, dates, punctuation, Roman numerals
    const textWithoutPunctAndRomans = trimmed
        .replace(/\b[iIvVxXLCDM]+\b|\([iIvVxXLCDM]+\)/g, '')
        .replace(/[\d\s.,;:!?\/\-\(\)\[\]\{\}'"&%@+=\\_—–…\•]/g, '');
    if (!textWithoutPunctAndRomans) return 'PUNCTUATION_OR_NUMBERS';

    const devCount = (trimmed.match(/[\u0900-\u097F]/g) || []).length;
    const latinCount = (trimmed.match(/[a-zA-Z]/g) || []).length;

    // Pure or dominant Hindi Unicode
    if (devCount > 0 && devCount >= latinCount) {
        return 'UNICODE_HINDI';
    }

    if (isKrutiDevText(trimmed)) {
        return 'KRUTI_DEV';
    }

    return 'ENGLISH';
}

/**
 * Decode embedded or full Kruti Dev 010 text spans in a mixed line into Devanagari Unicode
 */
export function decodeEmbeddedKrutiDev(line) {
    if (!line || !line.trim()) return line;
    if (isKrutiDevText(line)) {
        return krutiDevToUnicode(line);
    }

    const tokens = line.split(/(\s+)/);
    let result = '';
    let i = 0;

    while (i < tokens.length) {
        const cleanWord = tokens[i].trim().toLowerCase().replace(/[^a-z]/g, '');
        // Already Devanagari Unicode or common English word or whitespace: do NOT decode
        if (COMMON_ENGLISH_WORDS.has(cleanWord) || !tokens[i].trim() || /[\u0900-\u097F]/.test(tokens[i])) {
            result += tokens[i];
            i++;
            continue;
        }

        // Try to match longest Kruti Dev span starting at i
        let longestSpan = '';
        let longestJ = -1;

        let accumulated = '';
        for (let j = i; j < tokens.length; j++) {
            // If encountered a Devanagari Unicode token or common English word, stop Kruti Dev accumulation
            if (/[\u0900-\u097F]/.test(tokens[j])) {
                break;
            }
            const nextWord = tokens[j].trim().toLowerCase().replace(/[^a-z]/g, '');
            if (COMMON_ENGLISH_WORDS.has(nextWord) && accumulated.trim().length > 0) {
                break;
            }
            accumulated += tokens[j];
            if (tokens[j].trim() && isKrutiDevText(accumulated)) {
                longestSpan = accumulated;
                longestJ = j;
            }
        }

        if (longestJ !== -1) {
            result += krutiDevToUnicode(longestSpan);
            i = longestJ + 1;
        } else {
            result += tokens[i];
            i++;
        }
    }

    return result;
}
