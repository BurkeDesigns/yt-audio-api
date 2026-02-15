// import t from '../output/transcript.json'
import or from './util/openrouter'
import { Hono } from "hono";
import { $ } from 'bun';
import { extractBibleRefs, getVersesFromReferenceList, injectBibleRefs } from './util/bible';
import bible from './data/NKJV_bible.json'
import { addToQueue } from './util/queue';
import { serveStatic } from 'hono/bun';
import { readdir } from "node:fs/promises";

const app = new Hono();

const noVideoFoundResponse = (video_id: string) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cornerstone Notes</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Google Sans', sans-serif;
            margin: 0px;
            padding: 0px;
            line-height: 1.6;
            color: #222;
        }
        body *{
            
        }
        .page{
            display: grid;
            gap: 32px;
            max-width: 800px;
            margin: auto;
            padding: 65px 20px;
        }
        iframe{
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            width: 100%;
            aspect-ratio: 16 / 9;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="md"><h1>Notes Not Found</h1><p>Please generate notes first by visiting <a href="/notes/generate/${video_id}">this page</a>.</p></div>
    </div>
</body>
</html>`;

const videoPendingProcessing = (video_id: string) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pending Notes</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Google Sans', sans-serif;
            margin: 0px;
            padding: 0px;
            line-height: 1.6;
            color: #222;
        }
        body *{
            
        }
        .page{
            display: grid;
            gap: 32px;
            max-width: 800px;
            margin: auto;
            padding: 65px 20px;
        }
        iframe{
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            width: 100%;
            aspect-ratio: 16 / 9;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="md"><h1>Notes Pending Generation</h1><p>This can take up to 3 mins. Please visit <a href="/notes/${video_id}">Your Notes</a> once it completes.</p></div>
    </div>
</body>
</html>`;

app.get("/verses/:label", async c => {
    const { label } = c.req.param();
    console.log(`Looking up verses for: ${label}`);

    let refs = extractBibleRefs(label);
    console.log("Extracted Bible References:", JSON.stringify(refs.flatArr, null, 2));

    const verses = await getVersesFromReferenceList(bible, refs.flatArr);

    let firstVerses = refs.flatArr[0]?.verses;
    let startingVerseNumber = firstVerses && firstVerses.length > 0 ? parseInt(firstVerses[0]) : 1;

    // console.log("Extracted Verses:", verses);

    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${label} - NKJV</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Google Sans', sans-serif;
            margin: 0px;
            padding: 0px;
            line-height: 1.6;
            color: #222;
        }
        body *{
            
        }
        .page{
            display: grid;
            gap: 32px;
            max-width: 800px;
            margin: auto;
            padding: 65px 20px;
            padding-bottom: 96px;
        }
        iframe{
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            width: 100%;
            aspect-ratio: 16 / 9;
        }
        
        a{
            color: hsl(224.56deg 84.89% 55%);
            text-underline-offset: 3px;
            transition: color 0.2s;
        }

        a:visited, a:hover{
            color: hsl(259.7deg 84.89% 55%);
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="ref">
            <h2>${label} - NKJV</h2>
            <p>${verses[0]?.verses?.map((v,idx) => `<b>[${idx + startingVerseNumber}]</b> ${v}`).join(' ')}</p>
            ${!label.includes(':') ? '' : `<a href="/verses/${verses[0].book} ${verses[0].chapter}" target="_blank">Read Full Chapter</a>`}
        </div>
    </div>
</body>
</html>`);
});

app.get("/bible-study/:video_id", async c => {
    const { video_id } = c.req.param();
    // console.log(`Generating notes for video ID: ${video_id}`);

    // serve the markdown file as html
    const path = `./bible-studies/${video_id}_biblestudy.md`;
    const file = Bun.file(path);
    // const fileExists = await file.exists();
    // if (!fileExists) {
    //     return c.html(noVideoFoundResponse(video_id), 404);
    // }
    let content = await file.text();
    content = injectBibleRefs(content);
    // const md = Bun.markdown.html(content, { headingIds: true });
    const md = Bun.markdown.render(content, { 
        heading: (children, { level }) => `<h${level} class="title">${children}</h${level}>`,
        paragraph: (children) => `<p>${children}</p>`,
        blockquote: (children) => `<blockquote>${children}</blockquote>`,
        code: (children, meta) => `<pre><code class="${meta?.language ? `language-${meta.language}` : ''}">${children}</code></pre>`,
        list: (children, { ordered, start }) => ordered ? `<ol start="${start}">${children}</ol>` : `<ul>${children}</ul>`,
        listItem: (children, meta) => meta?.checked !== undefined ? `<li class="task-list-item"><input type="checkbox" ${meta.checked ? 'checked' : ''} disabled> ${children}</li>` : `<li>${children}</li>`,
        hr: () => `<hr>`,
        table: (children) => `<div class="table-container"><table>${children}</table></div>`,
        thead: (children) => `<thead>${children}</thead>`,
        tbody: (children) => `<tbody>${children}</tbody>`,
        tr: (children) => `<tr>${children}</tr>`,
        th: (children, meta) => `<th${meta?.align ? ` align="${meta.align}"` : ''}>${children}</th>`,
        td: (children, meta) => `<td${meta?.align ? ` align="${meta.align}"` : ''}>${children}</td>`,
        html: (children) => children,
        strong: (children) => `<strong>${children}</strong>`,
        emphasis: (children) => `<em>${children}</em>`,
        link: (children, { href, title }) => `<a href="${href}"${title ? ` title="${title}"` : ''} target="_blank">${children}</a>`,
        image: (children, { src, title }) => `<img src="${src}" alt="${children}"${title ? ` title="${title}"` : ''}>`,
        codespan: (children) => `<code>${children}</code>`,
        strikethrough: (children) => `<s>${children}</s>`,
        text: (text) => text,
    });

    // let refs = extractBibleRefs(content);
    // console.log("Extracted Bible References:", refs);

    // refs.flatArr = refs.flatArr.filter((ref: string) => ref?.label?.search(':') !== -1);
    // const verses = await getVersesFromReferenceList(bible, refs.flatArr);
    // console.log("Extracted Verses:", verses);

    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cornerstone Bible Study</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Google Sans', sans-serif;
            margin: 0px;
            padding: 0px;
            line-height: 1.6;
            color: #222;
        }
        body *{
            
        }
        .page{
            display: grid;
            gap: 32px;
            max-width: 800px;
            margin: auto;
            padding: 65px 20px;
            padding-bottom: 96px;
        }
        iframe{
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            width: 100%;
            aspect-ratio: 16 / 9;
        }
        .table-container{
            overflow-x: auto;
            width: 100%;
            max-width: calc(100vw - 40px);
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }

        th, td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: left;
        }
        hr {
            border: none;
            border-top: 1px solid #eee;
            margin: 24px 0;
        }

        a{
            color: hsl(224.56deg 84.89% 55%);
            text-underline-offset: 3px;
            transition: color 0.2s;
        }

        a:visited, a:hover{
            color: hsl(259.7deg 84.89% 55%);
        }
            button {
                background-color: #222;
                color: white;
                border: none;
                padding: 5px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 16px;
                transition: background-color 0.2s;
            }
            button:hover {
                background-color: hsl(224.56deg 84.89% 55%);
            }
            .green-btn {
                background-color: hsl(120deg 60% 35%);
            }
            .blue-btn {
                background-color: hsl(224.56deg 84.89% 55%);
            }
        
        @media print {
            .hideOnPrint {
                display: none !important;
            }
            .page{
                padding: 0 !important;
            }
            iframe {
                display: none !important;
            }
        }
            .actionBtns {
                display: flex;
                gap: 8px;
                flex-direction: row;
                flex-wrap: wrap;
            }

    </style>
</head>
<body>
    <div class="page">
        <iframe src="https://www.youtube.com/embed/${video_id}" title="Cornerstone Chapel Leesburg, VA" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        <div class="md">${md}<hr/>
            <div class="actionBtns hideOnPrint">
                <button onclick="window.print()">Print Study</button>
                <button onclick="window.location.href='https://donate.stripe.com/aFa9AU4xldW5cbe5Gvak007'" class="hideOnPrint blue-btn">Donate</button>
            </div>
            <br/><br/>
            <a href="https://burkedesigns.biz" target="_blank" style="font-weight: bold; color: #222 !important;">Bible Study Powered by Burke Designs</a>
        </div>
        
    </div>
</body>
</html>`);
});

