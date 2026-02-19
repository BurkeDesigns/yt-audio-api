import { Hono } from "hono";
import { useState } from 'hono/jsx'
import { html } from 'hono/html' // required for JSX support to render properly
import { css, keyframes, Style } from 'hono/css'
// Hono JSX guide: https://hono.dev/docs/guides/jsx

// util
import { handleError, res, throwErr } from "../util/response";
import { auth, requiresAuth } from "@auth0/auth0-hono";

const route = new Hono();

route.use('*', async (c, next) => {
  c.setRenderer((content) => {
    return c.html(
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin />
          <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet" />

          <style dangerouslySetInnerHTML={{__html:`
            body {
                font-family: 'Google Sans', sans-serif;
                margin: 0px;
                padding: 0px;
                line-height: 1.6;
                color: #222;
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
          `}}></style>

          <script dangerouslySetInnerHTML={{__html:`!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags resetGroups onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
          posthog.init('phc_WTPgqIoxXPj2lbWMMvC3JCZRvaHbOomVGMNzyIY53oo', {
              api_host: 'https://us.i.posthog.com',
              defaults: '2026-01-30'
          })`}}></script>
        </head>
        <body>{content}</body>
      </html>
    )
  })
  await next()
});

route.get('/notes/edit/:video_id', requiresAuth(), async (c) => {
  const user = await c.var?.auth0Client?.getUser(c);
  const video_id = c.req.param('video_id');
  // if (videoId == null) return throwErr(c, "Video ID is required", 400);
  const path = `./output/${video_id}_notes.md`;
  const file = Bun.file(path);
  const fileExists = await file.exists();
  let content = await file.text();

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

  return c.render(
    <>
      <title>Edit Notes</title>
      <meta name='description' content='This is the about page.' />

      <style dangerouslySetInnerHTML={{__html:`
      body{
        margin: 0;
        padding: 0;
      }
      body *{
        box-sizing: border-box;
      }
      .preview {
        display: grid;
        height:100vh;
        width: 100%;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: max-content 1fr max-content;
      }
      #notes{
        width: 100%;
        height:100%;
        font-size: 16px;
        font-family: sans-serif;
        padding: 32px;
        grid-row: span 2;
        border: 0px;
          border-right: 1px solid #d3d3d3;
          padding-bottom: 100px;
      }
      .md{
        padding: 32px;
        background: #f1f1f1;
        overflow-y: auto;
        height: 100%;
        padding-bottom: 100px;
      }
      .floatingBtns{
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        gap: 8px;
        flex-direction: row;
      }
        .floatingBtns button{
          padding: 12px 24px;
          font-size: 16px;
          border: none;
          border-radius: 4px;
          background-color: hsl(224.56deg 84.89% 55%);
          color: white;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .floatingBtns button:hover{
          background-color: hsl(224.56deg 84.89% 45%);
        }

      @media (max-width: 768px) {
        .preview {
          grid-template-columns: 1fr;
          grid-template-rows: 50vh 50vh;
          height: 100vh;
        }
        #notes{
          grid-row: 2;
          border: 0px;
          border-top: 1px solid #d3d3d3;
          padding-top: 45px;
        }
        .md{
          grid-row: 1;
          
          
        }
      }
      `}}></style>
     
     <div className="preview">
      <textarea name="notes" id="notes">{content}</textarea>
      
      <div className="md" dangerouslySetInnerHTML={{ __html: md }}></div>
     </div>
     <div className="floatingBtns">
        <button id="save">Save</button>
        <button id="download">Download</button>
      </div>
    <script type="module" dangerouslySetInnerHTML={{ __html: `
      import { marked } from 'https://cdn.jsdelivr.net/npm/marked@17.0.2/+esm'

      const notes = document.getElementById('notes');
      const content = document.querySelector('.md');
      const saveBtn = document.getElementById('save');

      notes.oninput = (e) => {
        const markdown = e.target.value;
        content.innerHTML = marked.parse(markdown);
      }

      document.getElementById('download').onclick = () => {
        const notesValue = notes.value;
        console.log('notes:', notesValue);
        
        // download the notes
        const fileName = '${video_id}_notes.md';
        const blob = new Blob([notesValue], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }

      saveBtn.onclick = async () => {
        const notesValue = notes.value;
        console.log('Saving notes:', notesValue);

        const response = await fetch('/dash/api/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            video_id: '${video_id}',
            type: 'notes',
            content: notesValue
          })
        });

        if (response.ok) {
          alert('Notes saved successfully!');
        } else {
          alert('Failed to save notes.');
        }
      }
    `}} />
    </>
  )
})

