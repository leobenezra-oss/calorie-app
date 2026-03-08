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
```

This means the app will read the key from an environment variable instead of having it written in the code — so it's never exposed publicly.

**Step 3 — Update your .env file**
Open **.env** and change it to:
```
GEMINI_API_KEY=AIzaSyAnKlsuTouKJ300HGTaqb8GYbNdir8_-18
```

**Step 4 — Create a .gitignore file**
In the terminal type:
```
echo ".env" > .gitignore
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

app.listen(3000, () => {
  console.log('Calorie app running at http://localhost:3000');
});