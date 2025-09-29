import { db } from '../database/db'
import { logger } from '../utils/logger'
import type { AuthSession } from '../types/database'

export class TokenManager {
  async storeToken(token: string, expiresAt: Date): Promise<void> {
    // Clear existing tokens first
    await this.clearTokens()
    
    // Store new token
    db.run(
      'INSERT INTO auth_sessions (bearer_token, expires_at) VALUES (?, ?)',
      [token, expiresAt.toISOString()]
    )
    
    logger.info('Token stored successfully')
  }

  async getValidToken(): Promise<string | null> {
    const result = db.query<{ bearer_token: string }, []>(
      'SELECT bearer_token FROM auth_sessions WHERE expires_at > datetime("now") ORDER BY created_at DESC LIMIT 1'
    ).get()
    
    return result?.bearer_token || null
  }

  async refreshToken(): Promise<string | null> {
    // For now, return null to trigger re-authentication
    // In a real implementation, we'd attempt to refresh the token
    logger.warn('Token refresh not implemented, re-authentication required')
    return null
  }

  async clearTokens(): Promise<void> {
    db.run('DELETE FROM auth_sessions')
    logger.info('All tokens cleared')
  }

  async isTokenExpired(): Promise<boolean> {
    const token = await this.getValidToken()
    return !token
  }

  async getTokenExpiry(): Promise<Date | null> {
    const result = db.query<{ expires_at: string }, []>(
      'SELECT expires_at FROM auth_sessions ORDER BY created_at DESC LIMIT 1'
    ).get()
    
    return result?.expires_at ? new Date(result.expires_at) : null
  }
}


