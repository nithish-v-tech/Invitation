const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Tesseract = require('tesseract.js');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'invitation-secret-key-12345';

// Middlewares
app.use(cors());
app.use(express.json());

// Ensure upload directory exists
const isServerless = process.env.VERCEL || process.env.NOW_BUILDER || process.env.LAMBDA_TASK_ROOT;
const UPLOADS_DIR = isServerless ? path.join(require('os').tmpdir(), 'uploads') : path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.warn(`Could not create uploads directory at ${UPLOADS_DIR}`, err);
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Helper to authenticate user from token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Autocreate reminders function
const updateReminderForInvitation = (invitation) => {
  if (!invitation.date) return;
  
  // Calculate reminder date (2 days before)
  const funcDate = new Date(invitation.date);
  if (isNaN(funcDate.getTime())) return;

  const reminderDate = new Date(funcDate);
  reminderDate.setDate(funcDate.getDate() - 2);

  // Formatting date to YYYY-MM-DD
  const reminderDateStr = reminderDate.toISOString().split('T')[0];

  // Check if reminder already exists
  const existing = db.Reminders.findOne(r => r.invitation_id === invitation.id);

  const reminderMessage = `Reminder: You have a ${invitation.function_name || 'Function'} on ${invitation.date} at ${invitation.venue || 'the Venue'}.`;

  if (existing) {
    db.Reminders.update(existing.id, {
      reminder_date: reminderDateStr,
      reminder_message: reminderMessage,
      status: 'pending'
    });
  } else {
    db.Reminders.insert({
      user_id: invitation.user_id,
      invitation_id: invitation.id,
      reminder_date: reminderDateStr,
      reminder_message: reminderMessage,
      status: 'pending'
    });
  }
};

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/register', (req, res) => {
  const { name, email, mobile, password, confirmPassword } = req.body;

  if (!name || !email || !mobile || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  // Check if user exists
  const existingUser = db.Users.findOne(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  // Hash password
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  const newUser = db.Users.insert({
    name,
    email: email.toLowerCase(),
    mobile,
    password: hashedPassword
  });

  res.status(201).json({ message: 'Registration successful', userId: newUser.id });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.Users.findOne(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, mobile: user.mobile } });
});

// ==========================================
// 2. INVITATION ROUTES
// ==========================================

app.get('/api/invitations', authenticateToken, (req, res) => {
  const list = db.Invitations.find(inv => inv.user_id === req.user.id);
  res.json(list);
});

app.post('/api/invitations', authenticateToken, upload.single('invitation_image'), (req, res) => {
  const {
    person_name,
    function_name,
    function_type,
    date,
    time,
    venue,
    address,
    latitude,
    longitude,
    ocr_text,
    notes
  } = req.body;

  const invitation_image = req.file ? `/uploads/${req.file.filename}` : '';

  const newInvitation = db.Invitations.insert({
    user_id: req.user.id,
    person_name: person_name || '',
    function_name: function_name || '',
    function_type: function_type || 'Other',
    date: date || '',
    time: time || '',
    venue: venue || '',
    address: address || '',
    latitude: latitude ? parseFloat(latitude) : null,
    longitude: longitude ? parseFloat(longitude) : null,
    ocr_text: ocr_text || '',
    invitation_image,
    notes: notes || ''
  });

  updateReminderForInvitation(newInvitation);

  res.status(201).json(newInvitation);
});

app.put('/api/invitations/:id', authenticateToken, upload.single('invitation_image'), (req, res) => {
  const invitation = db.Invitations.findOne(inv => inv.id === req.params.id && inv.user_id === req.user.id);
  if (!invitation) return res.status(404).json({ error: 'Invitation not found' });

  const {
    person_name,
    function_name,
    function_type,
    date,
    time,
    venue,
    address,
    latitude,
    longitude,
    ocr_text,
    notes
  } = req.body;

  const updates = {
    person_name: person_name !== undefined ? person_name : invitation.person_name,
    function_name: function_name !== undefined ? function_name : invitation.function_name,
    function_type: function_type !== undefined ? function_type : invitation.function_type,
    date: date !== undefined ? date : invitation.date,
    time: time !== undefined ? time : invitation.time,
    venue: venue !== undefined ? venue : invitation.venue,
    address: address !== undefined ? address : invitation.address,
    latitude: latitude !== undefined ? (latitude ? parseFloat(latitude) : null) : invitation.latitude,
    longitude: longitude !== undefined ? (longitude ? parseFloat(longitude) : null) : invitation.longitude,
    ocr_text: ocr_text !== undefined ? ocr_text : invitation.ocr_text,
    notes: notes !== undefined ? notes : invitation.notes
  };

  if (req.file) {
    updates.invitation_image = `/uploads/${req.file.filename}`;
  }

  const updatedInvitation = db.Invitations.update(req.params.id, updates);
  updateReminderForInvitation(updatedInvitation);

  res.json(updatedInvitation);
});

