require('dotenv').config(); // Load dotenv

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { check, validationResult } = require('express-validator');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Connection error', err);
});

// Define a schema
const dataSchema = new mongoose.Schema({
  voltage: String,
  feeder: String,
  year: String,
  MW: Number,
  date: String,
  time: String
}, { timestamps: true });

// Store models in a map
const models = {};

// Function to get or create a model
const getModel = (collectionName) => {
  if (!models[collectionName]) {
    models[collectionName] = mongoose.model(collectionName, dataSchema);
  }
  return models[collectionName];
};

// Function to check if data exists in the collection
const checkDataExists = async (feeder, year, voltage, MW, date, time) => {
  const collectionName = `Feeder_${feeder}_Year_${year}`;
  const Model = getModel(collectionName);
  return await Model.exists({ voltage, feeder, year, MW, date, time });
};

// Function to insert data into the correct collection
const insertDataIntoCollection = async (feeder, year, data) => {
  const collectionName = `Feeder_${feeder}_Year_${year}`;
  const Model = getModel(collectionName);
  const newData = new Model(data);
  return newData.save();
};

// POST route to save data
app.post('/upload', [
  check('feeder').not().isEmpty(),
  check('year').not().isEmpty(),
  check('voltage').not().isEmpty(),
  check('MW').isNumeric(),
  check('date').not().isEmpty(),
  check('time').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { feeder, year, voltage, MW, date, time } = req.body;

  try {
    const dataExists = await checkDataExists(feeder, year, voltage, MW, date, time);

    if (dataExists) {
      return res.status(409).json({ error: 'Data already exists in the database.' });
    } else {
      await insertDataIntoCollection(feeder, year, { voltage, feeder, year, MW, date, time });
      res.status(201).json({ message: 'Data saved successfully' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET route to fetch data based on feeder and year
app.get('/data', async (req, res) => {
  const { feeder, year } = req.query;
  if (!feeder || !year) {
    return res.status(400).json({ error: 'Missing required query parameters' });
  }

  const collectionName = `Feeder_${feeder}_Year_${year}`;

  try {
    const Model = getModel(collectionName);
    const data = await Model.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT route to update data
app.put('/update', [
  check('id').not().isEmpty(),
  check('MW').isNumeric(),
  check('date').not().isEmpty(),
  check('time').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id, MW, date, time } = req.body;
  const { feeder, year } = req.query;
  if (!feeder || !year) {
    return res.status(400).json({ error: 'Missing required query parameters' });
  }

  const collectionName = `Feeder_${feeder}_Year_${year}`;

  try {
    const Model = getModel(collectionName);
    const updatedData = await Model.findByIdAndUpdate(id, { MW, date, time }, { new: true });
    res.json({ message: 'Data updated successfully', data: updatedData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE route to delete data
app.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;
  const { feeder, year } = req.query;
  if (!feeder || !year) {
    return res.status(400).json({ error: 'Missing required query parameters' });
  }

  const collectionName = `Feeder_${feeder}_Year_${year}`;

  try {
    const Model = getModel(collectionName);
    await Model.findByIdAndDelete(id);
    res.json({ message: 'Data deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Combined endpoint to check if data exists
app.get('/check-existence', async (req, res) => {
  const { feeder, year, date, time } = req.query;
  if (!feeder || !year || !date || !time) {
    return res.status(400).json({ error: 'Missing required query parameters' });
  }

  const collectionName = `Feeder_${feeder}_Year_${year}`;

  try {
    const Model = getModel(collectionName);
    const exists = await Model.exists({ feeder, year, date, time });
    res.json({ exists: !!exists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
