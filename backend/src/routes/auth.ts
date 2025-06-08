import express from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';

const router = express.Router();

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional()
});

const registerSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50, 'Username too long'),
  password: z.string().min(20, 'Password must be at least 20 characters'),
  role: z.enum(['ADMIN', 'USER']).optional()
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password, rememberMe } = loginSchema.parse(req.body);
    
    const result = await AuthService.authenticateUser(username, password);
    
    // Set HTTP-only cookie for remember me functionality
    if (rememberMe) {
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }
    
    res.json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    });
  }
});

// POST /api/auth/register
router.post('/register', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { username, password, role = 'USER' } = registerSchema.parse(req.body);
    
    const user = await AuthService.createUser(username, password, role);
    
    res.status(201).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    });
  }
});

// POST /api/auth/setup (for initial admin creation)
router.post('/setup', async (req, res) => {
  try {
    const userCount = await AuthService.getUserCount();
    
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Setup already completed'
      });
    }
    
    const { username, password } = registerSchema.parse(req.body);
    
    const user = await AuthService.createUser(username, password, 'ADMIN');
    
    res.status(201).json({
      success: true,
      user,
      message: 'Initial admin user created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Setup failed'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const user = await AuthService.getUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get user info'
    });
  }
});

// GET /api/auth/setup-required
router.get('/setup-required', async (req, res) => {
  try {
    const userCount = await AuthService.getUserCount();
    res.json({
      setupRequired: userCount === 0
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check setup status'
    });
  }
});

export default router; 