app.delete('/api/invitations/:id', authenticateToken, (req, res) => {
  const invitation = db.Invitations.findOne(inv => inv.id === req.params.id && inv.user_id === req.user.id);
  if (!invitation) return res.status(404).json({ error: 'Invitation not found' });

  db.Invitations.delete(req.params.id);

  // Also clean up reminders
  const reminders = db.Reminders.find(r => r.invitation_id === req.params.id);
  reminders.forEach(r => db.Reminders.delete(r.id));

  res.json({ message: 'Invitation and its reminders deleted successfully' });
});

// ==========================================
// 3. GIFTS GIVEN ROUTES
// ==========================================

app.get('/api/gifts/given', authenticateToken, (req, res) => {
  const list = db.GiftsGiven.find(g => g.user_id === req.user.id);
  res.json(list);
});

app.post('/api/gifts/given', authenticateToken, (req, res) => {
  const { person_name, function_name, function_type, date, gift_type, amount, gift_description, notes } = req.body;
  if (!person_name || !gift_type || !date) {
    return res.status(400).json({ error: 'Person, Gift Type, and Date are required' });
  }

  const record = db.GiftsGiven.insert({
    user_id: req.user.id,
    person_name,
    function_name: function_name || '',
    function_type: function_type || 'Other',
    date,
    gift_type,
    amount: gift_type === 'Amount' ? parseFloat(amount || 0) : null,
    gift_description: gift_description || '',
    notes: notes || ''
  });
  res.status(201).json(record);
});

app.put('/api/gifts/given/:id', authenticateToken, (req, res) => {
  const gift = db.GiftsGiven.findOne(g => g.id === req.params.id && g.user_id === req.user.id);
  if (!gift) return res.status(404).json({ error: 'Gift record not found' });

  const { person_name, function_name, function_type, date, gift_type, amount, gift_description, notes } = req.body;

  const updates = {
    person_name: person_name !== undefined ? person_name : gift.person_name,
    function_name: function_name !== undefined ? function_name : gift.function_name,
    function_type: function_type !== undefined ? function_type : gift.function_type,
    date: date !== undefined ? date : gift.date,
    gift_type: gift_type !== undefined ? gift_type : gift.gift_type,
    amount: gift_type === 'Amount' ? parseFloat(amount || 0) : null,
    gift_description: gift_description !== undefined ? gift_description : gift.gift_description,
    notes: notes !== undefined ? notes : gift.notes
  };

  const updatedGift = db.GiftsGiven.update(req.params.id, updates);
  res.json(updatedGift);
});

app.delete('/api/gifts/given/:id', authenticateToken, (req, res) => {
  const gift = db.GiftsGiven.findOne(g => g.id === req.params.id && g.user_id === req.user.id);
  if (!gift) return res.status(404).json({ error: 'Gift record not found' });

  db.GiftsGiven.delete(req.params.id);
  res.json({ message: 'Gift record deleted successfully' });
});

// ==========================================
// 4. GIFTS RECEIVED ROUTES
// ==========================================

app.get('/api/gifts/received', authenticateToken, (req, res) => {
  const list = db.GiftsReceived.find(g => g.user_id === req.user.id);
  res.json(list);
});

app.post('/api/gifts/received', authenticateToken, (req, res) => {
  const { person_name, function_name, function_type, date, gift_type, amount, gift_description, notes } = req.body;
  if (!person_name || !gift_type || !date) {
    return res.status(400).json({ error: 'Person, Gift Type, and Date are required' });
  }

  const record = db.GiftsReceived.insert({
    user_id: req.user.id,
    person_name,
    function_name: function_name || '',
    function_type: function_type || 'Other',
    date,
    gift_type,
    amount: gift_type === 'Amount' ? parseFloat(amount || 0) : null,
    gift_description: gift_description || '',
    notes: notes || ''
  });
  res.status(201).json(record);
});