app.get("/notes/:video_id", async c => {
    const { video_id } = c.req.param();
    console.log(`Generating notes for video ID: ${video_id}`);

    // serve the markdown file as html
    const path = `./output/${video_id}_notes.md`;
    const file = Bun.file(path);
    const fileExists = await file.exists();
    if (!fileExists) {
        return c.html(noVideoFoundResponse(video_id), 404);
    }
    let content = await file.text();
    content = injectBibleRefs(content);
    // const md = Bun.markdown.html(content, { headingIds: true });
    const md = Bun.markdown.render(content, { 
        heading: (children, { level }) => `<h${level} class="title">${children}</h${level}>`,
        paragraph: (children) => `<p>${children}</p>`,
        blockquote: (children) => `<blockquote>${children}</blockquote>`,
        code: (children, meta) => `<pre><code class="${meta?.language ? `language-${meta.language}` : ''}">${children}</code></pre>`,
        list: (children, { ordered, start }) => ordered ? `<ol start="${start}">${children}</ol>` : `<ul>${children}</ul>`,
        listItem: (children, meta) => meta?.checked !== undefined ? `<li class="task-list-item"><input type="checkbox" ${meta.checked ? 'checked' : ''} disabled> ${children}</li>` : `<li>${children}</li>`,
        hr: () => `<hr>`,
        table: (children) => `<div class="table-container"><table>${children}</table></div>`,
        thead: (children) => `<thead>${children}</thead>`,
        tbody: (children) => `<tbody>${children}</tbody>`,
        tr: (children) => `<tr>${children}</tr>`,
        th: (children, meta) => `<th${meta?.align ? ` align="${meta.align}"` : ''}>${children}</th>`,
        td: (children, meta) => `<td${meta?.align ? ` align="${meta.align}"` : ''}>${children}</td>`,
        html: (children) => children,
        strong: (children) => `<strong>${children}</strong>`,
        emphasis: (children) => `<em>${children}</em>`,
        link: (children, { href, title }) => `<a href="${href}"${title ? ` title="${title}"` : ''} target="_blank">${children}</a>`,
        image: (children, { src, title }) => `<img src="${src}" alt="${children}"${title ? ` title="${title}"` : ''}>`,
        codespan: (children) => `<code>${children}</code>`,
        strikethrough: (children) => `<s>${children}</s>`,
        text: (text) => text,
    });

    // let refs = extractBibleRefs(content);
    // console.log("Extracted Bible References:", refs);

    // refs.flatArr = refs.flatArr.filter((ref: string) => ref?.label?.search(':') !== -1);
    // const verses = await getVersesFromReferenceList(bible, refs.flatArr);
    // console.log("Extracted Verses:", verses);

    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cornerstone Notes</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Google Sans', sans-serif;
            margin: 0px;
            padding: 0px;
            line-height: 1.6;
            color: #222;
        }
        body *{
            
        }
        .page{
            display: grid;
            gap: 32px;
            max-width: 800px;
            margin: auto;
            padding: 65px 20px;
            padding-bottom: 96px;
        }
        iframe{
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            width: 100%;
            aspect-ratio: 16 / 9;
        }
        .table-container{
            overflow-x: auto;
            width: 100%;
            max-width: calc(100vw - 40px);
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }

        th, td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: left;
        }
        hr {
            border: none;
            border-top: 1px solid #eee;
            margin: 24px 0;
        }

        a{
            color: hsl(224.56deg 84.89% 55%);
            text-underline-offset: 3px;
            transition: color 0.2s;
        }

        a:visited, a:hover{
            color: hsl(259.7deg 84.89% 55%);
        }
            button {
                background-color: #222;
                color: white;
                border: none;
                padding: 5px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 16px;
                transition: background-color 0.2s;
            }
            button:hover {
                background-color: hsl(224.56deg 84.89% 55%);
            }
            .green-btn {
                background-color: hsl(120deg 60% 35%);
            }
            .blue-btn {
                background-color: hsl(224.56deg 84.89% 55%);
            }
        
        @media print {
            .hideOnPrint {
                display: none !important;
            }
            .page{
                padding: 0 !important;
            }
            iframe {
                display: none !important;
            }
        }
            .actionBtns {
                display: flex;
                gap: 8px;
                flex-direction: row;
                flex-wrap: wrap;
            }

    </style>
