import or from '../openrouter'
import { $ } from 'bun';

export let queue: any[] = [];
export let isProcessing = false;

export async function createNotes(video_id: string) {
    console.log(`Generating notes for video ID: ${video_id}`);
    const t = await Bun.file(`../output/${video_id}.json`).json();
const completion = await or.chat.send({
  chatGenerationParams: {
    model: 'x-ai/grok-4.1-fast',
    messages: [
      {
        role: 'user',
        content: `GOAL:
- Summarize the following transcript into concise, informative & comprehensive notes.
- The notes should capture the main points and key details without unnecessary information.

CONSTRAINTS:

- Be concise.
- Use bullet points where appropriate.
- Prioritize clarity and brevity.
- Make sure to mention announcements if made

FORMAT:

- Markdown only.
- Use headings, subheadings, and bullet points to organize information.
- Avoid unnecessary details.
- List all announcements under an "Announcements" heading. Make sure to link any event to "https://cornerstonechapel.net/events"
- If speaker names are provided, list the speakers
- If verses are mentioned, list them at the end (do not abbreviate them, correct example: 1 Chronicles 17:15-27, verses references should not include other chapters or non-sequential verses
 - bad example: "Psalm 106:1,47-48", should be: "Psalm 106:1, Psalm 106:47-48").

TRANSCRIPT:

${t.transcript}
`,
      },
    ],
    stream: false,
  }
});

    const markdown:string = completion?.choices[0]?.message?.content || '';
    // save markdown to file
    Bun.write(`./output/${t.video_id}_notes.md`, markdown);
    // console.log(completion?.choices[0]?.message.content);
    console.log(`Notes generated for video ID: ${video_id}`);

}

export async function generateTranscription(video: string) {
    console.log(`Generating transcription for video: ${video}`);
    let video_id = video.replace("https://www.youtube.com/watch?v=", "");
    const output = await $`bash -c "cd /Users/wesley/Documents/GitHub/yt-audio-api && source .venv/bin/activate && python yt_quick_transcribe.py 'https://www.youtube.com/watch?v=${video_id}' 'output/${video_id}.json'"`.text();
    console.log(output);
    // console.log(`Generating notes for video ID: ${video_id}`);
    // await createNotes();
}

export function addToQueue(item: string) {
    // add item to the queue if it's not already in the queue
    
    if(!queue.includes(item)) queue.push(item);
    // trigger processing
    if (isProcessing == false) processNext();
}

export async function processNext() {
    if (queue.length === 0) return;
    // while there are items in the queue
    while (queue.length > 0) {
        isProcessing = true;
        const item = queue.shift();
        await processItem(item);
    }
    isProcessing = false;
}


export async function processItem(video_id: any) {
    // placeholder for processing logic
    console.log("Processing item:", video_id);
    // simulate async processing
    // await new Promise(resolve => setTimeout(resolve, 1000));

    const transcript = Bun.file(`../output/${video_id}.json`);
    const transcriptExists = await transcript.exists();
    if (!transcriptExists) {
        await generateTranscription(`https://www.youtube.com/watch?v=${video_id}`);
        await createNotes(video_id);
    } else {
        // check if notes file exists
        const notes = Bun.file(`./output/${video_id}_notes.md`);
        const notesExists = await notes.exists();
        if (!notesExists) {
            await createNotes(video_id);
        } else {
            console.log("Notes already exist. Visit /notes/" + video_id + " to view them.");
        }
    }
}

export function getQueue() {
    return queue;
}

export function clearQueue() {
    queue = [];
}