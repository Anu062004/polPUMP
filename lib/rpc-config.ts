/**
 * Centralized RPC configuration for the POL Pump application
 */

export const RPC_CONFIG = {
  // Backend server RPC proxy (runs on port 4000)
  BACKEND_RPC: (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL)
    ? `${(process as any).env.NEXT_PUBLIC_BACKEND_URL}/api/rpc`
    : 'http://localhost:4000/api/rpc',
  
  // Direct Polygon Amoy testnet RPC (Infura)
  POLYGON_AMOY_RPC: process.env.NEXT_PUBLIC_EVM_RPC || process.env.POLYGON_AMOY_RPC || 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f',
  
  // Chain configuration
  CHAIN_ID: 80002,
  NETWORK: 'polygon-amoy-testnet',
  
  // Environment-specific configuration
  getRpcUrl: () => {
    // In development, prefer backend server to avoid CORS
    if (process.env.NODE_ENV === 'development') {
      return RPC_CONFIG.BACKEND_RPC;
    }
    
    // In production, can use direct RPC or backend proxy
    return process.env.USE_BACKEND_PROXY === 'true' 
      ? RPC_CONFIG.BACKEND_RPC 
      : RPC_CONFIG.POLYGON_AMOY_RPC;
  },
  
  // Check if backend server is available
  isBackendAvailable: async (): Promise<boolean> => {
    try {
      const response = await fetch(RPC_CONFIG.BACKEND_RPC, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }
};

export default RPC_CONFIG;
























