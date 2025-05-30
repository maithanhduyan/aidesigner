const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path'); // Add path module for file operations
const app = express();
const port = 3000;
const chatHistoryPath = __dirname + '/public/chat-history.json';
const logFilePath = __dirname + '/server.log';
const errorLogFilePath = __dirname + '/error.log';

app.use(cors("*")); // Cho phép tất cả nguồn gốc
app.use(express.urlencoded({ extended: true })); // Phân tích dữ liệu URL-encoded
app.use(express.json());
app.use(express.static('public'));

let tailwind_page= `
<!DOCTYPE html>
<html>
  <head>
    <title>My app</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta charset="utf-8">
    <style>
      body {
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        height: 100dvh;
        font-family: "Arial", sans-serif;
        text-align: center;
      }
      .arrow {
        position: absolute;
        bottom: 32px;
        left: 0px;
        width: 100px;
        transform: rotate(30deg);
      }
      h1 {
        font-size: 50px;
      }
      h1 span {
        color: #acacac;
        font-size: 32px;
      }
    </style>
  </head>
  <body>
    <h1>
      <span>I'm ready to work,</span><br />
      Ask me anything.
    </h1>
    <img src="" class="arrow" />
    <script></script>
  </body>
</html>
`;

let bootstrap_page = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bootstrap 5 App</title>
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <style>
        /* Custom CSS only when Bootstrap can't handle it */
        .custom-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
    </style>
</head>
<body class="bg-light">
    <div class="container py-5">
        <div class="row justify-content-center">
            <div class="col-md-8 col-lg-6">
                <div class="card shadow">
                    <div class="card-body p-5 text-center">
                        <h1 class="mb-4">
                            <span class="text-muted d-block">Bootstrap 5 Ready</span>
                            Start Building
                        </h1>
                        <p class="lead">Ask me to create any UI component or layout</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Bootstrap 5 JS Bundle with Popper -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Your JavaScript here
    </script>
</body>
</html>
`;

// Default TailwindCSS UI generation prompt
let systemPrompt = `
ONLY USE HTML, CSS AND JAVASCRIPT. 
If you want to use any library, make sure to import it first.
If you want to use any icon, make sure to import the library first.
Try to create the best UI possible by using only HTML, CSS and JAVASCRIPT. 
Use as much as you can TailwindCSS for the CSS, if you can't do something with TailwindCSS, then use custom CSS (make sure to import <script src="https://cdn.tailwindcss.com"></script> in the head). 
Also, try to ellaborate as much as you can, to create something unique. 

**Template**:
${tailwind_page}

**ATTENTION: Reply html formatted only.**
`;

// Bootstrap 5 UI generation prompt
const bootstrapSystemPrompt = `ONLY USE HTML, CSS (Bootstrap 5) AND JAVASCRIPT. 
Make sure to include all required Bootstrap 5 CDN links in the head section.
If you need icons, use Bootstrap Icons (include the CDN).
Create responsive, modern designs using Bootstrap 5's utility classes and components.
Use custom CSS only when absolutely necessary (place in <style> tags in head).
For JavaScript, prefer vanilla JS but you may include jQuery if needed for Bootstrap components.

**Template**:
${bootstrap_page}

**Key Guidelines**:
1. Always use proper Bootstrap 5 grid system (container > row > col)
2. Utilize Bootstrap utility classes for spacing, colors, typography
3. Implement responsive design using breakpoint classes (col-md-, d-lg-none, etc.)
4. Use Bootstrap components (cards, modals, navbars) where appropriate
5. Keep custom CSS to a minimum - leverage Bootstrap first
6. Ensure all interactive elements have proper hover/focus states
7. Make the UI accessible (proper aria labels, semantic HTML)
8. Include all required CDNs in the head section

**ATTENTION: Reply html formatted only.**
`;

const htmlRegex = /<\s*!DOCTYPE\s+html[\s\S]*?<\/html>/i;

function writeLog(message) {
    const logMsg = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFile(logFilePath, logMsg, err => { /* Không làm chậm hệ thống, không throw */ });
}

function writeErrorLog(message) {
    const logMsg = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFile(errorLogFilePath, logMsg, err => { /* Không làm chậm hệ thống, không throw */ });
}

// --- AI PROVIDER HANDLERS ---
async function callTogetherAI({ model, systemPrompt, aiPrompt, temperature, max_tokens }) {
    const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
        model: model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: aiPrompt }
        ],
        temperature: temperature,
        max_tokens: max_tokens,
    }, {
        headers: {
            'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`
        }
    });
    return response.data.choices[0].message.content;
}

