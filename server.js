const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = 3000;

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

app.post('/generate', async (req, res) => {
    try {
        const userPrompt = req.body.prompt;
        
        const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
            model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
            messages: [
                {
                    "role": "system",
                    "content": systemPrompt
                },
                {
                    "role": "user",
                    "content": userPrompt
                }
            ],
            temperature: 0.7,
            max_tokens: 3000,
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`
            }
        });

        const htmlContent = response.data.choices[0].message.content;
        res.set('Content-Type', 'text/html');
        res.send(htmlContent);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error generating HTML');
    }
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});