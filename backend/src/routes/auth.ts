import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional()
});

const registerSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50, 'Username too long'),
  password: z.string().min(20, 'Password must be at least 20 characters'),
  role: z.enum(['ADMIN', 'USER']).optional().default('USER')
});

const updateUserSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50, 'Username too long').optional(),
  password: z.string().min(20, 'Password must be at least 20 characters').optional(),
  role: z.enum(['ADMIN', 'USER']).optional()
});

const setupSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(20, 'Password must be at least 20 characters long'),
  distanceUnit: z.enum(['miles', 'kilometers']).optional().default('miles'),
  searchRanges: z.array(z.number().min(1).max(200)).optional().default([5, 10, 15, 20, 40])
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
    
    const { username, password, distanceUnit, searchRanges } = setupSchema.parse(req.body);
    
    const user = await AuthService.createUser(username, password, 'ADMIN');
    
    // Store the distance unit preference in settings
    await prisma.setting.upsert({
      where: { key: 'distance_unit' },
      update: { value: distanceUnit },
      create: { key: 'distance_unit', value: distanceUnit }
    });

    // Store the search ranges in settings
    const sortedRanges = [...searchRanges].sort((a, b) => a - b);
    await prisma.setting.upsert({
      where: { key: 'search_ranges' },
      update: { value: JSON.stringify(sortedRanges) },
      create: { key: 'search_ranges', value: JSON.stringify(sortedRanges) }
    });
    
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

// GET /api/auth/users - Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const users = await AuthService.getAllUsers();
    res.json({
      success: true,
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get users'
    });
  }
});

// PUT /api/auth/users/:id - Update user (admin only)
router.put('/users/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    const updateData = updateUserSchema.parse(req.body);
    
    // Prevent admins from demoting themselves
    if (req.user?.userId === userId && updateData.role === 'USER') {
      return res.status(400).json({
        success: false,
        error: 'Cannot change your own role from ADMIN to USER'
      });
    }
    
    const updatedUser = await AuthService.updateUser(userId, updateData);
    
    res.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update user'
    });
  }
});

// DELETE /api/auth/users/:id - Delete user (admin only)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    // Prevent admins from deleting themselves
    if (req.user?.userId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    await AuthService.deleteUser(userId);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete user'
    });
  }
});

export default router; 