route.post('/api/save', requiresAuth(), async (c) => {
  const user = await c.var?.auth0Client?.getUser(c);
  const { video_id, type, content } = await c.req.json();

  console.log('Saving content:', { video_id, type, content });

  switch(type) {
    case 'notes':
      await Bun.write(`./output/${video_id}_notes.md`, content);
      break;
    case 'devotional':
      await Bun.write(`./devotionals/${video_id}_devotional.md`, content);
      break;
    case 'biblestudy':
      await Bun.write(`./bible-studies/${video_id}_biblestudy.md`, content);
      break;
    default:
      return c.json({ success: false, msg: "Invalid content type" }, 400);
  }

  return c.json({ success: true, msg: "Content saved successfully!" });

});

route.get('/devotional/edit/:video_id', requiresAuth(), async (c) => {
  const user = await c.var?.auth0Client?.getUser(c);
  const video_id = c.req.param('video_id');
  // if (videoId == null) return throwErr(c, "Video ID is required", 400);
  const path = `./devotionals/${video_id}_devotional.md`;
  const file = Bun.file(path);
  const fileExists = await file.exists();
  let content = await file.text();

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

  return c.render(
    <>
      <title>Edit Devotional</title>
      <meta name='description' content='This is the about page.' />

      <style dangerouslySetInnerHTML={{__html:`
      body{
        margin: 0;
        padding: 0;
      }
      body *{
        box-sizing: border-box;
      }
      .preview {
        display: grid;
        height:100vh;
        width: 100%;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: max-content 1fr max-content;
      }
      #notes{
        width: 100%;
        height:100%;
        font-size: 16px;
        font-family: sans-serif;
        padding: 32px;
        grid-row: span 2;
        border: 0px;
          border-right: 1px solid #d3d3d3;
          padding-bottom: 100px;
      }
      .md{
        padding: 32px;
        background: #f1f1f1;
        overflow-y: auto;
        height: 100%;
        padding-bottom: 100px;
      }
      .floatingBtns{
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        gap: 12px;
        flex-direction: row;
      }
        .floatingBtns button{
          padding: 12px 24px;
          font-size: 16px;
          border: none;
          border-radius: 4px;
          background-color: hsl(224.56deg 84.89% 55%);
          color: white;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .floatingBtns button:hover{
          background-color: hsl(224.56deg 84.89% 45%);
        }

      @media (max-width: 768px) {
        .preview {
          grid-template-columns: 1fr;
          grid-template-rows: 50vh 50vh;
          height: 100vh;
        }
        #notes{
          grid-row: 2;
          border: 0px;
          border-top: 1px solid #d3d3d3;
          padding-top: 45px;
        }
        .md{
          grid-row: 1;
          
          
        }
      }
      `}}></style>
     
     <div className="preview">
      <textarea name="notes" id="notes">{content}</textarea>
      
      <div className="md" dangerouslySetInnerHTML={{ __html: md }}></div>
     </div>
     <div className="floatingBtns">
        <button id="save">Save</button>
        <button id="download">Download</button>
      </div>
    <script type="module" dangerouslySetInnerHTML={{ __html: `
      import { marked } from 'https://cdn.jsdelivr.net/npm/marked@17.0.2/+esm'

      const notes = document.getElementById('notes');
      const content = document.querySelector('.md');
      const saveBtn = document.getElementById('save');

      notes.oninput = (e) => {
        const markdown = e.target.value;
        content.innerHTML = marked.parse(markdown);
      }

      document.getElementById('download').onclick = () => {
        const notesValue = notes.value;
        console.log('notes:', notesValue);

        // download the notes
        const fileName = '${video_id}_notes.md';
        const blob = new Blob([notesValue], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }

      saveBtn.onclick = async () => {
        const notesValue = notes.value;
        console.log('Saving notes:', notesValue);

        const response = await fetch('/dash/api/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            video_id: '${video_id}',
            type: 'devotional',
            content: notesValue
          })
        });

        if (response.ok) {
          alert('Devotional saved successfully!');
        } else {
          alert('Failed to save devotional.');
        }
      }
    `}} />
    </>
  )
})

