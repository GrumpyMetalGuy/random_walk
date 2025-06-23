import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Centralized rate limiter for Nominatim API (max 1 request per second)
class NominatimRateLimiter {
  private lastRequestTime = 0;
  private readonly minIntervalMs = 1100; // Fixed minimum of 1.1 seconds
  private readonly defaultVariationMs = 500; // Default 0.5 second variation
  
  // Generate random interval between 1.1s and (1.1s + variation)
  private async getRandomInterval(): Promise<number> {
    try {
      // Get variation setting from database
      const variationSetting = await prisma.setting.findFirst({
        where: { key: 'nominatim_rate_variation_ms' }
      });
      
      const variationMs = variationSetting?.value 
        ? parseInt(variationSetting.value) 
        : this.defaultVariationMs;
      
      // Ensure variation is reasonable (between 0 and 5 seconds)
      const clampedVariation = Math.max(0, Math.min(5000, variationMs));
      
      return Math.random() * clampedVariation + this.minIntervalMs;
    } catch (error) {
      console.error('Failed to get Nominatim rate variation setting, using default:', error);
      return Math.random() * this.defaultVariationMs + this.minIntervalMs;
    }
  }

  async waitForNextRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = await this.getRandomInterval();
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      console.log(`Rate limiting: waiting ${Math.round(waitTime)}ms before next Nominatim request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}

// Export a singleton instance
export const nominatimRateLimiter = new NominatimRateLimiter(); 