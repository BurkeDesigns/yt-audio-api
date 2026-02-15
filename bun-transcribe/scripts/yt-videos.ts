import { google } from 'googleapis';

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
    const channelRes = await youtube.channels.list({
      key: API_KEY,
      id: CHANNEL_ID,
      part: 'contentDetails'
    });

    // console.log("Channel Response:", JSON.stringify(channelRes, null, 2));

    const uploadsPlaylistId = channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;

    // 2. Fetch the most recent videos from that playlist
    const playlistRes = await youtube.playlistItems.list({
      key: API_KEY,
      playlistId: uploadsPlaylistId,
      part: 'snippet,contentDetails',
      maxResults: 10 // Adjust as needed (max 50)
    });

    console.log("Playlist Response:", JSON.stringify(playlistRes, null, 2));

    const videos = playlistRes.data.items;
    
    const data = videos.map(video => {
      const title = video.snippet.title;
      const videoId = video.contentDetails.videoId;
      const publishedAt = video.snippet.publishedAt;
      const description = video.snippet.description;
      console.log(`${publishedAt} - ${title} (https://youtu.be/${videoId})`);
      return { title, videoId, publishedAt, description };
    });

    return data;

  } catch (error) {
    console.error('Error fetching videos:', error.message);
  }
}

CHANNEL_ID = await getChannelIdByHandle(CHANNEL_HANDLE);
await getRecentVideos();