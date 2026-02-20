import { readdir } from "node:fs/promises";
import { extractBibleRefs } from '../util/bible';
import bible from '../data/NKJV_bible.json'
import or from '../util/openrouter'
import { vLLM } from "../util/vllm";


async function sentimentFlow(transcript: string) {
    const completion = await or.chat.send({
  chatGenerationParams: {
    model: 'x-ai/grok-4.1-fast',
    messages: [
      {
        role: 'user',
        content: `GOAL:
Describe the sentiment flow of this sermon in 1-3 sentences. Track the "emotional arc" does it start heavy (law/sin) and end light (grace/gospel).

CONSTRAINTS:
- Focus on the overall "emotional arc" of the sermon.
- Use simple, clear language.
- Avoid theological jargon; focus on the emotional tone.

SERMON TRANSCRIPT:

${transcript}
`,
      },
    ],
    stream: false,
  }
});

    return completion?.choices[0]?.message?.content || '';
}


let files:any = await readdir("../output", { recursive: true });

const bookType:any = {
    "Genesis": 'old', "Exodus": 'old', "Leviticus": 'old', "Numbers": 'old', "Deuteronomy": 'old', "Joshua": 'old', "Judges": 'old', "Ruth": 'old', "1 Samuel": 'old',
  "2 Samuel": 'old', "1 Kings": 'old', "2 Kings": 'old', "1 Chronicles": 'old', "2 Chronicles": 'old', "Ezra": 'old', "Nehemiah": 'old', "Esther": 'old',
  "Job": 'old', "Psalm": 'old', "Proverbs": 'old', "Ecclesiastes": 'old', "Song Of Solomon": 'old', "Isaiah": 'old', "Jeremiah": 'old', "Lamentations": 'old',
  "Ezekiel": 'old', "Daniel": 'old', "Hosea": 'old', "Joel": 'old', "Amos": 'old', "Obadiah": 'old', "Jonah": 'old', "Micah": 'old', "Nahum": 'old', "Habakkuk": 'old', "Zephaniah": 'old',
  "Haggai": 'old', "Zechariah": 'old', "Malachi": 'old', "Matthew": 'new', "Mark": 'new', "Luke": 'new', "John": 'new', "Acts": 'new', "Romans": 'new', "1 Corinthians": 'new',
  "2 Corinthians": 'new', "Galatians": 'new', "Ephesians": 'new', "Philippians": 'new', "Colossians": 'new', "1 Thessalonians": 'new', "2 Thessalonians": 'new',
  "1 Timothy": 'new', "2 Timothy": 'new', "Titus": 'new', "Philemon": 'new', "Hebrews": 'new', "James": 'new', "1 Peter": 'new', "2 Peter": 'new', "1 John": 'new',
  "2 John": 'new', "3 John": 'new', "Jude": 'new', "Revelation": 'new'
};

