import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export class DatabaseService {
  private static prisma = new PrismaClient();
  private static readonly DB_PATH = '/app/data/randomwalk.db'; // Hardcoded - database always in volume

  /**
   * Initialize the database on application startup
   * This will create the database file, run migrations, and seed data if needed
   */
  static async initialize(): Promise<void> {
    console.log('🔍 Checking database status...');

    try {
      // Check if database file exists
      const dbExists = await this.databaseExists(this.DB_PATH);

      if (!dbExists) {
        console.log('📂 Database file not found, creating new database...');
        await this.createDatabase();
      } else {
        console.log('✅ Database file exists, checking schema and permissions...');
        // Fix permissions for existing database
        await this.fixDatabasePermissions(this.DB_PATH);
        await this.ensureSchemaUpToDate();
      }

      // Test the connection
      await this.testConnection();
      console.log('🎉 Database initialized successfully!');

    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if the database file exists
   */
  private static async databaseExists(dbPath: string): Promise<boolean> {
    try {
      await fs.access(dbPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a new database with migrations
   */
  private static async createDatabase(): Promise<void> {
    try {
      console.log('🚀 Running database migrations...');
      
      // Ensure data directory exists and has correct permissions
      const dataDir = path.dirname(this.DB_PATH);
      
      try {
        await fs.mkdir(dataDir, { recursive: true, mode: 0o755 });
        console.log(`📁 Created data directory: ${dataDir}`);
      } catch (error) {
        console.log(`📁 Data directory already exists: ${dataDir}`);
      }
      
      // Use Prisma migrate deploy for production-like behavior
      await execAsync('npx prisma migrate deploy', {
        cwd: process.cwd(),
        env: { ...process.env }
      });

      console.log('✅ Database migrations completed');
      
      // Fix database file permissions after creation
      await this.fixDatabasePermissions(this.DB_PATH);

      // Run seed script to populate initial data
      await this.seedDatabase();

    } catch (error) {
      console.error('Failed to create database:', error);
      throw error;
    }
  }

  /**
   * Fix database file permissions
   */
  private static async fixDatabasePermissions(dbPath: string): Promise<void> {
    try {
      // Check if we can write to the database file
      await fs.access(dbPath, fs.constants.W_OK);
      console.log('✅ Database file is already writable');
    } catch (error) {
      // Try to fix permissions if we can't write
      try {
        await fs.chmod(dbPath, 0o644);
        
        // Also fix journal file if it exists
        const journalPath = `${dbPath}-journal`;
        try {
          await fs.access(journalPath);
          await fs.chmod(journalPath, 0o644);
        } catch {
          // Journal file doesn't exist, which is fine
        }
        
        console.log('✅ Database file permissions fixed');
      } catch (chmodError) {
        console.warn('⚠️  Could not fix database permissions - this may cause write errors');
        console.warn('⚠️  Try: docker-compose down -v && docker-compose up');
        // Don't throw - let the application try to continue
      }
    }
  }

  /**
   * Ensure the database schema is up to date
   */
  private static async ensureSchemaUpToDate(): Promise<void> {
    try {
      // Check if migrations need to be applied
      const { stdout } = await execAsync('npx prisma migrate status', {
        cwd: process.cwd(),
        env: { ...process.env }
      });

      if (stdout.includes('migrations have not yet been applied')) {
        console.log('🔄 Applying pending migrations...');
        await execAsync('npx prisma migrate deploy', {
          cwd: process.cwd(),
          env: { ...process.env }
        });
        console.log('✅ Migrations applied successfully');
      } else {
        console.log('✅ Database schema is up to date');
      }
    } catch (error) {
      console.warn('⚠️  Could not check migration status, assuming database is ready:', error);
      // Don't throw here - the database might be ready even if we can't check status
    }
  }

  /**
   * Seed the database with initial data
   */
  private static async seedDatabase(): Promise<void> {
    try {
      console.log('🌱 Seeding database with initial data...');
      
      await execAsync('npx prisma db seed', {
        cwd: process.cwd(),
        env: { ...process.env }
      });

      console.log('✅ Database seeded successfully');
    } catch (error) {
      console.warn('⚠️  Database seeding failed (this is non-critical):', error);
      // Don't throw here - seeding failure shouldn't prevent app startup
    }
  }

  /**
   * Test the database connection
   */
  private static async testConnection(): Promise<void> {
    try {
      // Simple query to test connection
      await this.prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database connection test passed');
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      throw error;
    }
  }

  /**
   * Gracefully disconnect from the database
   */
  static async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
} 