export interface CoinData {
  id: string;
  name: string;
  symbol: string;
  supply: string;
  description: string;
  imageUrl: string;
  metadataUrl?: string;
  imageRootHash?: string;
  metadataRootHash?: string;
  createdAt: string;
  creator: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  change24h?: number;
}

export interface StorageConfig {
  evmRpc: string;
  indexerRpc: string;
  privateKey: string;
  segmentNumber?: number;
  expectedReplicas?: number;
  backendUrl?: string;
}

class PolStorageSDK {
  private config: StorageConfig;
  private web3Provider: any;
  private indexerClient: any;
  private backendUrl: string;
  private storageKey = 'pol_coins_data';

  constructor(config: StorageConfig) {
    this.config = {
      segmentNumber: 1,
      expectedReplicas: 3,
      backendUrl: (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000',
      ...config
    };
    this.backendUrl = this.config.backendUrl!;
  }

  async initialize(): Promise<void> {
    const { ethers } = await import('ethers');
    this.web3Provider = new ethers.JsonRpcProvider(this.config.evmRpc);
    this.indexerClient = {
      selectNodes: async () => [
        { id: 'node1', endpoint: 'https://storage-node-1.pol' },
        { id: 'node2', endpoint: 'https://storage-node-2.pol' },
        { id: 'node3', endpoint: 'https://storage-node-3.pol' }
      ]
    };
    console.log('✅ Storage SDK initialized successfully');
    console.log(`🌐 Backend URL: ${this.backendUrl}`);
  }

  async calculateFileHash(data: string): Promise<string> {
    const { ethers } = await import('ethers');
    return ethers.keccak256(ethers.toUtf8Bytes(data));
  }

  async uploadData(
    data: any,
    metadata?: any,
    options?: { quiet?: boolean }
  ): Promise<{ txHash: string; rootHash: string }> {
    if (!this.web3Provider) throw new Error('SDK not initialized. Call initialize() first.');
    const isDev = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NODE_ENV) !== 'production'
    const uploadsEnabled = ((typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_ENABLE_0G_UPLOADS) ?? (isDev ? 'false' : 'true')) === 'true'
    const dataString = JSON.stringify(data);
    const rootHash = await this.calculateFileHash(dataString);
    if (!uploadsEnabled) return { txHash: rootHash, rootHash };
    const response = await fetch(`${this.backendUrl}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dataString, metadata: metadata || {} })
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
    const result = await response.json();
    return { txHash: result.rootHash, rootHash: result.rootHash };
  }

  async createCoin(coinData: {
    name: string;
    symbol: string;
    description: string;
    supply: string;
    creator: string;
    imageFile?: File;
  }): Promise<CoinData> {
    const formData = new FormData();
    formData.append('name', coinData.name);
    formData.append('symbol', coinData.symbol);
    formData.append('description', coinData.description);
    formData.append('supply', coinData.supply);
    formData.append('creator', coinData.creator);
    if (coinData.imageFile) formData.append('image', coinData.imageFile);
    const response = await fetch(`${this.backendUrl}/createCoin`, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`Failed to create coin: ${response.statusText}`);
    const result = await response.json();
    if (!result.success) throw new Error('Failed to create coin');
    await this.storeCoinLocally(result.coin);
    return result.coin;
  }

  async getAllCoins(): Promise<CoinData[]> {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) return JSON.parse(stored);
        const legacy = localStorage.getItem('0g_coins');
        if (legacy) {
          try {
            const coins = JSON.parse(legacy);
            localStorage.setItem(this.storageKey, JSON.stringify(coins));
            return coins;
          } catch {}
        }
      }
    } catch {}
    return []
  }

  private async storeCoinLocally(coin: CoinData): Promise<void> {
    const existing = await this.getAllCoins();
    const updated = [...existing, coin];
    if (typeof window !== 'undefined') localStorage.setItem(this.storageKey, JSON.stringify(updated));
  }

  public async saveCoinToLocal(coin: CoinData): Promise<void> {
    await this.storeCoinLocally(coin);
  }

  async downloadData(rootHash: string): Promise<any> {
    const res = await fetch(`${this.backendUrl}/download/${rootHash}`)
    if (!res.ok) throw new Error(`Download failed: ${res.statusText}`)
    const ct = res.headers.get('content-type')
    if (ct && ct.includes('application/json')) return await res.json()
    return await res.blob()
  }

  getCoinImageUrl(imageRootHash: string): string {
    return `${this.backendUrl}/download/${imageRootHash}`
  }

  getCoinMetadataUrl(metadataRootHash: string): string {
    return `${this.backendUrl}/download/${metadataRootHash}`
  }

  async verifyCoinData(coin: CoinData): Promise<boolean> {
    if (!coin.metadataRootHash) return false
    const metadata = await this.downloadData(coin.metadataRootHash)
    const expected = await this.calculateFileHash(JSON.stringify(metadata))
    return expected === coin.metadataRootHash
  }
}

export const polStorageSDK = new PolStorageSDK({
	evmRpc: process.env.NEXT_PUBLIC_EVM_RPC || 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f',
	indexerRpc: process.env.NEXT_PUBLIC_INDEXER_RPC || 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f',
	privateKey: process.env.NEXT_PUBLIC_PRIVATE_KEY || '',
	backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
})

polStorageSDK.initialize().catch(console.error)


