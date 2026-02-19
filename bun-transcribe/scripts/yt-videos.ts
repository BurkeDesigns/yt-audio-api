import { google } from 'googleapis';
import { readdir } from "node:fs/promises";
import { createNotes, generateTranscription } from '../util/queue';

const youtube = google.youtube('v3');

const API_KEY = 'AIzaSyAGwlc2VCrUlpabhpx4aXBzVjfQnG4n48A';
// const CHANNEL_ID = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'; // Example: Google Developers
let CHANNEL_HANDLE = '@cornerstonechpl'; // Example: Google Developers
let CHANNEL_ID = ''; // Example: Google Developers

async function getChannelIdByHandle(handle) {
  try {
    // Ensure the handle has the '@' prefix
    const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;

    const response = await youtube.channels.list({
      key: API_KEY,
      part: 'id,snippet',
      forHandle: cleanHandle
    });

    const channels = response.data.items;

    if (!channels || channels.length === 0) {
      console.log('No channel found for that handle.');
      return null;
    }

    const channelId = channels[0].id;
    const title = channels[0].snippet.title;

    console.log(`Found: ${title}`);
    console.log(`Channel ID: ${channelId}`);
    
    return channelId;
  } catch (error) {
    console.error('Error fetching channel ID:', error.message);
  }
}

async function getRecentVideos() {
  try {
    // 1. Get the Channel's "Uploads" Playlist ID
    // const channelRes = await youtube.channels.list({
    //   key: API_KEY,
    //   id: CHANNEL_ID,
    //   part: 'contentDetails'
    // });

    // console.log("Channel Response:", JSON.stringify(channelRes, null, 2));

    // const uploadsPlaylistId = channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;

    // 2. Fetch the most recent videos from that playlist
    // const playlistRes = await youtube.playlistItems.list({
    //   key: API_KEY,
    //   playlistId: uploadsPlaylistId,
    //   part: 'snippet,contentDetails',
    //   maxResults: 50 // Adjust as needed (max 50)
    // });

    // console.log("Playlist Response:", JSON.stringify(playlistRes, null, 2));

    // const videos = playlistRes.data.items;

    const response = await youtube.search.list({
      key: API_KEY,
      part: 'snippet',
      channelId: CHANNEL_ID, // The ID of the channel you want to browse
      type: 'video',
      order: 'date',                         // To get the latest videos
      videoDuration: 'long',                // Filters for videos > 4 minutes to avoid Shorts
      maxResults: 10
    });

const videos = response.data.items;
    
    const data = videos.map(video => {
      const title = video.snippet.title;
      const videoId = video.id.videoId;
      const publishedAt = video.snippet.publishedAt;
      const description = video.snippet.description;
    //   console.log(`${publishedAt} - ${title} (https://youtu.be/${videoId})`);
      return { title, videoId, publishedAt, description };
    });

    return data;

  } catch (error) {
    console.error('Error fetching videos:', error.message);
  }
}

// CHANNEL_ID = await getChannelIdByHandle(CHANNEL_HANDLE);
// const videos = await getRecentVideos();

// let files:any = await readdir("../output", { recursive: true });
// files = files.map(f => f.replace('.json', ''));
// let fileSet = new Set(files);

// // get difference between videos and files
// let missingVideos = videos.filter((v:any) => !fileSet.has(v.videoId)).map(v=> v.videoId);
// console.log("Missing Videos:", missingVideos);
// console.log(`Total Videos: ${videos.length}`);
// console.log(`Missing Videos: ${missingVideos.length}`);

// for (const videoId of missingVideos) {
//   await generateTranscription(`https://www.youtube.com/watch?v=${videoId}`);
//   await createNotes(videoId);
// }

function formatClosestChurchDay(publishedAt) {
  const date = new Date(publishedAt);
  
  // Safety check for invalid dates
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date encountered: ${publishedAt}`);
    return "Unknown Date";
  }

  const dayOfWeek = date.getDay(); // 0 (Sun) to 6 (Sat)

  // Distances to Sunday (0) and Wednesday (3) within the same week
  const distToSun = Math.abs(dayOfWeek - 0);
  const distToWed = Math.abs(dayOfWeek - 3);

  // Determine the offset to the closest target day
  const offset = distToSun <= distToWed ? -dayOfWeek : (3 - dayOfWeek);
  
  const closestDate = new Date(date);
  closestDate.setDate(date.getDate() + offset);

  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Example output: "Wed Jun 4, 25" or "Sun Jun 1, 25"
  const parts = formatter.formatToParts(closestDate);
  const map = parts.reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  
  return `${map.weekday} ${map.month} ${map.day}, ${map.year}`;
}

export async function generateVideoTitles() {
  try {
    if(CHANNEL_ID == '') CHANNEL_ID = await getChannelIdByHandle(CHANNEL_HANDLE); 

    let files:any = await readdir("../output", { recursive: true });
    files = files.map(f => f.replace('.json', ''));
    let fileSet = new Set(files);

    const response = await youtube.search.list({
      key: API_KEY,
      part: 'snippet',
      channelId: CHANNEL_ID, // The ID of the channel you want to browse
      type: 'video',
      order: 'date',                         // To get the latest videos
      videoDuration: 'long',                // Filters for videos > 4 minutes to avoid Shorts
      maxResults: 20
    });

    const videos = response.data.items;
    
    const data = videos.map(video => {
      const title = video.snippet.title.split('|')[0].trim(); // Take the part before '|' and trim whitespace
      const videoId = video.id.videoId;
      const publishedAt = video.snippet.publishedAt;
      const description = video.snippet.description;

      // Use date from description if found (e.g. 2/15/2026), else use publishedAt
      const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{4})/;
      const match = description.match(dateRegex);
      let dateToUse = publishedAt;
      
      if (match) {
        const parsedDate = new Date(match[1]);
        if (!isNaN(parsedDate.getTime())) {
          dateToUse = match[1];
        }
      }

      const closestChurchDay = formatClosestChurchDay(dateToUse);
    //   console.log(`${publishedAt} - ${title} (https://youtu.be/${videoId})`);
      return { 
        title,
        videoId, 
        publishedAt, 
        closestChurchDay, 
        description,
        fullTitle: `${closestChurchDay} - ${title}`
      };
    });

    // console.log("Video:", JSON.stringify(data, null, 2));
    // let allTitles = {};
    let allTitles = data.filter((v:any) => fileSet.has(v.videoId) == false).map(v=> ({fullTitle: v.fullTitle, videoId: v.videoId}));
    console.log("All Titles:", allTitles);

    return allTitles;

    // return data;

  } catch (error) {
    console.error('Error fetching videos:', error.message);
  }
}

// await generateVideoTitles();