</head>
<body>
    <div class="page">
        <iframe src="https://www.youtube.com/embed/${video_id}" title="Cornerstone Chapel Leesburg, VA" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        <div class="md">${md}<hr/>
            <div class="actionBtns hideOnPrint">
                <button onclick="window.print()">Print Notes</button>
                <button onclick="window.location.href='https://donate.stripe.com/aFa9AU4xldW5cbe5Gvak007'" class="blue-btn">Donate</button>
                <button onclick="window.location.href='/bible-study/${video_id}'" class="green-btn">View Bible Study</button>
            </div>
            <br/><br/>
            <a href="https://burkedesigns.biz" target="_blank" style="font-weight: bold; color: #222 !important;">Notes Powered by Burke Designs</a>
        </div>
        
    </div>
</body>
</html>`);
});

app.get("/", async c => {

    let files:any = await readdir("./output", { recursive: true });
   
    
    files = files.map(f => f.replace('_notes.md', ''));
 console.log("Files in output directory:", files);
    
    // let titles:any = {
    //     JwsergVfal0: "Wed Feb 11 | 7:00 PM Service",
    //     "8PqjX8I-ndo": "Sun Feb 8 | Unity through Humility",
    //     o4zmsZRVMMk: "Wed Feb 4 | His Mercy Is Great: His Justice Is Coming",
    //     IPCyw6IgjQU: "Sun Feb 1 | Torn between Two Worlds",
    //     // dQw4w9WgXcQ: "dQw4w9WgXcQ",
    //     zNS603PB6W0: "Sun Jan 28 | The Everlasting Covenant: God’s Promise to Israel",
    //     wSKk114Q7zQ: "Wed Jan 21 | The Rise of Antisemitism in Christian and Conservative Circles",
    // };

    let titles = [
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

    // files = files.map(f => {
    //     if(titles[f] != null) return;
    //     titles[f] = f;
    // });

    console.log("Titles for videos:", titles);


    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cornerstone Notes</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Google Sans', sans-serif;
            margin: 0px;
            padding: 0px;
            line-height: 1.6;
            color: #222;
        }
        body *{
            
        }
        .page{
            display: grid;
            gap: 32px;
            max-width: 800px;
            margin: auto;
            padding: 65px 20px;
            padding-top: 32px;
        }
        iframe{
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            width: 100%;
            aspect-ratio: 16 / 9;
        }
        
        a{
            color: hsl(224.56deg 84.89% 55%);
            text-underline-offset: 3px;
            transition: color 0.2s;
        }

        a:visited, a:hover{
            color: hsl(259.7deg 84.89% 55%);
        }

        li{
            margin-bottom: 12px;
        }
            hr {
            border: none;
            border-top: 1px solid #eee;
            margin: 24px 0;
        }
            button {
                background-color: hsl(224.56deg 84.89% 55%);
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 16px;
                transition: background-color 0.2s;
            }
            button:hover {
                background-color: hsl(259.7deg 84.89% 55%);
            }
    </style>
</head>
<body>
    <div class="page">
        <div class="ref">
            <h1>POWERFUL NOTES</h1>
            <hr />
            <h2>Cornerstone Chapel - Leesburg</h2>
            <ul>
                ${titles.map(({ videoId, fullTitle }) => `<li><a href="/notes/${videoId}" target="_blank">
                    <b>${fullTitle}</b>
                </a></li>`).join('')}
            </ul>
            <hr />
            <p>This free service is provided for the glory of God and the growth of His church! <br><br>If you find these notes helpful, please consider donating any amount you want to support the costs of running this service and to help others.</p>
            <div class="actionBtns hideOnPrint">
                <button onclick="window.location.href='https://donate.stripe.com/aFa9AU4xldW5cbe5Gvak007'" class="hideOnPrint">Help By Donating</button>
            </div>
            <br/>
            <a href="https://burkedesigns.biz" target="_blank" style="font-weight: bold; color: #222 !important;">Notes Powered by Burke Designs</a>
        </div>
    </div>
</body>
</html>`);
});

// app.get("/notes/generate/:video_id", async c => {
//     const { video_id } = c.req.param();
//     // console.log(`Generating notes for video ID: ${video_id}`);
//     addToQueue(video_id);
//     return c.html(videoPendingProcessing(video_id));
// });

app.use('/assets/*', serveStatic({ root: './public' }));

console.log(`Starting server on http://localhost:${Bun.env.PORT || 10100}/notes/JwsergVfal0`);

export default {
  port: Bun.env.PORT || 10100,
  fetch: app.fetch,
} 