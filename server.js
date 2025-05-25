const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const app = express();
const port = 3000;
const chatHistoryPath = __dirname + '/public/chat-history.json';
const logFilePath = __dirname + '/server.log';
const errorLogFilePath = __dirname + '/error.log';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const systemPrompt = `ONLY USE HTML, CSS AND JAVASCRIPT. 
If you want to use ICON make sure to import the library first. 
Try to create the best UI possible by using only HTML, CSS and JAVASCRIPT. 
Use as much as you can TailwindCSS for the CSS, if you can't do something with TailwindCSS, then use custom CSS (make sure to import <script src="https://cdn.tailwindcss.com"></script> in the head). 
This is a sample page:
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
    <img src="https://enzostvs-deepsite.hf.space/arrow.svg" class="arrow" />
    <script></script>
  </body>
</html>

Also, try to ellaborate as much as you can, to create something unique. 
**ATTENTION: Reply in one file html formatted text only.**`;

const htmlRegex = /<\s*!DOCTYPE\s+html[\s\S]*?<\/html>/i;

function writeLog(message) {
    const logMsg = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFile(logFilePath, logMsg, err => { /* Không làm chậm hệ thống, không throw */ });
}

function writeErrorLog(message) {
    const logMsg = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFile(errorLogFilePath, logMsg, err => { /* Không làm chậm hệ thống, không throw */ });
}

app.post('/generate', async (req, res) => {
    try {
        writeLog(`POST /generate | prompt: ${JSON.stringify(req.body.prompt)}, model: ${req.body.model}`);
        const userPrompt = req.body.prompt;
        const model = req.body.model || "mistralai/Mixtral-8x7B-Instruct-v0.1";
        const temperature = typeof req.body.temperature === 'number' ? req.body.temperature : 0.7;
        const max_tokens = typeof req.body.max_tokens === 'number' ? req.body.max_tokens : 4000;
        // Lưu prompt vào lịch sử
        let history = [];
        if (fs.existsSync(chatHistoryPath)) {
            try {
                history = JSON.parse(fs.readFileSync(chatHistoryPath, 'utf8'));
            } catch (e) {
                history = [];
            }
        }
        // Gửi cả giao diện hiện tại lên AI
        let currentHtml = '';
        try {
            currentHtml = fs.readFileSync(__dirname + '/public/index.html', 'utf8');
        } catch (e) {
            currentHtml = '';
        }
        const aiPrompt = `Dưới đây là giao diện HTML hiện tại của tôi:
-----
${currentHtml}
-----
Hãy dựa vào giao diện này và yêu cầu sau để thiết kế lại hoặc chỉnh sửa giao diện:
${userPrompt}`;
        const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
            model: model,
            messages: [
                {
                    "role": "system",
                    "content": systemPrompt
                },
                {
                    "role": "user",
                    "content": aiPrompt
                }
            ],
            temperature: temperature,
            max_tokens: max_tokens,
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`
            }
        });

        let htmlContent = response.data.choices[0].message.content;
        // Lọc chỉ lấy phần html
        const match = htmlContent.match(htmlRegex);
        if (match) {
            htmlContent = match[0];
        } else {
            // Nếu không có, trả về thông báo lỗi
            htmlContent = '<!DOCTYPE html><html><body><h2>Không tìm thấy nội dung HTML hợp lệ.</h2></body></html>';
        }
        // Lưu kết quả vào lịch sử
        history.push({ prompt: userPrompt, model: model, response: htmlContent, timestamp: Date.now() });
        fs.writeFileSync(chatHistoryPath, JSON.stringify(history, null, 2));
        res.set('Content-Type', 'text/html');
        res.send(htmlContent);
        writeLog('POST /generate | success');
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