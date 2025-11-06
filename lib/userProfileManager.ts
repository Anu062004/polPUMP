import { ethers } from 'ethers'

// Backend API configuration (same as existing system)
const BACKEND_URL = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'

async function backendFetch(input: string, init?: RequestInit & { timeoutMs?: number }) {
  const timeoutMs = init?.timeoutMs ?? 5000
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

export interface UserProfile {
  walletAddress: string
  username?: string
  bio?: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
  tokensCreated: TokenCreated[]
  tradingStats: TradingStats
  preferences: UserPreferences
}

export interface TokenCreated {
  tokenAddress: string
  tokenName: string
  tokenSymbol: string
  curveAddress?: string
  createdAt: string
  txHash: string
  imageUrl?: string
  description?: string
}

export interface TradingStats {
  totalTrades: number
  totalVolume: number // in MATIC
  tokensHeld: number
  favoriteTokens: string[]
  lastTradeAt?: string
}

export interface UserPreferences {
  theme: 'light' | 'dark'
  notifications: boolean
  publicProfile: boolean
  showTradingStats: boolean
}

export class UserProfileManager {
  private signer?: ethers.Signer

  constructor() {
    // No initialization needed - using backend proxy approach
  }

  /**
   * Initialize with user's wallet signer
   */
  async initialize(signer: ethers.Signer) {
    // Store signer for later use
    this.signer = signer
  }

  /**
   * Get user profile from backend (which uses storage)
   */
  async getProfile(walletAddress: string): Promise<UserProfile | null> {
    try {
      // Try backend first
      try {
        const response = await backendFetch(`${BACKEND_URL}/profile/${walletAddress}`, { timeoutMs: 4000 })
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.profile) return data.profile as UserProfile
        }
      } catch {}

      // Fallback to local Next.js API
      const localRes = await fetch(`/api/profile/${walletAddress}`, { cache: 'no-store' })
      if (localRes.ok) {
        const localData = await localRes.json()
        if (localData.success) return localData.profile as UserProfile | null
      }
      return null
    } catch (error) {
      console.error('Error getting user profile:', error)
      return null
    }
  }

  /**
   * Save user profile via backend (which uses storage)
   */
  async saveProfile(profile: UserProfile): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      // Update timestamp
      profile.updatedAt = new Date().toISOString()

      // Try backend first
      try {
        const response = await backendFetch(`${BACKEND_URL}/profile/${profile.walletAddress}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
          timeoutMs: 4000
        })
        if (response.ok) {
          const data = await response.json()
          if (data.success) return { success: true, txHash: data.txHash }
        }
      } catch {}

      // Fallback to local Next API
      const localRes = await fetch(`/api/profile/${profile.walletAddress}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      })
      const localData = await localRes.json()
      if (localRes.ok && localData.success) return { success: true }
      return { success: false, error: localData?.error || 'Failed to save profile' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Create new user profile
   */
  async createProfile(walletAddress: string, initialData?: Partial<UserProfile>): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    try {
      const now = new Date().toISOString()
      
      const profile: UserProfile = {
        walletAddress: walletAddress.toLowerCase(),
        username: initialData?.username || `User_${walletAddress.slice(0, 6)}`,
        bio: initialData?.bio || '',
        avatarUrl: initialData?.avatarUrl || '',
        createdAt: now,
        updatedAt: now,
        tokensCreated: initialData?.tokensCreated || [],
        tradingStats: initialData?.tradingStats || {
          totalTrades: 0,
          totalVolume: 0,
          tokensHeld: 0,
          favoriteTokens: []
        },
        preferences: initialData?.preferences || {
          theme: 'light',
          notifications: true,
          publicProfile: true,
          showTradingStats: true
        }
      }

      const result = await this.saveProfile(profile)
      if (result.success) {
        return { success: true, profile }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(walletAddress: string, updates: Partial<UserProfile>): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    try {
      // Get existing profile
      const existingProfile = await this.getProfile(walletAddress)
      
      if (!existingProfile) {
        // Create new profile if doesn't exist
        return await this.createProfile(walletAddress, updates)
      }

      // Merge updates
      const updatedProfile: UserProfile = {
        ...existingProfile,
        ...updates,
        walletAddress: walletAddress.toLowerCase(), // Ensure lowercase
        updatedAt: new Date().toISOString()
      }

      const result = await this.saveProfile(updatedProfile)
      if (result.success) {
        return { success: true, profile: updatedProfile }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Add token to user's created tokens list
   */
  async addCreatedToken(walletAddress: string, tokenData: TokenCreated): Promise<{ success: boolean; error?: string }> {
    try {
      let profile = await this.getProfile(walletAddress)
      
      if (!profile) {
        // Create profile first
        const createResult = await this.createProfile(walletAddress)
        if (!createResult.success) {
          return { success: false, error: createResult.error }
        }
        profile = createResult.profile!
      }

      // Add token to list (avoid duplicates)
      const existingTokenIndex = profile.tokensCreated.findIndex(
        t => t.tokenAddress.toLowerCase() === tokenData.tokenAddress.toLowerCase()
      )

      if (existingTokenIndex >= 0) {
        // Update existing token
        profile.tokensCreated[existingTokenIndex] = tokenData
      } else {
        // Add new token
        profile.tokensCreated.push(tokenData)
      }

      // Update profile
      const result = await this.updateProfile(walletAddress, { tokensCreated: profile.tokensCreated })
      return { success: result.success, error: result.error }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Update trading stats
   */
  async updateTradingStats(walletAddress: string, statsUpdate: Partial<TradingStats>): Promise<{ success: boolean; error?: string }> {
    try {
      const profile = await this.getProfile(walletAddress)
      
      if (!profile) {
        return { success: false, error: 'Profile not found' }
      }

      const updatedStats: TradingStats = {
        ...profile.tradingStats,
        ...statsUpdate,
        lastTradeAt: new Date().toISOString()
      }

      const result = await this.updateProfile(walletAddress, { tradingStats: updatedStats })
      return { success: result.success, error: result.error }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Upload avatar image via backend (which uses storage)
   */
  async uploadAvatar(imageFile: File, walletAddress: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const formData = new FormData()
      formData.append('avatar', imageFile)

      // Try backend first
      try {
        const response = await backendFetch(`${BACKEND_URL}/profile/${walletAddress}/avatar`, {
          method: 'POST',
          body: formData,
          timeoutMs: 4000
        })
        if (response.ok) {
          const data = await response.json()
          if (data.success) return { success: true, url: data.avatarUrl }
        }
      } catch {}

      // Fallback to local Next API
      const localRes = await fetch(`/api/profile/${walletAddress}/avatar`, { method: 'POST', body: formData })
      const localData = await localRes.json()
      if (localRes.ok && localData.success) return { success: true, url: localData.avatarUrl }
      return { success: false, error: localData?.error || 'Failed to upload avatar' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Get all profiles (for public directory - optional)
   */
  async getAllProfiles(): Promise<UserProfile[]> {
    try {
      // This would require a backend endpoint to list all profiles
      // For now, return empty array
      return []
    } catch (error) {
      console.error('Error getting all profiles:', error)
      return []
    }
  }

  /**
   * Delete user profile via backend
   */
  async deleteProfile(walletAddress: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Try backend first
      try {
        const response = await backendFetch(`${BACKEND_URL}/profile/${walletAddress}`, { method: 'DELETE', timeoutMs: 4000 })
        if (response.ok) {
          const data = await response.json()
          return { success: !!data.success, error: data.error }
        }
      } catch {}

      // Fallback to local
      const localRes = await fetch(`/api/profile/${walletAddress}`, { method: 'DELETE' })
      const localData = await localRes.json()
      return { success: !!localData.success, error: localData.error }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}

// Export singleton instance
export const userProfileManager = new UserProfileManager()
