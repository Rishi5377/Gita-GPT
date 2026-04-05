const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function debugPdf() {
    const pdfPath = path.join(__dirname, '..', 'Assets', 'G279 IND.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error(`File not found: ${pdfPath}`);
        return;
    }
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    const text = data.text;

    console.log("--- START OF PDF (First 2000 chars) ---");
    console.log(text.substring(0, 2000).replace(/\n/g, ' [NL] '));
    console.log("--- END OF START ---");

    // Search for Chapter markers
    const chapterMatches = text.matchAll(/CHAPTER\s+(\d+|[A-Z]+)/gi);
    console.log("\n--- CHAPTER MARKERS ---");
    let count = 0;
    for (const match of chapterMatches) {
        if (count < 20) console.log(`Found: "${match[0]}" at ${match.index}`);
        count++;
    }

    // Search for Verse markers
    console.log("\n--- VERSE MARKERS ---");
    const verseMatches = text.matchAll(/TEXT\s+(\d+)/gi);
    count = 0;
    for (const match of verseMatches) {
        if (count < 20) console.log(`Found: "${match[0]}" at ${match.index}`);
        count++;
    }
}

debugPdf().catch(console.error);
