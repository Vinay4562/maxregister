require('dotenv').config(); // Load dotenv

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('connect-flash');
const cors = require('cors');
const path = require('path');
const { check, validationResult } = require('express-validator');

const app = express();

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'chantichanti2255',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using https
        maxAge: 1000 * 60 * 5 // Session expires after 5 minutes of inactivity
    }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash()); // Add this line to use flash messages
app.use(require('connect-flash')());
app.use(cors());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

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

// Mock user data (replace with database logic)
const users = [
  { id: 1, username: 'Shankarpally400kv', password: 'Shankarpally@9870' }
];

// Passport local strategy
passport.use(new LocalStrategy(
  (username, password, done) => {
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) {
          return done(null, false, { message: 'Incorrect username or password.' });
      }
      return done(null, user);
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.find(u => u.id === id);
  done(null, user);
});

// Cache Control to prevent accessing pages after logout
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

// Prevent direct access to Dataupload.html
app.get('/Dataupload.html', (req, res) => {
  res.status(404).send('Page Not Found'); // 404 for direct access
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

// Login route
app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard', // Redirect to /dashboard instead of /Dataupload.html
  failureRedirect: '/',
  failureFlash: true
}));

// Ensure the user is authenticated for Dataupload access
// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

// Serve dashboard route (displays Dataupload.html content)
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/Dataupload.html'); // Serve the content of Dataupload.html
});

// Logout route
app.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err); // Pass errors to the error handling middleware
    }
    req.session.destroy((err) => {
      if (err) {
        return next(err); // Pass errors to the error handling middleware
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      res.redirect('/'); // Redirect to login page
    });
  });
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
