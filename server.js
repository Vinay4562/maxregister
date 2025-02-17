require('dotenv').config(); // Load environment variables

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // For session storage
const bcrypt = require('bcryptjs'); // Use bcryptjs for hashing
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }), // Use MongoDB to store sessions
  cookie: { secure: process.env.NODE_ENV === 'production' } // Set to true in production if using HTTPS
}));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
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

// Dummy credentials (hashed password)
const defaultUser = {
  username: 'Shankarpally400kv',
  passwordHash: bcrypt.hashSync('Shankarpally@9870', 10) // Replace with the actual password
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
    if (err) {
      return next(err);
    }
    res.clearCookie('connect.sid');
    res.redirect('/login.html');
  });
});

// GET route to check authentication
app.get('/check-auth', (req, res) => {
  res.json({ authenticated: req.session.authenticated || false });
});

// Middleware to check authentication
const ensureAuthenticated = (req, res, next) => {
  if (req.session.authenticated) {
    return next();
  }
  res.redirect('/login.html');
};

// Protected route for Dataupload.html
app.get('/dataupload', ensureAuthenticated, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'public', 'Dataupload.html'));
});

// Check if data exists
const checkDataExists = async (feeder, year, voltage, MW, date, time) => {
  const collectionName = `Feeder_${feeder}_Year_${year}`;
  const Model = getModel(collectionName);
  return await Model.exists({ voltage, feeder, year, MW, date, time });
};

// Insert data
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

app.post('/fetch-data', async (req, res) => {
  const { voltage, feeder, fromDate, toDate } = req.body;
  try {
    // Fetch data from database or source based on the provided parameters
    const data = await getData(voltage, feeder, fromDate, toDate);
    res.json(data); // Send back JSON response
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});


// GET route to fetch data
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

// DELETE route to remove data
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

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
