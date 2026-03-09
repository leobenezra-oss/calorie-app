const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MongoClient, ServerApiVersion } = require('mongodb');

dotenv.config();

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'leo123';

const client = new MongoClient("mongodb+srv://leobenezra_db_user:9XvswDCsY6EsjXwd@leob.p3gceyh.mongodb.net/?appName=LeoB", {
  serverApi: { version: ServerApiVersion.v1 }
});
let logsCollection;
let goalsCollection;
client.connect().then(() => {
  console.log('MongoDB connected');
  logsCollection = client.db('calorie-app').collection('logs');
  goalsCollection = client.db('calorie-app').collection('goals');
});

async function saveLog(entry) {
  try {
    await logsCollection.insertOne(entry);
    console.log('Log saved to MongoDB!');
  } catch (e) {
    console.log('Log error:', e.message);
  }
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'manifest.json')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));

app.get('/admin', (req, res) => {
  const pass = req.query.pass;
  if (pass !== ADMIN_PASSWORD) return res.status(401).send('Wrong password. Use /admin?pass=yourpassword');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin/logs', async (req, res) => {
  const pass = req.query.pass;
  if (pass !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorised' });
  const logs = await logsCollection.find().sort({ timestamp: -1 }).limit(200).toArray();
  res.json(logs);
});

app.get('/history', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'No userId' });
  const logs = await logsCollection.find({ userId }).sort({ timestamp: -1 }).limit(50).toArray();
  res.json(logs);
});

app.get('/today', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'No userId' });
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const logs = await logsCollection.find({
    userId,
    timestamp: { $gte: startOfDay.toISOString() }
  }).toArray();
  res.json(logs);
});

app.get('/goals', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'No userId' });
  const goals = await goalsCollection.findOne({ userId });
  res.json(goals || { calories: 2000, protein: 150, carbs: 250, fats: 65 });
});

app.post('/goals', async (req, res) => {
  const { userId, calories, protein, carbs, fats } = req.body;
  if (!userId) return res.status(400).json({ error: 'No userId' });
  await goalsCollection.updateOne(
    { userId },
    { $set: { userId, calories, protein, carbs, fats } },
    { upsert: true }
  );
  res.json({ success: true });
});

app.post('/analyse', upload.single('food'), async (req, res) => {
  console.log('Analyse hit!');
  try {
    const imageData = fs.readFileSync(req.file.path, { encoding: 'base64' });
    const mimeType = req.file.mimetype;
    const userId = req.body.userId || 'anonymous';
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent([
      { inlineData: { data: imageData, mimeType } },
      'Look at this food image. Identify the food and provide a full nutrition breakdown. Format your response EXACTLY as: Food: [name] | Calories: [number] kcal | Carbs: [number]g | Protein: [number]g | Fats: [number]g | Vegan: [yes/no] | Vegetarian: [yes/no] | Lactose Free: [yes/no] | Gluten Free: [yes/no] | Health Score: [number 1-10] | Notes: [brief info]'
    ]);
    const resultText = result.response.text();
    await saveLog({ userId, timestamp: new Date().toISOString(), result: resultText, image: 'data:' + mimeType + ';base64,' + imageData });
    fs.unlinkSync(req.file.path);
    res.json({ result: resultText });
  } catch (error) {
    console.log('ANALYSE ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

function keepAlive() {
  const url = process.env.RENDER_URL;
  if (url) {
    https.get(url, (res) => { console.log('Ping sent: ' + res.statusCode); })
      .on('error', (err) => { console.log('Ping failed: ' + err.message); });
  }
}

setInterval(keepAlive, 600000);
app.listen(process.env.PORT || 3000, () => console.log('Calorie app running'));