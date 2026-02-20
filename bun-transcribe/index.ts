// import t from '../output/transcript.json'
import or from './util/openrouter'
import { Hono } from "hono";
import { $ } from 'bun';
import { extractBibleRefs, getVersesFromReferenceList, injectBibleRefs } from './util/bible';
import bible from './data/NKJV_bible.json'
import { addToQueue } from './util/queue';
import { serveStatic } from 'hono/bun';
import { readdir } from "node:fs/promises";
// import { auth } from "./lib/auth";
import { handleError, res, throwErr } from "./util/response";
import { auth, requiresAuth, type OIDCEnv, login } from "@auth0/auth0-hono";

// routes
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';

const app = new Hono<OIDCEnv>();

app.use('*', async (c, next) => {
  // Check if the proxy is telling us the original request was HTTPS
  if (c.req.header('x-forwarded-proto') === 'https') {
    // We override the URL object inside the request so 
    // downstream middlewares (like Auth0) see 'https'
    const url = new URL(c.req.url);
    url.protocol = 'https:';
    
    // Some environments also need the port fix if the proxy 
    // changes it (e.g., 80 to 443)
    // url.port = ''; 

    // This effectively 'tricks' the OIDC library into 
    // generating an https:// redirect URI
    Object.defineProperty(c.req, 'url', {
      value: url.toString()
    });
  }
  await next();
});

// Configure auth middleware with Auth0 options
app.use(
  auth({
    domain: process.env.AUTH0_DOMAIN,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    baseURL: process.env.SITE_URL,
    authRequired: false,
    session: {
      secret: "0ZZND17mBpUxJXdZBxD8kY4AIq0EvJ72",
    },
    idpLogout: true,
    routes: {
        login: "/login",
        callback: "/auth/callback",
        logout: "/logout",
    }
  }),
);

// app.onError((err, c) => {
//   // Catch the specific error thrown by the auth0-hono middleware during callback
//   if (err.message.includes("request a token") || err.message.includes("state mismatch")) {
//     return c.redirect("/login");
//   }
//   console.error(err);
//   return c.text("Authentication Error", 500);
// });

// app.get('/debug-env', (c) => {
//   return c.json({
//     site_url_env: process.env.SITE_URL,
//     incoming_url: c.req.url,
//     x_forwarded_proto: c.req.header('x-forwarded-proto'), // Most proxies use this
//     cf_visitor: c.req.header('cf-visitor'), // Cloudflare specific
//   });
// });

app.get('/logout', async (c) => {
  // 1. Get the auth0 client from the context
  const auth0 = c.var.auth0Client;

  // 2. Call the logout method which clears the local session 
  // and redirects the user to the Auth0 logout endpoint
  if (auth0) {

    let data = await auth0.logout(c, {
        returnTo: process.env.SITE_URL || "http://localhost:10100", // Redirect back to the homepage after logout
    });

    
    return c.redirect(data.href);
    // const domain = process.env.AUTH0_DOMAIN;
    // const clientId = process.env.AUTH0_CLIENT_ID;
    // const returnTo = process.env.SITE_URL || "http://localhost:10100";

    // // Clear local session first
    // await auth0.logout(c); 
    
    // // Redirect to Auth0 logout endpoint
    // return c.redirect(`https://${domain}/v2/logout?client_id=${clientId}&returnTo=${encodeURIComponent(returnTo)}`);
  }

  return c.redirect('/');
  
});

app.get("/login", (c) => {
//   return c.text(`Hello ${c.var.auth0Client?.getSession(c)?.user?.name}!`);
    // return c.redirect('/');
    return login({
        redirectAfterLogin: process.env.SITE_URL, // Redirect to home page after login
        authorizationParams: {
          prompt: 'login',
        },
    }, c);
});
app.use("/profile/*", requiresAuth());
app.get("/profile", async (c) => {
  const user = await c.var?.auth0Client?.getUser(c);
  const session = await c.var.auth0Client?.getSession(c);

//   const logoutUrl = await c.var?.auth0Client?.buildLogoutUrl(c);
//   console.log("User Info:", c.var.auth0Client.logout(c));
//   console.log("User Info:", logoutUrl);
//   console.log("User Info:", user);
//   console.log("Session Info:", session);
//   return c.text(`Hello ${user.name || user.sub}!`);
  return c.text(`Hello ${user.name}!`);
});

