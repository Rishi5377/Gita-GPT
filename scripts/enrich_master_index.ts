import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
const pdfParse = require('pdf-parse');

dotenv.config();

const openai = new OpenAI({
    baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY || 'MISSING_API_KEY',
});

const MODEL_NAME = 'moonshotai/kimi-k2-instruct-0905';

// File paths
const ASSETS_DIR = path.join(process.cwd(), 'Assets');
const BG_PDF_PATH = path.join(ASSETS_DIR, 'Bhagavad-gita-As-It-Is.pdf');
const MASTER_INDEX_DIR = path.join(process.cwd(), 'Docs', 'master_index');

const VERSE_COUNTS: { [key: number]: number } = {
    1: 47, 2: 72, 3: 43, 4: 42, 5: 29, 6: 47, 7: 30, 8: 28,
    9: 34, 10: 42, 11: 55, 12: 20, 13: 35, 14: 27, 15: 20, 16: 24, 17: 28, 18: 78
};

const chapterLabelMap: { [key: string]: number } = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
    'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12,
    'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18
};

// RPM / TPM limits: Using a 8s delay to be very safe
const DELAY_MS = 5000;

async function extractPdfText(pdfPath: string): Promise<string> {
    console.log(`Reading PDF Content...`);
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.text;
}

/**
 * Extracts context for a specific chapter and verse text marker.
 */
function findVerseText(text: string, currentChapter: number, verse: number): string {
    const marker = `TEXT ${verse}`;
    const chapterMarker = new RegExp(`CHAPTER\\s+([A-Z]+|\\d+)\\b`, 'gi');

    // We need to find the range of the current chapter
    const matches = [...text.matchAll(chapterMarker)];
    let chapterStartIndex = 0;
    let nextChapterIndex = text.length;

    for (let i = 0; i < matches.length; i++) {
        const chapVal = matches[i][1].toLowerCase();
        const chapNum = chapterLabelMap[chapVal] || parseInt(chapVal);
        if (chapNum === currentChapter) {
            chapterStartIndex = matches[i].index!;
            if (matches[i + 1]) nextChapterIndex = matches[i + 1].index!;
            break;
        }
    }

    const chapterText = text.substring(chapterStartIndex, nextChapterIndex);
    const verseIdx = chapterText.indexOf(marker);
    if (verseIdx === -1) return "Context not found";

    // Grab 3000 chars after the marker to ensure we get the meaning
    return chapterText.substring(verseIdx, verseIdx + 3000);
}

async function enrichShloka(chapter: number, verse: number, pdfText: string) {
    const chapDir = path.join(MASTER_INDEX_DIR, `chapter_${chapter}`);
    if (!fs.existsSync(chapDir)) fs.mkdirSync(chapDir, { recursive: true });

    const filePath = path.join(chapDir, `Shloka_${chapter}_${verse}.json`);
    let existingData: any = null;

    if (fs.existsSync(filePath)) {
        existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (existingData.anchor_text) {
            console.log(`- BG ${chapter}.${verse} already has anchor_text. Skip.`);
            return;
        }
    }

    let prompt = "";
    if (existingData) {
        // LITE ENRICHMENT: Use existing JSON content
        console.log(`Generating anchor_text for BG ${chapter}.${verse} (LITE)...`);
        prompt = `
You are a psychologist and Vedic scholar for "Gita Mirror. 
SHLOKA MEANING: ${existingData.literal_meaning}
SHLOKA CONTEXT: ${existingData.contextual_meaning}

TASK: Provide exactly one clean sentence (max 25 words) as "anchor_text" for this shloka. 
REQUIRED: No Sanskrit. Plain English only. No extra text.
Example: "Act without attachment to the results of your actions."

OUTPUT JSON: { "anchor_text": "..." }
`.trim();
    } else {
        // FULL GENERATION: Missing shloka
        console.log(`Generating FULL JSON for missing BG ${chapter}.${verse}...`);
        const context = findVerseText(pdfText, chapter, verse);
        prompt = `
You are a clinical psychologist and Vedic scholar for "Gita Mirror."
Analyze Chapter ${chapter}, Verse ${verse}.

CONTEXT: ${context.substring(0, 4000)}

TASK: Output PURE JSON with exactly this structure:
{
  "shloka_id": "BG_${chapter}.${verse}",
  "chapter": ${chapter},
  "verse": "${verse}",
  "sanskrit": "...",
  "transliteration": "...",
  "literal_meaning": "...",
  "contextual_meaning": "...",
  "anchor_text": "STRICT 15-WORD CLEAN ENGLISH SUMMARY",
  "themes": [],
  "emotions": { "primary": [], "secondary": [], "shadow": [] },
  "psychological_state": "...",
  "trigger_scenario": "...",
  "keywords": []
}
`.trim();
    }

    try {
        const response = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const newData = JSON.parse(response.choices[0].message.content || '{}');
        const finalData = existingData ? { ...existingData, ...newData } : newData;

        fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
        console.log(`✅ Saved BG ${chapter}.${verse}`);
        await new Promise(r => setTimeout(r, DELAY_MS));

    } catch (e: any) {
        console.error(`❌ Error BG ${chapter}.${verse}:`, e.message);
    }
}

async function runEnrichment() {
    const pdfText = await extractPdfText(BG_PDF_PATH);

    for (let chap = 1; chap <= 18; chap++) {
        const maxVerse = VERSE_COUNTS[chap];
        console.log(`\n--- CHAPTER ${chap} (${maxVerse} verses) ---`);
        for (let v = 1; v <= maxVerse; v++) {
            await enrichShloka(chap, v, pdfText);
        }
    }
}

runEnrichment().catch(console.error);
