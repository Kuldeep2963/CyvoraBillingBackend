const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const EmailService = require('../services/EmailService');

router.use((req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['hashedpassword'] }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create user (admin only)
router.post('/', async (req, res) => {
  try {
    const { email, password, role, first_name, last_name, phone } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'Email, password, first name, and last name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const assignedRole = typeof role === 'string' && role.trim()
      ? role.trim().toLowerCase()
      : 'user';

    const user = await User.create({
      email: normalizedEmail,
      hashedpassword: hashedPassword,
      role: assignedRole,
      first_name,
      last_name,
      phone,
    });

    try {
      await EmailService.sendWelcomeEmail(user, password);
      console.log('Welcome email sent to:', normalizedEmail);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByPk(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await user.destroy();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
