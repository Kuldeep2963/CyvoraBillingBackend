const bcrypt = require('bcryptjs');
const User = require('./models/User');
const sequelize = require('./models/db');
require('dotenv').config();

const seedUser = async () => {
  try {
    await sequelize.sync();
    
    const username = 'admin';
    const password = 'adminpassword';
    
    // Check if user already exists
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      console.log('User already exists');
      process.exit(0);
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    await User.create({
      username,
      password: hashedPassword,
      role: 'admin'
    });
    
    console.log('Admin user seeded successfully');
    console.log('Username: admin');
    console.log('Password: adminpassword');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding user:', error);
    process.exit(1);
  }
};

seedUser();
