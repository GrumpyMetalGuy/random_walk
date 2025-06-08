import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DataExportService {
  static async exportAllData() {
    try {
      const [places, settings, users] = await Promise.all([
        prisma.place.findMany(),
        prisma.setting.findMany(),
        prisma.user.findMany({
          select: {
            id: true,
            username: true,
            role: true,
            createdAt: true,
            lastLoginAt: true
          }
        })
      ]);

      return {
        exportDate: new Date().toISOString(),
        data: {
          places,
          settings,
          users
        },
        metadata: {
          totalPlaces: places.length,
          totalSettings: settings.length,
          totalUsers: users.length
        }
      };
    } catch (error) {
      throw new Error('Failed to export data');
    }
  }

  static async deleteAllUserData() {
    try {
      // Delete in order to maintain referential integrity
      const result = await prisma.$transaction(async (tx) => {
        const deletedUsers = await tx.user.deleteMany();
        return { deletedUsers: deletedUsers.count };
      });

      return result;
    } catch (error) {
      throw new Error('Failed to delete user data');
    }
  }

  static async deleteAllData() {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const deletedPlaces = await tx.place.deleteMany();
        const deletedSettings = await tx.setting.deleteMany();
        const deletedUsers = await tx.user.deleteMany();
        
        return {
          deletedPlaces: deletedPlaces.count,
          deletedSettings: deletedSettings.count,
          deletedUsers: deletedUsers.count
        };
      });

      return result;
    } catch (error) {
      throw new Error('Failed to delete all data');
    }
  }

  static async getDataSummary() {
    try {
      const [placesCount, settingsCount, usersCount] = await Promise.all([
        prisma.place.count(),
        prisma.setting.count(),
        prisma.user.count()
      ]);

      return {
        places: placesCount,
        settings: settingsCount,
        users: usersCount,
        totalRecords: placesCount + settingsCount + usersCount
      };
    } catch (error) {
      throw new Error('Failed to get data summary');
    }
  }
} 