app.get("/test", async c => {
    return c.text(process.env.SITE_URL || "http://localhost:10100");
});

// const app = new Hono<{
// 	Variables: {
// 		user: typeof auth.$Infer.Session.user | null;
// 		session: typeof auth.$Infer.Session.session | null
// 	}
// }>();

// app.use("*", async (c, next) => {
// 	const session = await auth.api.getSession({ headers: c.req.raw.headers });
//   	if (!session) {
//     	c.set("user", null);
//     	c.set("session", null);
//     	return await next();
//   	}
//   	c.set("user", session.user);
//   	c.set("session", session.session);
//   	return await next();
// });

// app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
// app.route('/auth', authRoutes)

app.use('/dash/*', async (c, next) => {
    const user = await c.var?.auth0Client?.getUser(c);
    let authorizedEmails = [
        'wesley@burkedesigns.biz',
        'crazedwolfe@gmail.com',
    ];
    if (user?.email && authorizedEmails.includes(user.email)) {
        await next();
    } else {
        return c.text("Unauthorized", 403);
    }
});
app.route('/dash', dashboardRoutes)

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
     const highlight = c.req.query('highlight');
     
     console.log(`Highlighting verses for: ${highlight}`);
    console.log(`Looking up verses for: ${label}`);

    let highlightRefs = highlight != null? extractBibleRefs(highlight) : null;
    let refs = extractBibleRefs(label);
    // console.log("Extracted Bible References:", JSON.stringify(refs.flatArr, null, 2));
    console.log("Extracted Bible References:", JSON.stringify(highlightRefs?.flatArr, null, 2));

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
        mark{
            text-decoration: underline;
             text-decoration-style: dotted;
             text-decoration-color: darkcyan;
            text-underline-offset: 3px;
            background-color: transparent;
        }
    </style>
    <script>
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags resetGroups onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
        posthog.init('phc_WTPgqIoxXPj2lbWMMvC3JCZRvaHbOomVGMNzyIY53oo', {
            api_host: 'https://us.i.posthog.com',
            defaults: '2026-01-30'
        })
    </script>
</head>
<body>
    <div class="page">
        <div class="ref">
            <h2>${label} - NKJV</h2>
            <p>${verses[0]?.verses?.map((v,idx) => {
                const verseNum = idx + startingVerseNumber;
                const isHighlighted = highlightRefs?.flatArr[0]?.verses?.includes(verseNum);
                const verseContent = isHighlighted == true ? `<mark>${v}</mark>` : v;
                // console.log(`Verse ${verseNum}: ${h.chapter.toString() === verses[0].chapter.toString()} ${isHighlighted ? '(highlighted)' : ''}`);
                return `<b>[${verseNum}]</b> ${verseContent}`;
            }).join(' ')}</p>
            ${!label.includes(':') ? '' : `<a href="/verses/${verses[0].book} ${verses[0].chapter}?highlight=${label}">Read Full Chapter</a>`}
        </div>
    </div>
</body>
</html>`);
});

app.get("/devotional/:video_id", async c => {
    const { video_id } = c.req.param();

     const user = await c.var?.auth0Client?.getUser(c);
    // console.log(`Generating notes for video ID: ${video_id}`);

    // serve the markdown file as html
    const path = `./devotionals/${video_id}_devotional.md`;
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
    <title>3-Day Devotional</title>
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
            .back-btn {
                display: inline-flex;
                align-items: center;
                text-decoration: none;
                color: #222;
                font-weight: bold;
                gap: 8px;
                transition: color 0.2s;
            }
            .back-btn:hover {
                color: hsl(224.56deg 84.89% 55%);
            }
    </style>
    <script>
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags resetGroups onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
        posthog.init('phc_WTPgqIoxXPj2lbWMMvC3JCZRvaHbOomVGMNzyIY53oo', {
            api_host: 'https://us.i.posthog.com',
            defaults: '2026-01-30'
        })
    </script>
</head>
<body>
    <div class="page">
        <div><a href="/notes/${video_id}" class="back-btn hideOnPrint">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back
        </a></div>
        <iframe src="https://www.youtube.com/embed/${video_id}" title="Cornerstone Chapel Leesburg, VA" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        <div class="md">${md}<hr/>
            <div class="actionBtns hideOnPrint">
                <button onclick="window.print()">Print Study</button>
                ${user != null ? `<button onclick="window.location.href='/dash/devotional/edit/${video_id}'">Edit Devotional</button>` : ``}
                <button onclick="window.location.href='/notes/${video_id}'">View Notes</button>
                <button onclick="window.location.href='https://donate.stripe.com/aFa9AU4xldW5cbe5Gvak007'" class="hideOnPrint blue-btn">Donate</button>
                <button onclick="window.location.href='/bible-study/${video_id}'" class="green-btn">View Bible Study</button>
            </div>
            <br/><br/>
            <a href="https://burkedesigns.biz" target="_blank" style="font-weight: bold; color: #222 !important;">Bible Study Powered by Burke Designs LLC</a>
        </div>
        
    </div>
</body>
</html>`);
});

