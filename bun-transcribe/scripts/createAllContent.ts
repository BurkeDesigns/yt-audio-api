import { generateTranscription, createNotes } from "../util/queue";
import { createBibleStudy } from "./createbiblestudy";

let videoId = "shIioPGmCoQ";

// await generateTranscription(videoId);
await createNotes(videoId);
await createBibleStudy(videoId);