route.get('/bible-studies/edit/:video_id', requiresAuth(), async (c) => {
  const user = await c.var?.auth0Client?.getUser(c);
  const video_id = c.req.param('video_id');
  // if (videoId == null) return throwErr(c, "Video ID is required", 400);
  const path = `./bible-studies/${video_id}_biblestudy.md`;
  const file = Bun.file(path);
  const fileExists = await file.exists();
  let content = await file.text();

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

  return c.render(
    <>
      <title>Edit Bible Study</title>
      <meta name='description' content='This is the about page.' />

      <style dangerouslySetInnerHTML={{__html:`
      body{
        margin: 0;
        padding: 0;
      }
      body *{
        box-sizing: border-box;
      }
      .preview {
        display: grid;
        height:100vh;
        width: 100%;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: max-content 1fr max-content;
      }
      #notes{
        width: 100%;
        height:100%;
        font-size: 16px;
        font-family: sans-serif;
        padding: 32px;
        grid-row: span 2;
        border: 0px;
          border-right: 1px solid #d3d3d3;
          padding-bottom: 100px;
      }
      .md{
        padding: 32px;
        background: #f1f1f1;
        overflow-y: auto;
        height: 100%;
        padding-bottom: 100px;
      }
      .floatingBtns{
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        gap: 12px;
        flex-direction: row;
      }
        .floatingBtns button{
          padding: 12px 24px;
          font-size: 16px;
          border: none;
          border-radius: 4px;
          background-color: hsl(224.56deg 84.89% 55%);
          color: white;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .floatingBtns button:hover{
          background-color: hsl(224.56deg 84.89% 45%);
        }

      @media (max-width: 768px) {
        .preview {
          grid-template-columns: 1fr;
          grid-template-rows: 50vh 50vh;
          height: 100vh;
        }
        #notes{
          grid-row: 2;
          border: 0px;
          border-top: 1px solid #d3d3d3;
          padding-top: 45px;
        }
        .md{
          grid-row: 1;
          
          
        }
      }
      `}}></style>
     
     <div className="preview">
      <textarea name="notes" id="notes">{content}</textarea>
      
      <div className="md" dangerouslySetInnerHTML={{ __html: md }}></div>
     </div>
     <div className="floatingBtns">
        <button id="save">Save</button>
        <button id="download">Download</button>
      </div>
    <script type="module" dangerouslySetInnerHTML={{ __html: `
      import { marked } from 'https://cdn.jsdelivr.net/npm/marked@17.0.2/+esm'

      const notes = document.getElementById('notes');
      const content = document.querySelector('.md');
      const saveBtn = document.getElementById('save');

      notes.oninput = (e) => {
        const markdown = e.target.value;
        content.innerHTML = marked.parse(markdown);
      }

      document.getElementById('download').onclick = () => {
        const notesValue = notes.value;
        console.log('notes:', notesValue);

        // download the notes
        const fileName = '${video_id}_notes.md';
        const blob = new Blob([notesValue], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      saveBtn.onclick = async () => {
        const notesValue = notes.value;
        console.log('Saving notes:', notesValue);

        const response = await fetch('/dash/api/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            video_id: '${video_id}',
            type: 'biblestudy',
            content: notesValue
          })
        });

        if (response.ok) {
          alert('Bible study saved successfully!');
        } else {
          alert('Failed to save Bible study.');
        }
      }

    `}} />
    </>
  )
})

route.get("/test", async c => {
    return c.json({ message: "Hello World" });
});

route.get("/", requiresAuth(), async c => {
    return c.json({ message: "Hello World" });
});



export default route;
