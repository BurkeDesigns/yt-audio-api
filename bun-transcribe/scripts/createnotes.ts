import { queue, isProcessing, createNotes } from '../util/queue';

// await createNotes("8PqjX8I-ndo");
// await createNotes("o4zmsZRVMMk");
// await createNotes("IPCyw6IgjQU");
// await createNotes("zNS603PB6W0");
// await createNotes("wSKk114Q7zQ");

const videoIds = [
  "8PqjX8I-ndo",
  "o4zmsZRVMMk",
  "IPCyw6IgjQU",
  "zNS603PB6W0",
  "wSKk114Q7zQ",
];

await Promise.all(videoIds.map(id => createNotes(id)));