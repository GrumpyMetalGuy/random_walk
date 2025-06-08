import express from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { DataExportService } from '../services/dataExport.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/data/summary
router.get('/data/summary', async (req: AuthenticatedRequest, res) => {
  try {
    const summary = await DataExportService.getDataSummary();
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get data summary'
    });
  }
});

// GET /api/admin/data/export
router.get('/data/export', async (req: AuthenticatedRequest, res) => {
  try {
    const exportData = await DataExportService.exportAllData();
    
    const filename = `random-walk-export-${new Date().toISOString().split('T')[0]}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.json(exportData);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export data'
    });
  }
});

// DELETE /api/admin/data/users
router.delete('/data/users', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await DataExportService.deleteAllUserData();
    res.json({
      success: true,
      message: 'All user data deleted successfully',
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete user data'
    });
  }
});

// DELETE /api/admin/data/all
router.delete('/data/all', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await DataExportService.deleteAllData();
    res.json({
      success: true,
      message: 'All data deleted successfully',
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete all data'
    });
  }
});

export default router; 