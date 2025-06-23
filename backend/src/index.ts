import { app } from './app.js';
import { DatabaseService } from './services/database.js';

const port = 4000; // Hardcoded - users should use Docker port mapping to change external port

async function startServer() {
  try {
    // Initialize database before starting the server
    await DatabaseService.initialize();

    // Bind to all interfaces (0.0.0.0) for Docker compatibility
    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Server running at http://localhost:${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await DatabaseService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await DatabaseService.disconnect();
  process.exit(0);
});

// Start the server
startServer(); 