let completed = 0;
for (const file of files) {
    if(completed > 0) break;
  if (file.endsWith(".json")) {
    const content = await Bun.file(`../output/${file}`).json();
    let { video_id, transcript } = content;

    // if file already exists in stats folder, skip
    const statFile = Bun.file(`./stats/${video_id}_stats.json`);
    if (await statFile.exists()) {
        continue;
    }

    // count unique words in transcript
    const words = transcript.split(/\s+/);
    const uniqueWords = new Set(words);

    const bibleRefs = extractBibleRefs(transcript);

    let stats:any = {
        id: video_id,
        old: {
            count: 0,
            perc: 0,
        },
        new: {
            count: 0,
            perc: 0,
        },
    };
    for(const ref of bibleRefs.flatArr) {
        const {book} = ref;
        const type = bookType[book];
        if (type) {
            stats[type].count++;
        }
    }
    stats.old.perc = parseFloat(((stats.old.count / bibleRefs.flatArr.length) * 100).toFixed(2));
    stats.new.perc = parseFloat(((stats.new.count / bibleRefs.flatArr.length) * 100).toFixed(2));
    stats.uniqueWords = uniqueWords.size;
    stats.totalWords = words.length;
    stats.totalRefs = bibleRefs.flatArr.length;

    // console.log(bibleRefs.flatArr);
    let totalVerses = 0;
    for(const ref of bibleRefs.flatArr) {
        const {book, chapter, verses} = ref;
        // console.log(verses);
        if(verses.length > 0) {
            totalVerses += Object.keys(bible[book][chapter]).length;
        } else{
            totalVerses += verses.length;
        }
    }
    stats.totalVerses = totalVerses;

    // stats.sentimentFlow = await sentimentFlow(transcript);

    const [sentimentFlowRes, topics, bibleStories] = await Promise.all([
        sentimentFlow(transcript),
      vLLM({
        prompt: `TASK: Analyze the following sermon transcript and extract the primary biblical topics, theological themes, or doctrines discussed.
FORMAT: Return ONLY a JSON string array (e.g., ["Justification", "The Sovereignty of God", "Exodus 20", "The Great Commission"]).
CONSTRAINTS:
- Provide 5-10 specific topics.
- Focus on theological categories rather than general words.
- Do not include Markdown formatting or introductory text.

SERMON TRANSCRIPT:
${transcript}`,
        max_tokens: 2000,
      }),
      vLLM({
        prompt: `TASK: Analyze the following sermon transcript and list the official names of any specific Bible stories mentioned (e.g., "The Parable of the Prodigal Son", "The Fall of Jericho", "The Feeding of the 5000").
FORMAT: Return ONLY a JSON string array. If no specific Bible stories are mentioned, return an empty array [].
CONSTRAINTS:
- Only include recognizable, named biblical narratives.
- Do not include Markdown formatting or introductory text.

SERMON TRANSCRIPT:
${transcript}`,
        max_tokens: 2000,
      })
    ]);

//     let topics = await vLLM({
//       prompt: `GOAL:
// Describe the sentiment flow of this sermon in 1-3 sentences. Track the "emotional arc" does it start heavy (law/sin) and end light (grace/gospel).

// CONSTRAINTS:
// - Focus on the overall "emotional arc" of the sermon.
// - Use simple, clear language.
// - Avoid theological jargon; focus on the emotional tone.

// SERMON TRANSCRIPT:

// ${transcript}
// `,
//       max_tokens: 2000,
//     });
    // console.log("Raw topics response:", topics);
    // console.log("Raw Bible stories response:", bibleStories);

    stats.topics = JSON.parse(topics) || [];
    stats.bibleStories = JSON.parse(bibleStories) || [];
    stats.sentimentFlow = sentimentFlowRes || '';

    let wordCounts:any = {};
    for(const word of words){
        let cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
        let includeWords = {
            "god": true,
            "jesus": true,
            "christ": true,
            "lord": true,
            "father": true,
            "holy": true,
            "spirit": true,
            "messiah": true,
            "light": true,

            "sin": true,
            "sinful": true,
            "flesh": true,
            "death": true,
            "hell": true,
            "judgment": true,
            "curse": true,
            "law": true,
            "world": true,
            "darkness": true,
            "dark": true,
            "evil": true,

            "gospel": true,
            "church": true,
            "christian": true,
            "salvation": true,
            "righteousness": true,

            "love": true,
            "joy": true,
            "peace": true,
            "patience": true,
            "kindness": true,
            "goodness": true,
            "faithfulness": true,
            "gentleness": true,
            "self-control": true,

            "grace": true,
            "mercy": true,
            "forgiveness": true,
            "faith": true,
            "worship": true,
            "praise": true,
            "glory": true,
            "honor": true,
            "prayer": true,
            "pray": true,
        };
        if(includeWords[cleanWord]) {
            wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
        }
        
    }
    // sort wordCounts by count
    wordCounts = Object.fromEntries(Object.entries(wordCounts).sort(([,a],[,b]) => b-a));
    // console.log(wordCounts);
    stats.wordCounts = wordCounts;



    console.log(`${video_id}: ${uniqueWords.size} unique words, ${words.length} total words, ${bibleRefs.flatArr.length} Bible references`);
    console.log(stats);

    Bun.write(`./stats/${video_id}_stats.json`, JSON.stringify(stats, null, 2));
    // completed++;
    // console.log(`Completed: ${completed}/${files.length}`);
  }
}

// console.log(Object.keys(bible));