app.get("/bible-study/:video_id", async c => {
    const { video_id } = c.req.param();
    // console.log(`Generating notes for video ID: ${video_id}`);
     const user = await c.var?.auth0Client?.getUser(c);

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
            .purple-btn {
                background-color: hsl(259.7deg 84.89% 55%);
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
            .back-btn {
                display: inline-flex;
                align-items: center;
                text-decoration: none;
                color: #222;
                font-weight: bold;
                gap: 8px;
                transition: color 0.2s;
            }
            .back-btn:hover {
                color: hsl(224.56deg 84.89% 55%);
            }
    </style>
    <script>
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags resetGroups onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
        posthog.init('phc_WTPgqIoxXPj2lbWMMvC3JCZRvaHbOomVGMNzyIY53oo', {
            api_host: 'https://us.i.posthog.com',
            defaults: '2026-01-30'
        })
    </script>
</head>
<body>
    <div class="page">
        <div><a href="/notes/${video_id}" class="back-btn hideOnPrint">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back
        </a></div>
        <iframe src="https://www.youtube.com/embed/${video_id}" title="Cornerstone Chapel Leesburg, VA" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        <div class="md">${md}<hr/>
            <div class="actionBtns hideOnPrint">
                <button onclick="window.print()">Print Study</button>
                ${user != null ? `<button onclick="window.location.href='/dash/bible-studies/edit/${video_id}'">Edit Study</button>` : ``}
                <button onclick="window.location.href='/notes/${video_id}'">View Notes</button>
                <button onclick="window.location.href='https://donate.stripe.com/aFa9AU4xldW5cbe5Gvak007'" class="hideOnPrint blue-btn">Donate</button>
                <button onclick="window.location.href='/devotional/${video_id}'" class="purple-btn">View Devotional</button>
            </div>
            <br/><br/>
            <a href="https://burkedesigns.biz" target="_blank" style="font-weight: bold; color: #222 !important;">Bible Study Powered by Burke Designs LLC</a>
        </div>
        
    </div>
</body>
</html>`);
});

app.get("/notes/:video_id", async c => {
    const { video_id } = c.req.param();

    // console.log(`Generating notes for video ID: ${video_id}`);
    const user = await c.var?.auth0Client?.getUser(c);

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
            .purple-btn {
                background-color: hsl(259.7deg 84.89% 55%);
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
            .back-btn {
                display: inline-flex;
                align-items: center;
                text-decoration: none;
                color: #222;
                font-weight: bold;
                gap: 8px;
                transition: color 0.2s;
            }
            .back-btn:hover {
                color: hsl(224.56deg 84.89% 55%);
            }

    </style>
    <script>
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags resetGroups onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
        posthog.init('phc_WTPgqIoxXPj2lbWMMvC3JCZRvaHbOomVGMNzyIY53oo', {
            api_host: 'https://us.i.posthog.com',
            defaults: '2026-01-30'
        })
    </script>
</head>
<body>
    <div class="page">
        <div><a href="/" class="back-btn hideOnPrint">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back
        </a></div>
        <iframe src="https://www.youtube.com/embed/${video_id}" title="Cornerstone Chapel Leesburg, VA" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        <div class="md">${md}<hr/>
            <div class="actionBtns hideOnPrint">
                <button onclick="window.print()">Print Notes</button>
                ${user != null ? `<button onclick="window.location.href='/dash/notes/edit/${video_id}'">Edit Notes</button>` : ``}
                <button onclick="window.location.href='https://donate.stripe.com/aFa9AU4xldW5cbe5Gvak007'" class="blue-btn">Donate</button>
                <button onclick="window.location.href='/bible-study/${video_id}'" class="green-btn">View Bible Study</button>
                <button onclick="window.location.href='/devotional/${video_id}'" class="purple-btn">View Devotional</button>
            </div>
            <br/><br/>
            <a href="https://burkedesigns.biz" target="_blank" style="font-weight: bold; color: #222 !important;">Notes Powered by Burke Designs LLC</a>
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
    fullTitle: "Wed Feb 18, 2026 - When Success Becomes Sin:The Warning Behind David&#39;s Census",
    videoId: "aP5-1HF932A",
  }, {
    fullTitle: "Sun Feb 15, 2026 - Our Witness Impacts Our World",
    videoId: "vzGg6VnoSSw",
  },
//   {
//     fullTitle: "Sun Feb 15, 2026 - 8am Service",
//     videoId: "shIioPGmCoQ",
//   }, 
  {
    fullTitle: "Wed Feb 11, 2026 - Lessons from David: His Victories &amp; Defeats",
    videoId: "kscwnWs34nA",
  }, 
  {
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
    <script>
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags resetGroups onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
        posthog.init('phc_WTPgqIoxXPj2lbWMMvC3JCZRvaHbOomVGMNzyIY53oo', {
            api_host: 'https://us.i.posthog.com',
            defaults: '2026-01-30'
        })
    </script>
</head>
<body>
    <div class="page">
        <div class="ref">
            <h1>POWERFUL NOTES</h1>
            <a href="/disclaimer">Disclaimer</a>
            <hr />
            <h2>Cornerstone Chapel - Leesburg</h2>
            <ul>
                ${titles.map(({ videoId, fullTitle }) => `<li><a href="/notes/${videoId}">
                    <b>${fullTitle}</b>
                </a></li>`).join('')}
            </ul>
            <hr />
            <p>This free service is provided for the glory of God and the growth of His church! <br><br>If you find these notes helpful, please consider donating any amount you want to support the costs of running this service, to keep it free, and to help others.</p>
            <div class="actionBtns hideOnPrint">
                <button onclick="window.location.href='https://donate.stripe.com/aFa9AU4xldW5cbe5Gvak007'" class="hideOnPrint">Help By Donating</button>
            </div>
            <br/>
            <a href="https://burkedesigns.biz" target="_blank" style="font-weight: bold; color: #222 !important;">Notes Powered by Burke Designs LLC</a>
        </div>
    </div>
</body>
</html>`);
});

