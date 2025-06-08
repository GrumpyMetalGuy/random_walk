import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '30d'; // 1 month

export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      return false;
    }
  }

  static validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 20) {
      return { valid: false, message: 'Password must be at least 20 characters long' };
    }
    return { valid: true };
  }

  static generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'random-walk',
      audience: 'random-walk-users',
    });
  }

  static verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'random-walk',
        audience: 'random-walk-users',
      }) as TokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  static async createUser(username: string, password: string, role: 'ADMIN' | 'USER' = 'USER') {
    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      throw new Error('Username already exists');
    }

    const passwordHash = await this.hashPassword(password);

    return await prisma.user.create({
      data: {
        username,
        passwordHash,
        role
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        lastLoginAt: true
      }
    });
  }

  static async authenticateUser(username: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new Error('Invalid username or password');
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    const token = this.generateToken(tokenPayload);

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: new Date()
      },
      token
    };
  }

  static async getUserCount(): Promise<number> {
    return await prisma.user.count();
  }

  static async getUserById(id: number) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        lastLoginAt: true
      }
    });
  }
} 