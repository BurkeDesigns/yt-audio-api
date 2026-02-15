import { queue, isProcessing, createNotes } from '../util/queue';

// await createNotes("8PqjX8I-ndo");
// await createNotes("o4zmsZRVMMk");
// await createNotes("IPCyw6IgjQU");
// await createNotes("zNS603PB6W0");
// await createNotes("wSKk114Q7zQ");

// const videoIds = [
//   "8PqjX8I-ndo",
//   "o4zmsZRVMMk",
//   "IPCyw6IgjQU",
//   "zNS603PB6W0",
//   "wSKk114Q7zQ",
// ];

 let videos = [
  {
    fullTitle: "Wed Feb 11, 2026 - Lessons from David: His Victories &amp; Defeats",
    videoId: "kscwnWs34nA",
  }, {
    fullTitle: "Sun Feb 8, 2026 - Unity through Humility",
    videoId: "8PqjX8I-ndo",
  }, {
    fullTitle: "Wed Feb 4, 2026 - His Mercy Is Great: His Justice Is Coming",
    videoId: "o4zmsZRVMMk",
  }, {
    fullTitle: "Sun Feb 1, 2026 - Torn between Two Worlds",
    videoId: "IPCyw6IgjQU",
  }, {
    fullTitle: "Wed Jan 28, 2026 - The Everlasting Covenant: God’s Promise to Israel",
    videoId: "zNS603PB6W0",
  }, {
    fullTitle: "Wed Jan 21, 2026 - The Rise of Antisemitism in Christian and Conservative Circles",
    videoId: "wSKk114Q7zQ",
  }, {
    fullTitle: "Sun Jan 18, 2026 - My Chains, God’s Glory",
    videoId: "EbhY8Ozn-OU",
  }, {
    fullTitle: "Wed Jan 14, 2026 - How to Fight Our Enemies: Kneeling in Prayer",
    videoId: "o67es7l8Mpo",
  }, {
    fullTitle: "Sun Jan 11, 2026 - God Will Finish What He Starts",
    videoId: "SwYLmuL9tM4",
  }, {
    fullTitle: "Sun Jan 4, 2026 - Annual Question &amp; Answer Service with Pastors Gary, Tyler, and Austin Hamrick",
    videoId: "MniGAg2Tuoc",
  }, {
    fullTitle: "Sun Dec 28, 2025 - Mystery of the Magi",
    videoId: "hFGwAiQ2M-w",
  }, {
    fullTitle: "Wed Dec 24, 2025 - Christmas at Cornerstone",
    videoId: "_OAH4CwoSU8",
  }, {
    fullTitle: "Wed Dec 3, 2025 - God’s Mercy Is in the Waiting",
    videoId: "UHe2KEKCMiM",
  }, {
    fullTitle: "Sun Nov 30, 2025 - Thanksgiving Eve Service 2025",
    videoId: "tJebCfRkCu0",
  }, {
    fullTitle: "Sun Nov 30, 2025 - Sunday Service Of Thanksgiving",
    videoId: "-8irsaBoH8U",
  }, {
    fullTitle: "Sun Nov 23, 2025 - Stand Your Ground against the Enemy",
    videoId: "mA-hgd93zOg",
  }, {
    fullTitle: "Sun Nov 16, 2025 - Marriage, Family, and Work",
    videoId: "U2imJDEnpag",
  }, {
    fullTitle: "Wed Nov 12, 2025 - The Truth about Generational Sin",
    videoId: "9ZOiyU_N-bY",
  }, {
    fullTitle: "Sun Nov 9, 2025 - Putting Feet to Your Faith",
    videoId: "8sspXy650Gk",
  }, {
    fullTitle: "Sun Nov 2, 2025 - A Prayer for You",
    videoId: "jQyVgPHSQvw",
  }, {
    fullTitle: "Sun Oct 26, 2025 - The Rise of AI and the Future of the Church",
    videoId: "TtwIapjZX9I",
  }, {
    fullTitle: "Wed Oct 22, 2025 - Mysteries in the Bible: Time of Lawlessness",
    videoId: "BUDcFhEMMsg",
  }, {
    fullTitle: "Wed Oct 15, 2025 - Mysteries in the Bible: The Rapture",
    videoId: "sMbeVSWtgEY",
  }, {
    fullTitle: "Sun Oct 12, 2025 - Dead or Alive?",
    videoId: "KnGl-TAHw08",
  }, {
    fullTitle: "Wed Oct 8, 2025 - Verse by Verse Bible Study",
    videoId: "oJYSCTiVM24",
  }, {
    fullTitle: "Sun Sep 14, 2025 - When Truth Draws Enemies – Making Sense of Charlie Kirk&#39;s Murder",
    videoId: "f0qbLhlMgdU",
  }, {
    fullTitle: "Wed Sep 10, 2025 - Remembering Charlie Kirk and Pressing into Jesus",
    videoId: "B5_j2soD710",
  }, {
    fullTitle: "Sun Sep 7, 2025 - One in Christ",
    videoId: "t6V7VIpJ8GM",
  }, {
    fullTitle: "Wed Sep 3, 2025 - Verse by Verse Bible Study",
    videoId: "RxzmDg1T5Ks",
  }, {
    fullTitle: "Wed Sep 3, 2025 - Reverse of the Curse",
    videoId: "_liR_q9yZqo",
  }, {
    fullTitle: "Sun Aug 24, 2025 - Overcoming “Quiet Christianity”",
    videoId: "NCl73zpILXA",
  }, {
    fullTitle: "Wed Aug 20, 2025 - Verse by Verse Bible Study",
    videoId: "irLpwPu21Us",
  }, {
    fullTitle: "Sun Aug 17, 2025 - Jesus Plus Anything Ruins Everything",
    videoId: "s_XV5Feppag",
  }, {
    fullTitle: "Sun Aug 17, 2025 - From Gender Confusion to Freedom in Christ",
    videoId: "AdzHnvL5iZM",
  }, {
    fullTitle: "Wed Aug 13, 2025 - Verse by Verse Bible Study",
    videoId: "KEnNBufYAN4",
  }, {
    fullTitle: "Sun Aug 10, 2025 - Revival Night with Ryan Ries",
    videoId: "22O9otYr_t4",
  }, {
    fullTitle: "Sun Aug 3, 2025 - A Thorn in the Flesh",
    videoId: "31xUM0po7fc",
  }, {
    fullTitle: "Wed Jul 30, 2025 - Verse by Verse Bible Study",
    videoId: "LOXHVHyoH9M",
  }, {
    fullTitle: "Sun Jul 27, 2025 - The Hope of Heaven",
    videoId: "ADCfROvCK6c",
  }, {
    fullTitle: "Wed Jul 9, 2025 - Russia, Iran, and Israel: Are We Seeing Prophecy Unfold?",
    videoId: "VonH-J-dy8c",
  }, {
    fullTitle: "Sun Jun 22, 2025 - When in Times of Trouble",
    videoId: "-CXZubZi3Ms",
  }, {
    fullTitle: "Sun Jun 15, 2025 - Fatherhood: What the Bible Says about Being a Great Dad",
    videoId: "wTxd_MWudNc",
  }, {
    fullTitle: "Sun Jun 8, 2025 - Transformed by God’s Power: What the Transfiguration Teaches Us Today",
    videoId: "5xR56x5gZtg",
  }, {
    fullTitle: "Wed Jun 4, 2025 - Verse by Verse Bible Study",
    videoId: "nwEiRmDURzM",
  }, {
    fullTitle: "Sun Jun 1, 2025 - The Watchman",
    videoId: "mxouFoFbyZY",
  }, {
    fullTitle: "Sun May 11, 2025 - Generous Giving",
    videoId: "o1D90vbW1GE",
  }, {
    fullTitle: "Wed Apr 23, 2025 - A Tale of Two Gardens",
    videoId: "0M975atYah4",
  }, {
    fullTitle: "Sun Apr 20, 2025 - Easter Sunrise Service",
    videoId: "Pf2_FrA7qnw",
  }, {
    fullTitle: "Sun Apr 6, 2025 - Finding Perspective in the Pain",
    videoId: "wtJmVWMtQi4",
  }, {
    fullTitle: "Wed Mar 12, 2025 - Verse by Verse Bible Study",
    videoId: "fYqKlfKN1PQ",
  }
];

await Promise.all(videos.map(v => createNotes(v.videoId)));
console.log("All notes generated!");