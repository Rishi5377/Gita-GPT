const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('c:/Users/lenovo/Downloads/Gita-GPT/Assets/G279 IND.pdf');

pdf(dataBuffer).then(function(data) {
    console.log("Pages:", data.numpages);
    console.log("Text length:", data.text.length);
    console.log("Sample text:", data.text.substring(0, 100));
}).catch(console.error);
