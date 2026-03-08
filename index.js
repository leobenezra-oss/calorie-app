const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'leo123';
const LOG_FILE = path.join(__dirname, 'scan_log.json');

if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify([]));
}

function saveLog(entry) {
  try {
    const logs = JSON.parse(fs.readFileSync(LOG_FILE));
    logs.unshift(entry);
    if (logs.length > 200) logs.pop();
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.log('Log error:', e.message);
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'sw.js'));
});

app.get('/admin', (req, res) => {
  const pass = req.query.pass;
  if (pass !== ADMIN_PASSWORD) {
    return res.status(401).send('Wrong password. Use /admin?pass=yourpassword');
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin/logs', (req, res) => {
  const pass = req.query.pass;
  if (pass !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  const logs = JSON.parse(fs.readFileSync(LOG_FILE));
  res.json(logs);
});

app.post('/analyse', upload.single('food'), async (req, res) => {
  try {
    const imageData = fs.readFileSync(req.file.path, { encoding: 'base64' });
    const mimeType = req.file.mimetype;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent([
      {
        inlineData: {
          data: imageData,
          mimeType: mimeType
        }
      },
      'Look at this food image. Identify the food and provide a full nutrition breakdown. Format your response EXACTLY as: Food: [name] | Calories: [number] kcal | Carbs: [number]g | Protein: [number]g | Fats: [number]g | Vegan: [yes/no] | Vegetarian: [yes/no] | Lactose Free: [yes/no] | Gluten Free: [yes/no] | Health Score: [number 1-10] | Notes: [brief info]'
    ]);

    const resultText = result.response.text();

    saveLog({
      timestamp: new Date().toISOString(),
      result: resultText,
      image: 'data:' + mimeType + ';base64,' + imageData
    });

    fs.unlinkSync(req.file.path);
    res.json({ result: resultText });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function keepAlive() {
  const url = process.env.RENDER_URL;
  if (url) {
    https.get(url, (res) => {
      console.log('Ping sent: ' + res.statusCode);
    }).on('error', (err) => {
      console.log('Ping failed: ' + err.message);
    });
  }
}

setInterval(keepAlive, 600000);

app.listen(process.env.PORT || 3000, () => {
  console.log('Calorie app running');
});