app.put('/api/gifts/received/:id', authenticateToken, (req, res) => {
  const gift = db.GiftsReceived.findOne(g => g.id === req.params.id && g.user_id === req.user.id);
  if (!gift) return res.status(404).json({ error: 'Gift record not found' });

  const { person_name, function_name, function_type, date, gift_type, amount, gift_description, notes } = req.body;

  const updates = {
    person_name: person_name !== undefined ? person_name : gift.person_name,
    function_name: function_name !== undefined ? function_name : gift.function_name,
    function_type: function_type !== undefined ? function_type : gift.function_type,
    date: date !== undefined ? date : gift.date,
    gift_type: gift_type !== undefined ? gift_type : gift.gift_type,
    amount: gift_type === 'Amount' ? parseFloat(amount || 0) : null,
    gift_description: gift_description !== undefined ? gift_description : gift.gift_description,
    notes: notes !== undefined ? notes : gift.notes
  };

  const updatedGift = db.GiftsReceived.update(req.params.id, updates);
  res.json(updatedGift);
});

app.delete('/api/gifts/received/:id', authenticateToken, (req, res) => {
  const gift = db.GiftsReceived.findOne(g => g.id === req.params.id && g.user_id === req.user.id);
  if (!gift) return res.status(404).json({ error: 'Gift record not found' });

  db.GiftsReceived.delete(req.params.id);
  res.json({ message: 'Gift record deleted successfully' });
});

// ==========================================
// 5. REMINDERS ROUTES
// ==========================================

app.get('/api/reminders', authenticateToken, (req, res) => {
  const list = db.Reminders.find(r => r.user_id === req.user.id);
  res.json(list);
});

app.post('/api/reminders/:id/dismiss', authenticateToken, (req, res) => {
  const r = db.Reminders.findOne(rem => rem.id === req.params.id && rem.user_id === req.user.id);
  if (!r) return res.status(404).json({ error: 'Reminder not found' });

  db.Reminders.update(r.id, { status: 'dismissed' });
  res.json({ message: 'Reminder dismissed' });
});

// ==========================================
// 6. OCR / SCAN INVITATION ROUTE
// ==========================================

