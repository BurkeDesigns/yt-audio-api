import { generateTranscription, generateCudaTranscription, createNotes } from "../util/queue";
import { createBibleStudy } from "./createbiblestudy";
import { createDevotional } from "./createdevotional";
import { generateVideoTitles } from "./yt-videos";
import { $ } from "bun";

// let videoId = "vzGg6VnoSSw";
// await createNotesGemini('aP5-1HF932A');

// stop vllm processing

// await $`pm2 stop vllm-openai-service`;
// const missingVideos = await generateVideoTitles();
// for (const video of missingVideos) {
//   const videoId = video.videoId;
//   console.log(`Processing Video: ${video.fullTitle} (ID: ${videoId})`);
//   await generateCudaTranscription(videoId);
//   await createNotes(videoId);
//   await createBibleStudy(videoId);
//   await createDevotional(videoId);
// }
// await $`pm2 start vllm-openai-service`;


// await generateTranscription(videoId);
// await generateCudaTranscription(videoId);
// await createNotes(videoId);
// await createBibleStudy(videoId);
// await createDevotional(videoId);