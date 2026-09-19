const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
      const key = line.substring(0, eqIdx).trim();
      const value = line.substring(eqIdx + 1).trim();
      if (key && !key.startsWith('#')) {
        process.env[key] = value;
      }
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI;

const MenuItemSchema = new mongoose.Schema({
  name: String,
  category: String,
  price: Number,
  specialPrice: Number,
  isActive: Boolean,
});
const MenuItem = mongoose.models.MenuItem || mongoose.model('MenuItem', MenuItemSchema);

async function run() {
  console.log("Connecting to:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log("Connected!");
  const items = await MenuItem.find();
  console.log("MenuItems in DB:");
  console.log(JSON.stringify(items, null, 2));
  await mongoose.disconnect();
}

run().catch(console.error);