async function callGemini({ model, systemPrompt, aiPrompt }) {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY environment variable is not set!');
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
    const geminiBody = {
        contents: [
            { parts: [ { text: `${systemPrompt}\n${aiPrompt}` } ] }
        ]
    };
    const geminiRes = await axios.post(geminiUrl, geminiBody, {
        headers: { 'Content-Type': 'application/json' }
    });
    if (geminiRes.data && geminiRes.data.candidates && geminiRes.data.candidates[0].content && geminiRes.data.candidates[0].content.parts) {
        return geminiRes.data.candidates[0].content.parts.map(p => p.text).join(' ');
    }
    return 'Không tìm thấy nội dung HTML hợp lệ.';
}

function getSystemPrompt(framework) {
    if (framework === 'bootstrap') return bootstrapSystemPrompt;
    return systemPrompt;
}

function extractHtmlOnly(text) {
    const match = text.match(htmlRegex);
    if (match) return match[0];
    return '<!DOCTYPE html><html><body><h2>Không tìm thấy nội dung HTML hợp lệ.</h2></body></html>';
}

// --- MAIN GENERATION ROUTE ---
app.post('/generate', async (req, res) => {
    try {
        writeLog(`POST /generate | prompt: ${JSON.stringify(req.body.prompt)}, model: ${req.body.model}, framework: ${req.body.framework}`);
        const userPrompt = req.body.prompt;
        const model = req.body.model || "mistralai/Mixtral-8x7B-Instruct-v0.1";
        const framework = req.body.framework || 'tailwind';
        const systemPromptToUse = getSystemPrompt(framework);
        const temperature = typeof req.body.temperature === 'number' ? req.body.temperature : 0.7;
        const max_tokens = typeof req.body.max_tokens === 'number' ? req.body.max_tokens : 4000;
        let history = [];
        if (fs.existsSync(chatHistoryPath)) {
            try { history = JSON.parse(fs.readFileSync(chatHistoryPath, 'utf8')); } catch (e) { history = []; }
        }
        const aiPrompt = `Design a website with:\n${userPrompt}`;

        let htmlContent = '';
        if (model && model.toLowerCase().startsWith('gemini')) {
            htmlContent = await callGemini({ model, systemPrompt: systemPromptToUse, aiPrompt });
        } else {
            htmlContent = await callTogetherAI({ model, systemPrompt: systemPromptToUse, aiPrompt, temperature, max_tokens });
        }
        htmlContent = extractHtmlOnly(htmlContent);
        history.push({ prompt: userPrompt, model: model, framework, response: htmlContent, timestamp: Date.now() });
        fs.writeFileSync(chatHistoryPath, JSON.stringify(history, null, 2));

        // Save HTML content to a file in the public directory
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
        const fileName = `${timestamp}.html`;
        const filePath = path.join(__dirname, 'public', fileName);
        fs.writeFileSync(filePath, htmlContent);

        res.set('Content-Type', 'text/html');
        res.send(htmlContent);
        writeLog(`POST /generate | success | saved to ${fileName}`);
    } catch (error) {
        writeErrorLog(`POST /generate | error: ${error.stack || error.message}`);
        writeLog(`POST /generate | error: ${error.message}`);
        res.status(500).send('Error generating HTML');
    }
});

app.get('/', (req, res) => {
    writeLog('GET /');
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(port, () => {
    writeLog(`Server started at http://localhost:${port}`);
    console.log(`Server running at http://localhost:${port}`);
});

process.on('uncaughtException', (err) => {
    writeErrorLog(`uncaughtException: ${err.stack || err.message}`);
});
process.on('unhandledRejection', (reason, promise) => {
    writeErrorLog(`unhandledRejection: ${reason}`);
});

if (!process.env.TOGETHER_API_KEY) {
    writeLog('Warning: TOGETHER_API_KEY environment variable is not set!');
    console.warn('Warning: TOGETHER_API_KEY environment variable is not set!');
}
if (!process.env.GEMINI_API_KEY) {
    writeLog('Warning: GEMINI_API_KEY environment variable is not set!');
    console.warn('Warning: GEMINI_API_KEY environment variable is not set!');
}