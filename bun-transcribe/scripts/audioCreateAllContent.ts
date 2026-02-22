import { 
    generateTranscription, 
    generateCudaTranscription,
    generateAudioFileCudaTranscription,
    createNotes 
} from "../util/queue";
import { createBibleStudy } from "./createbiblestudy";
import { createDevotional } from "./createdevotional";
import { generateVideoTitles } from "./yt-videos";
import { $ } from "bun";

// let videoId = "vzGg6VnoSSw";
// await $`pm2 stop vllm-openai-service`;
const audioId = "mens_steak_and_study_feb_2026";
// await generateAudioFileCudaTranscription(`./audio/${audioId}.m4a`);
// await createNotes(audioId, audioId);
// await createBibleStudy(audioId);
// await createDevotional(audioId);
// await $`pm2 start vllm-openai-service`;