import { generateTranscription, generateCudaTranscription, createNotes } from "../util/queue";
import { createBibleStudy } from "./createbiblestudy";
import { createDevotional } from "./createdevotional";
import { generateVideoTitles } from "./yt-videos";

// let videoId = "vzGg6VnoSSw";
// await createNotesGemini('aP5-1HF932A');

// const missingVideos = await generateVideoTitles();
// for (const video of missingVideos) {
//   const videoId = video.videoId;
//   console.log(`Processing Video: ${video.fullTitle} (ID: ${videoId})`);
//   await generateCudaTranscription(videoId);
//   await createNotes(videoId);
//   await createBibleStudy(videoId);
//   await createDevotional(videoId);
// }


// await generateTranscription(videoId);
// await generateCudaTranscription(videoId);
// await createNotes(videoId);
// await createBibleStudy(videoId);
// await createDevotional(videoId);