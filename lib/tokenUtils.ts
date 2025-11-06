/**
 * Utility functions for token management and trading status
 */

import { CONTRACT_CONFIG } from './contract-config'

export interface TokenTradingStatus {
  isTradable: boolean
  isLegacy: boolean
  hasCurve: boolean
  curveAddress?: string
  factoryAddress?: string
}

/**
 * Check if a token supports trading (has bonding curve)
 */
export function getTokenTradingStatus(token: {
  curveAddress?: string | null
  tokenAddress?: string | null
  createdAt?: string | Date
  txHash?: string | null
}): TokenTradingStatus {
  const hasCurve = !!(token.curveAddress && token.curveAddress !== 'undefined' && token.curveAddress !== '')
  const hasFactory = !!(token.tokenAddress && token.tokenAddress !== 'undefined' && token.tokenAddress !== '')
  
  return {
    isTradable: hasCurve && hasFactory,
    isLegacy: !hasCurve,
    hasCurve,
    curveAddress: hasCurve ? token.curveAddress || undefined : undefined,
    factoryAddress: CONTRACT_CONFIG.FACTORY_ADDRESS
  }
}

/**
 * Check if token was created with the new factory (supports trading)
 */
export function isNewToken(token: {
  curveAddress?: string | null
  createdAt?: string | Date
}): boolean {
  return !!(token.curveAddress && token.curveAddress !== 'undefined' && token.curveAddress !== '')
}

/**
 * Format token address for display
 */
export function formatTokenAddress(address: string | null | undefined): string {
  if (!address || address === 'undefined') return 'N/A'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Get PolygonScan explorer URL for address
 */
export function getPolygonScanUrl(address: string, type: 'address' | 'tx' = 'address'): string {
  return `https://amoy.polygonscan.com/${type}/${address}`
}

