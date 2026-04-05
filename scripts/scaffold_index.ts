import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Use require for pdf-parse since generic TS import often fails without esModuleInterop
const pdfParse = require('pdf-parse');

dotenv.config();

const openai = new OpenAI({
    baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY || 'MISSING_API_KEY',
});

const MODEL_NAME = 'moonshotai/kimi-k2-instruct-0905';

// File paths
const ASSETS_DIR = path.join(__dirname, '..', 'Assets');
const BG_PDF_PATH = path.join(ASSETS_DIR, 'Bhagavad-gita-As-It-Is.pdf');
const OUTPUT_DIR = path.join(__dirname, '..', 'Docs', 'master_index');
const VERSE_COUNTS: { [key: string]: number } = {
    '1': 46, '2': 72, '3': 43, '4': 42, '5': 29, '6': 47, '7': 30, '8': 28,
    '9': 34, '10': 42, '11': 55, '12': 20, '13': 34, '14': 27, '15': 20, '16': 24, '17': 28, '18': 78
};

// Throttling Constants (RPM: 60, TPM: 10,000)
const DELAY_MS = 10000; // 12s per shloka (Safe for 10k TPM)
const TARGET_CHAPTER = '18';
const BATCH_SIZE_LIMIT = 78;

async function extractPdfText(pdfPath: string): Promise<string> {
    console.log(`Reading PDF: ${pdfPath}`);
    if (!fs.existsSync(pdfPath)) return '';
    const dataBuffer = fs.readFileSync(pdfPath);
    try {
        const data = await pdfParse(dataBuffer);
        return data.text;
    } catch (e) {
        return '';
    }
}

const chapterMap: { [key: string]: string } = {
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6',
    'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10', 'eleven': '11', 'twelve': '12',
    'thirteen': '13', 'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17', 'eighteen': '18'
};

/**
 * Global Sequential Parser for entire PDF text
 */
