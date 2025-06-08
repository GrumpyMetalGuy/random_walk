import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Create a mock instance of PrismaClient
export const prismaMock = mockDeep<PrismaClient>();

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
}));

// Reset all mocks before each test
beforeEach(() => {
  mockReset(prismaMock);
});

// Mock environment variables
process.env.DATABASE_URL = 'file:./test.db';
process.env.NODE_ENV = 'test'; 