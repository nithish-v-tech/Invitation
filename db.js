const fs = require('fs');
const path = require('path');

const os = require('os');

let DATA_DIR = path.join(__dirname, 'data');
const isServerless = process.env.VERCEL || process.env.NOW_BUILDER || process.env.LAMBDA_TASK_ROOT;

if (isServerless) {
  DATA_DIR = path.join(os.tmpdir(), 'data');
}

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn(`Could not create directory at ${DATA_DIR}, falling back to temp root directly.`, err);
  DATA_DIR = os.tmpdir();
}

class JsonTable {
  constructor(tableName) {
    this.filePath = path.join(DATA_DIR, `${tableName}.json`);
    if (!fs.existsSync(this.filePath)) {
      try {
        fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf8');
      } catch (err) {
        console.error(`Error creating database file: ${this.filePath}`, err);
      }
    }
  }

  read() {
    try {
      const content = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(content || '[]');
    } catch (err) {
      console.error(`Error reading database file: ${this.filePath}`, err);
      return [];
    }
  }

  write(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error(`Error writing database file: ${this.filePath}`, err);
    }
  }

  find(filterFn) {
    const list = this.read();
    return filterFn ? list.filter(filterFn) : list;
  }

  findOne(filterFn) {
    const list = this.read();
    return list.find(filterFn);
  }

  insert(record) {
    const list = this.read();
    const newRecord = {
      id: Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36),
      created_at: new Date().toISOString(),
      ...record
    };
    list.push(newRecord);
    this.write(list);
    return newRecord;
  }

  update(id, updates) {
    const list = this.read();
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    list[index] = { ...list[index], ...updates };
    this.write(list);
    return list[index];
  }

  delete(id) {
    const list = this.read();
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return false;
    
    list.splice(index, 1);
    this.write(list);
    return true;
  }
}

module.exports = {
  Users: new JsonTable('users'),
  Invitations: new JsonTable('invitations'),
  GiftsGiven: new JsonTable('gifts_given'),
  GiftsReceived: new JsonTable('gifts_received'),
  Reminders: new JsonTable('reminders')
};