app.post('/api/scan', authenticateToken, upload.single('invitation_image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  try {
    const imagePath = req.file.path;
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');

    // Parse extracted text to extract information
    const extractedData = {
      ocr_text: text,
      person_name: '',
      function_name: '',
      function_type: 'Other',
      date: '',
      time: '',
      venue: '',
      address: '',
      image_url: `/uploads/${req.file.filename}`
    };

    const textLower = text.toLowerCase();

    // 1. Identify category & Function name
    const categories = [
      { name: 'Wedding', keywords: ['wedding', 'marriage', 'nuptial', 'matrimony', 'tying the knot', 'tie the knot', 'vivaha'] },
      { name: 'Engagement', keywords: ['engagement', 'ring ceremony', 'betrothal'] },
      { name: 'Ear Piercing Function', keywords: ['ear piercing', 'ear-piercing', 'karnavedha'] },
      { name: 'Birthday', keywords: ['birthday', 'happy birthday', 'celebrating years'] },
      { name: 'Housewarming', keywords: ['housewarming', 'house warming', 'grihapravesh', 'grhapravesa', 'home entering'] },
      { name: 'Reception', keywords: ['reception', 'grand reception', 'marriage reception'] },
      { name: 'Baby Shower', keywords: ['baby shower', 'seemantham', 'valaikappu', 'godh bharai'] },
      { name: 'Anniversary', keywords: ['anniversary', 'wedding anniversary'] },
      { name: 'Religious Function', keywords: ['religious', 'pooja', 'puja', 'havan', 'homam', 'prayer', 'bhajan'] },
      { name: 'Puberty Ceremony', keywords: ['puberty ceremony', 'puberty function', 'manjal neerattu vizha', 'half saree ceremony'] }
    ];

    let foundType = null;
    for (const cat of categories) {
      if (cat.keywords.some(keyword => textLower.includes(keyword))) {
        foundType = cat.name;
        break;
      }
    }
    extractedData.function_type = foundType || 'Other';

    // Set a generic function name if keyword found
    if (foundType) {
      extractedData.function_name = foundType;
    } else {
      extractedData.function_name = 'Special Event';
    }

    // 2. Try parsing Date (e.g. YYYY-MM-DD or readable months)
    // Matches patterns like "August 30, 2026" or "30-08-2026" or "30/08/2026"
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    let detectedDate = '';

    // Check simple regex matches
    const dateRegex1 = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/; // 30-08-2026 or 30/08/2026
    const dateRegex2 = /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/; // 2026-08-30 or 2026/08/30
    
    let match1 = textLower.match(dateRegex1);
    if (match1) {
      let day = match1[1].padStart(2, '0');
      let month = match1[2].padStart(2, '0');
      let year = match1[3];
      detectedDate = `${year}-${month}-${day}`;
    } else {
      let match2 = textLower.match(dateRegex2);
      if (match2) {
        detectedDate = `${match2[1]}-${match2[2].padStart(2, '0')}-${match2[3].padStart(2, '0')}`;
      } else {
        // Look for month word followed/preceded by numbers
        for (const month of months) {
          const monthRegex = new RegExp(`\\b(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s+${month}\\s+(\\d{4})\\b`, 'i');
          const m = text.match(monthRegex);
          if (m) {
            const parsedD = new Date(`${m[1]} ${month} ${m[2]}`);
            if (!isNaN(parsedD.getTime())) {
              detectedDate = parsedD.toISOString().split('T')[0];
              break;
            }
          }
        }
      }
    }
    extractedData.date = detectedDate;

    // 3. Try parsing Time (e.g. 10:30 AM, 6:00 PM)
    const timeRegex = /\b(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM))\b/;
    const timeMatch = text.match(timeRegex);
    if (timeMatch) {
      extractedData.time = timeMatch[1];
    } else {
      const genericTimeRegex = /\b(\d{1,2}\s*(?:am|pm|AM|PM))\b/;
      const genTimeMatch = text.match(genericTimeRegex);
      if (genTimeMatch) {
        extractedData.time = genTimeMatch[1];
      }
    }

    // 4. Try parsing Venue / Location (e.g. Venue: XXX, at YYY, Hall)
    const venueRegex = /(?:venue|location|at|place|hall|palace|residence)\s*:?\s*([^\n,.]+)/i;
    const venueMatch = text.match(venueRegex);
    if (venueMatch && venueMatch[1]) {
      extractedData.venue = venueMatch[1].trim();
      extractedData.address = venueMatch[1].trim();
    }

    // 5. Try parsing Person/Family (e.g. Family of X, invites of Y)
    const familyRegex = /(?:invitations|cordially invites|family of|marriage of|wedding of|celebrating)\s+([A-Za-z\s]{3,25})/i;
    const familyMatch = text.match(familyRegex);
    if (familyMatch && familyMatch[1]) {
      extractedData.person_name = familyMatch[1].replace(/(?:you|your|family|friends|relation|and|the)/gi, '').trim();
    }

    res.json({ message: 'Scan successful', data: extractedData });
  } catch (error) {
    console.error('OCR scanning error:', error);
    res.status(500).json({ error: 'Failed to process invitation image' });
  }
});

// ==========================================
// 7. GEOCODING PROXY ROUTE (Nominatim)
// ==========================================

app.get('/api/geocode', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

  try {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    
    // First attempt: Nominatim OSM
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          return res.json({
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon),
            display_name: data[0].display_name
          });
        }
      }
    } catch (e) {
      console.warn('Nominatim error, trying Photon fallback:', e.message);
    }

    // Second attempt fallback: Photon OSM Geocoder
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`;
    const photonRes = await fetch(photonUrl);
    if (photonRes.ok) {
      const photonData = await photonRes.json();
      if (photonData.features && photonData.features.length > 0) {
        const feat = photonData.features[0];
        const [lon, lat] = feat.geometry.coordinates;
        const name = [feat.properties.name, feat.properties.street, feat.properties.city, feat.properties.state, feat.properties.country].filter(Boolean).join(', ');
        return res.json({
          lat,
          lon,
          display_name: name || q
        });
      }
    }

    res.status(404).json({ error: 'Address not found' });
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: 'Geocoding service unavailable' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});
