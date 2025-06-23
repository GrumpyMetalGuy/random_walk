import { Router } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { z } from 'zod';
import {
  getSearchCategories,
  updateSearchCategories,
  addSearchCategory,
  removeSearchCategory,
  toggleSearchCategory,
  CategoryConfig
} from '../services/categoryConfig.js';

const router = Router();

// Validation schemas
const categorySchema = z.object({
  type: z.string().min(1, 'Type is required'),
  filters: z.array(z.string()),
  enabled: z.boolean()
});

const updateCategoriesSchema = z.array(categorySchema);

// GET /api/categories - Get all search categories
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const categories = await getSearchCategories();
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get search categories'
    });
  }
});

// PUT /api/categories - Update all search categories (admin only)
router.put('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const categories = updateCategoriesSchema.parse(req.body);
    
    await updateSearchCategories(categories);
    
    res.json({
      success: true,
      message: 'Search categories updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update search categories'
    });
  }
});

// POST /api/categories - Add a new search category (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const category = categorySchema.parse(req.body);
    
    await addSearchCategory(category);
    
    res.status(201).json({
      success: true,
      message: 'Search category added successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to add search category'
    });
  }
});

// DELETE /api/categories/:type - Remove a search category (admin only)
router.delete('/:type', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { type } = req.params;
    
    await removeSearchCategory(type);
    
    res.json({
      success: true,
      message: 'Search category removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to remove search category'
    });
  }
});

// PATCH /api/categories/:type/toggle - Toggle a search category (admin only)
router.patch('/:type/toggle', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { type } = req.params;
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    
    await toggleSearchCategory(type, enabled);
    
    res.json({
      success: true,
      message: `Search category ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid toggle data'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to toggle search category'
    });
  }
});

export default router; 