app.get("/disclaimer", async c => {

    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Disclaimer | Powerful Notes</title>
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
            .back-btn {
                display: inline-flex;
                align-items: center;
                text-decoration: none;
                color: #222;
                font-weight: bold;
                gap: 8px;
                transition: color 0.2s;
            }
            .back-btn:hover {
                color: hsl(224.56deg 84.89% 55%);
            }
    </style>
    <script>
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags resetGroups onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
        posthog.init('phc_WTPgqIoxXPj2lbWMMvC3JCZRvaHbOomVGMNzyIY53oo', {
            api_host: 'https://us.i.posthog.com',
            defaults: '2026-01-30'
        })
    </script>
</head>
<body>
    <div class="page">
        <div class="ref">
            <div><a href="/" class="back-btn hideOnPrint">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                Back
            </a></div>
            <h1>POWERFUL NOTES DISCLAIMER</h1>
            <hr />
            <p>
                This resource is for those who love the Lord and want to go deeper into sermons and Scripture, and great care has been taken to make it as usable and accurate as possible. However, because we are imperfect it cannot be perfect, so please seek the Lord in prayer and fasting regarding anything you read or hear.
            </p>
            <hr />
            <p>This free service is provided for the glory of God and the growth of His church! <br><br>If you find these notes helpful, please consider donating any amount you want to support the costs of running this service, to keep it free, and to help others.</p>
            <div class="actionBtns hideOnPrint">
                <button onclick="window.location.href='https://donate.stripe.com/aFa9AU4xldW5cbe5Gvak007'" class="hideOnPrint">Help By Donating</button>
            </div>
            <br/>
            <a href="https://burkedesigns.biz" target="_blank" style="font-weight: bold; color: #222 !important;">Notes Powered by Burke Designs LLC</a>
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

app.onError(handleError);

export default {
  port: Bun.env.PORT || 10100,
  fetch: app.fetch,
} 