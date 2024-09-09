require('dotenv').config(); // Load environment variables

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs'); // Use bcryptjs instead of bcrypt
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'chantichanti2255', // Use a strong secret for session management
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true in production if using HTTPS
}));

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI; // This should match your .env variable

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
});

// Store models in a map
const models = {};

// Function to get or create a model
const getModel = (collectionName) => {
  if (!models[collectionName]) {
    models[collectionName] = mongoose.model(collectionName, dataSchema);
  }
  return models[collectionName];
};

// Replace bcrypt.hashSync with bcryptjs.hashSync
const defaultUser = {
  username: 'Shankarpally400kv',
  passwordHash: bcrypt.hashSync('Shankarpally@9870', 10) // Use bcryptjs
};

// Replace bcrypt.compareSync with bcryptjs.compareSync
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Check credentials
  if (username === defaultUser.username && bcrypt.compareSync(password, defaultUser.passwordHash)) {
    req.session.authenticated = true; // Set session flag for authenticated user
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Invalid username or password' });
  }
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid'); // clear the session cookie
    res.redirect('/login.html'); // redirect to login page after logout
  });
});

// Middleware to check if the user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.session.authenticated) {
    return next();
  }
  res.redirect('/login.html'); // redirect to login if not authenticated
};

// Protect the route that serves Dataupload.html
app.get('/dataupload', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Dataupload.html'));
});

// Function to check if data exists in the collection
const checkDataExists = async (feeder, year, voltage, MW, date, time) => {
  const collectionName = `Feeder_${feeder}_Year_${year}`;
  const Model = getModel(collectionName);
  const exists = await Model.exists({ voltage, feeder, year, MW, date, time });
  return !!exists;
};

// Function to insert data into the correct collection
const insertDataIntoCollection = async (feeder, year, data) => {
  const collectionName = `Feeder_${feeder}_Year_${year}`;
  const Model = getModel(collectionName);
  const newData = new Model(data);
  return newData.save();
};

// POST route to save data
app.post('/upload', async (req, res) => {
  const { feeder, year, voltage, MW, date, time } = req.body;

  try {
    if (!feeder || !year || !voltage || !MW || !date || !time) {
      throw new Error('Missing required fields');
    }

    const dataExists = await checkDataExists(feeder, year, voltage, MW, date, time);

    if (dataExists) {
      res.json({ error: 'Data already exists in the database.' });
    } else {
      await insertDataIntoCollection(feeder, year, { voltage, feeder, year, MW, date, time });
      res.status(201).json({ message: 'Data saved successfully' });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET route to fetch data based on feeder and year
app.get('/data', async (req, res) => {
  const { feeder, year } = req.query;
  const collectionName = `Feeder_${feeder}_Year_${year}`;

  try {
    const Model = getModel(collectionName);
    const data = await Model.find();
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT route to update data
app.put('/update', async (req, res) => {
  const { id, MW, date, time } = req.body;
  const { feeder, year } = req.query;
  const collectionName = `Feeder_${feeder}_Year_${year}`;

  try {
    const Model = getModel(collectionName);
    const updatedData = await Model.findByIdAndUpdate(id, { MW, date, time }, { new: true });
    res.json({ message: 'Data updated successfully', data: updatedData });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE route to delete data
app.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;
  const { feeder, year } = req.query;
  const collectionName = `Feeder_${feeder}_Year_${year}`;

  try {
    const Model = getModel(collectionName);
    await Model.findByIdAndDelete(id);
    res.json({ message: 'Data deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Combined endpoint to check if data exists
app.get('/check-existence', async (req, res) => {
  const { feeder, year, date, time } = req.query;
  const collectionName = `Feeder_${feeder}_Year_${year}`;

  try {
    const Model = getModel(collectionName);
    const exists = await Model.exists({ feeder, year, date, time });
    res.json({ exists: !!exists });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
