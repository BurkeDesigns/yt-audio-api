// import t from '../output/transcript.json'
import or from './util/openrouter'
import { Hono } from "hono";
import { $ } from 'bun';
import { extractBibleRefs, getVersesFromReferenceList } from './util/bible';
import bible from './data/ESV_bible.json'
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
    // console.log("Extracted Bible References:", JSON.stringify(refs, null, 2));

    const verses = await getVersesFromReferenceList(bible, refs.flatArr);

    // console.log("Extracted Verses:", verses);

    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${label} - ESV</title>
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
            <h2>${label} - ESV</h2>
            <p>${verses[0]?.verses?.map((v,idx) => `<b>[${idx + 1}]</b> ${v}`).join(' ')}</p>
            ${!label.includes(':') ? '' : `<a href="/verses/${verses[0].book} ${verses[0].chapter}" target="_blank">Read Full Chapter</a>`}
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
    const content = await file.text();
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

    let refs = extractBibleRefs(content);
    console.log("Extracted Bible References:", refs);

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

    </style>
</head>
<body>
    <div class="page">
        <iframe src="https://www.youtube.com/embed/${video_id}" title="Cornerstone Chapel Leesburg, VA" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        <div class="md">${md}</div>
        <div class="refs">
            <h2>Bible References</h2>
            
            ${refs.flatArr.map((ref: any) => `<a href="/verses/${ref.label}" target="_blank">
                <strong>${ref.label}</strong>
            </a>`).join('<br />')}

            <!-- <pre>${JSON.stringify(refs.flatArr, null, 2)}</pre> -->
        </div>
    </div>
</body>
</html>`);
});

app.get("/", async c => {

    let files:any = await readdir("./output", { recursive: true });
   
    
    files = files.map(f => f.replace('_notes.md', ''));
 console.log("Files in output directory:", files);
    
    let titles:any = {
        JwsergVfal0: "Wed Feb 11 | 7:00 PM Service",
        "8PqjX8I-ndo": "Sun Feb 8 | Unity through Humility",
        o4zmsZRVMMk: "Wed Feb 4 | His Mercy Is Great: His Justice Is Coming",
        IPCyw6IgjQU: "Sun Feb 1 | Torn between Two Worlds",
        // dQw4w9WgXcQ: "dQw4w9WgXcQ",
        zNS603PB6W0: "Sun Jan 28 | The Everlasting Covenant: God’s Promise to Israel",
        wSKk114Q7zQ: "Wed Jan 21 | The Rise of Antisemitism in Christian and Conservative Circles",
    };

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
    </style>
</head>
<body>
    <div class="page">
        <div class="ref">
            <h2>Powerful Notes - Cornerstone Chapel Leesburg, VA</h2>
            <ul>
                ${Object.entries(titles).map(([video_id, title]) => `<li><a href="/notes/${video_id}" target="_blank">
                    <b>${title}</b>
                </a></li>`).join('')}
            </ul>
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