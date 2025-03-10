require('dotenv').config(); // Load environment variables

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors({
  origin: ['http://400kvssshankarpally.free.nf', 'https://maxregister-git-main-vinay-kumars-projects-f1559f4a.vercel.app/'],
  credentials: true
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI).then(() => {
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
  date: String, // Assuming date is stored as YYYY-MM-DD
  time: String
});

// Store models in a map
const models = {};

const getModel = (collectionName) => {
  if (!models[collectionName]) {
    models[collectionName] = mongoose.model(collectionName, dataSchema);
  }
  return models[collectionName];
};

// Dummy credentials (hashed password)
const defaultUser = {
  username: 'Shankarpally400kv',
  passwordHash: bcrypt.hashSync('Shankarpally@9870', 10)
};

// POST route for login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === defaultUser.username && bcrypt.compareSync(password, defaultUser.passwordHash)) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Invalid username or password' });
  }
});

// Logout route
app.post('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.redirect('/login.html');
  });
});

// GET route to check if user is authenticated
app.get('/check-auth', (req, res) => {
  res.json({ authenticated: req.session.authenticated || false });
});

// Middleware to check authentication
const ensureAuthenticated = (req, res, next) => {
  if (req.session.authenticated) return next();
  res.redirect('/login.html');
};

// Protect the route that serves Dataupload.html
app.get('/dataupload', ensureAuthenticated, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'public', 'Dataupload.html'));
});

// Check if data exists in the collection
const checkDataExists = async (feeder, year, voltage, MW, date, time) => {
  const collectionName = `Feeder_${feeder}_Year_${year}`;
  const Model = getModel(collectionName);
  const exists = await Model.exists({ voltage, feeder, year, MW, date, time });
  return !!exists;
};

// Insert data into the correct collection
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

// Existing GET route to fetch data based on feeder and year
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

// NEW GET route to fetch data by feeder and date range
app.get('/data-by-date', async (req, res) => {
  const { feeder, fromDate, toDate } = req.query;

  // Validation
  if (!feeder || !fromDate || !toDate) {
    return res.status(400).json({ error: 'Missing required parameters: feeder, fromDate, toDate' });
  }

  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);

  if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
    return res.status(400).json({ error: 'Invalid date range' });
  }

  // Determine the years to query
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  try {
    // Query all relevant collections
    const results = [];
    for (const year of years) {
      const collectionName = `Feeder_${feeder}_Year_${year}`;
      const Model = getModel(collectionName);
      const data = await Model.find({
        date: {
          $gte: year === startYear ? fromDate : `${year}-01-01`,
          $lte: year === endYear ? toDate : `${year}-12-31`
        }
      });
      results.push(...data);
    }

    // Filter results to exact date range (in case collection spans outside range)
    const filteredResults = results.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    });

    res.json(filteredResults);
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