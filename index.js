const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'sw.js'));
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

    fs.unlinkSync(req.file.path);
    res.json({ result: result.response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Calorie app running');
});