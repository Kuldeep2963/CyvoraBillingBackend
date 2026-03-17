const bcrypt = require('bcryptjs');
const User = require('./models/User');
const sequelize = require('./models/db');
require('dotenv').config();

const seedUser = async () => {
  try {
    // Drop and sync the table
    await sequelize.sync({ force: true });
    
    const email = 'anuj@paitelecomm.com';
    const password = 'pai@8#TEst3489';
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    await User.create({
      email,
      hashedpassword: hashedPassword,
      role: 'admin',
      first_name: 'Anuj',
      last_name: 'Sharma'
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding user:', error);
    process.exit(1);
  }
};

seedUser();