function extractVerses(text: string): { chapter: string, verse: string, content: string }[] {
    // 1. Identify Table of Contents End (first 50 occurrences of CHAPTER)
    const tocMatches = [...text.matchAll(/CONTENTS|CHAPTER\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|\d+)/gi)];
    const tocEndIdx = tocMatches.length > 50 ? tocMatches[50].index : 5000;

    // 2. Strict Marker Regex: TEXT/TEXTS must follow a newline to avoid purport references.
    // ADDED \b to the CHAPTER number options to avoid capturing partial words (e.g., EIGHT in EIGHTEEN).
    const markers = [...text.matchAll(/(?:\nCHAPTER\s+)\b(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|\d+)\b|(?:\nTEXTS?)\s+([\d\–\-]+)/g)];

    const rawResults: { chapter: string, verse: string, content: string }[] = [];
    let currentChapter = '0';

    for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        if (m.index! < (tocEndIdx || 0)) continue;

        if (m[1]) {
            const chName = m[1].toLowerCase();
            currentChapter = chapterMap[chName] || chName;
            continue;
        }

        if (m[2] && currentChapter !== '0') {
            const start = m.index! + m[0].length;
            const nextMarker = markers[i + 1];
            const end = nextMarker ? nextMarker.index : text.length;
            const content = text.substring(start, end!).trim();

            const verseLabel = m[2].trim().replace(/\s+/g, '');
            if (!verseLabel) continue;

            const parts = verseLabel.split(/[\–\-]/);
            if (parts.length > 1) {
                const low = parseInt(parts[0]);
                const high = parseInt(parts[parts.length - 1]);
                if (!isNaN(low) && !isNaN(high)) {
                    for (let v = low; v <= high; v++) {
                        rawResults.push({ chapter: currentChapter, verse: v.toString(), content });
                    }
                }
            } else {
                rawResults.push({ chapter: currentChapter, verse: parts[0], content });
            }
        }
    }

    // 3. Deduplicate: Gita is sequential. Only keep the FIRST occurrence of each verse in a chapter.
    const uniqueMap = new Map<string, { chapter: string, verse: string, content: string }>();
    for (const res of rawResults) {
        const key = `${res.chapter}:${res.verse}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, res);
        }
    }

    return Array.from(uniqueMap.values());
}

async function tagVerse(verse: any, bgText: string) {
    const chapDir = path.join(OUTPUT_DIR, `chapter_${verse.chapter}`);
    const filePath = path.join(chapDir, `Shloka_${verse.chapter}_${verse.verse}.json`);

    if (fs.existsSync(filePath)) {
        return null; // Should have been skipped in loop
    }

    console.log(`Tagging BG ${verse.chapter}.${verse.verse}...`);
    const prompt = `
You are a clinical psychologist and Vedic scholar for "Gita Mirror."
Analyze Verse ${verse.verse} of Chapter ${verse.chapter}.

CONTEXT:
${verse.content.substring(0, 5000)}

TASK: Output PURE JSON with exactly this structure:
{
  "shloka_id": "BG_${verse.chapter}.${verse.verse}",
  "chapter": ${verse.chapter},
  "verse": "${verse.verse}",
  "sanskrit": "Devanagari script",
  "transliteration": "IAST",
  "literal_meaning": "Word-for-word",
  "contextual_meaning": "Psychological summary",
  "themes": ["Dharma", "Renunciation", etc],
  "emotions": { 
    "primary": [],    // what the user (Arjuna) consciously feels
    "secondary": [],  // adjacent emotions, less dominant
    "shadow": []      // unconscious, repressed, or projected states (Jungian shadow)
  },
  "psychological_state": "Mental state summary",
  "trigger_scenario": "Modern relatable scenario",
  "keywords": ["trigger words"]
}
    `.trim();

    let attempts = 0;
    while (attempts < 5) {
        try {
            const response = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });
            return JSON.parse(response.choices[0].message.content || '{}');
        } catch (e: any) {
            attempts++;
            const isRetryable = e.status === 429 || e.status >= 500;
            if (isRetryable && attempts < 5) {
                const wait = Math.pow(2, attempts) * 5000;
                console.warn(`API Error (Status ${e.status}) for BG ${verse.chapter}.${verse.verse}. Retrying in ${wait / 1000}s...`);
                await new Promise(r => setTimeout(r, wait));
            } else {
                console.error(`Fatal Error BG ${verse.chapter}.${verse.verse}:`, e.message);
                return null;
            }
        }
    }
    return null;
}

async function runScaffold() {
    console.log(`--- Scaffolding Chapter ${TARGET_CHAPTER} (Robust Mode) ---`);
    const bgText = await extractPdfText(BG_PDF_PATH);
    if (!bgText) return;

    const allVerses = extractVerses(bgText);
    const chapterVerses = allVerses.filter(v => v.chapter === TARGET_CHAPTER);

    console.log(`Found ${chapterVerses.length} verses (Expected: ${VERSE_COUNTS[TARGET_CHAPTER]})`);
    if (chapterVerses.length < VERSE_COUNTS[TARGET_CHAPTER]) {
        console.warn(`WARNING: Missing verses! DEBUG found: ${chapterVerses.map(v => v.verse).join(', ')}`);
    }

    let processedInThisBatch = 0;
    for (const verse of chapterVerses) {
        const chapDir = path.join(OUTPUT_DIR, `chapter_${verse.chapter}`);
        if (!fs.existsSync(chapDir)) fs.mkdirSync(chapDir, { recursive: true });

        const filePath = path.join(chapDir, `Shloka_${verse.chapter}_${verse.verse}.json`);

        if (fs.existsSync(filePath)) {
            continue;
        }

        if (processedInThisBatch >= BATCH_SIZE_LIMIT) {
            console.log(`Reached BATCH_SIZE_LIMIT (${BATCH_SIZE_LIMIT}). Stopping for this session.`);
            break;
        }

        const tagData = await tagVerse(verse, bgText);
        if (tagData) {
            fs.writeFileSync(filePath, JSON.stringify(tagData, null, 2));
            console.log(`Saved: BG ${verse.chapter}.${verse.verse}`);
            processedInThisBatch++;
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }
}

runScaffold().catch(console.error);
