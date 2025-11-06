'use client'
import { useEffect, useMemo, useState } from 'react'
import { CoinData } from '../../lib/polStorageSDK'

interface CoinImageProps {
  coin: CoinData & { imageHash?: string; imageRootHash?: string; imageUrl?: string }
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function CoinImage({ coin, size = 'md', className = '' }: CoinImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-16 h-16'
  }

  const backendBase = useMemo(() => {
    const envUrl = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) as string | undefined
    if (envUrl && typeof envUrl === 'string') return envUrl
    return 'http://localhost:4000'
  }, [])

  useEffect(() => {
    console.log('CoinImage: Processing coin data:', {
      imageUrl: coin.imageUrl,
      imageHash: (coin as any).imageHash,
      imageRootHash: (coin as any).imageRootHash,
      coinName: coin.name,
      coinSymbol: coin.symbol
    });

    // Preferred: explicit URL
    if (coin.imageUrl && (coin.imageUrl.startsWith('http') || coin.imageUrl.startsWith('/'))) {
      console.log('CoinImage: Using imageUrl:', coin.imageUrl);
      // If it's a backend URL, route through Next proxy
      if (coin.imageUrl.startsWith('http://localhost:4000') || coin.imageUrl.includes('/download/')) {
        // Extract hash from URL and use proxy
        const hashMatch = coin.imageUrl.match(/\/download\/([^/?]+)/)
        if (hashMatch && hashMatch[1]) {
          setImageSrc(`/api/image/${hashMatch[1]}`)
        } else {
          setImageSrc(coin.imageUrl)
        }
      } else if (coin.imageUrl.startsWith('http')) {
        // External URL - use directly
        setImageSrc(coin.imageUrl)
      } else {
        // Relative URL
        setImageSrc(coin.imageUrl.startsWith('/') ? coin.imageUrl : `/${coin.imageUrl}`)
      }
      return
    }

    // Fallback: root hash present
    const root = (coin as any).imageRootHash || (coin as any).imageHash
    if (typeof root === 'string' && root.length > 0) {
      console.log('CoinImage: Using root hash:', root);
      // Use proxy path to avoid mixed content/CORS
      setImageSrc(`/api/image/${encodeURIComponent(root)}`)
      return
    }

    console.log('CoinImage: No image data found, showing fallback for', coin.name);
    setImageSrc(null)
  }, [coin.imageUrl, (coin as any).imageHash, (coin as any).imageRootHash, backendBase])

  if (imageSrc) {
    return (
      <div className={`${sizeClasses[size]} rounded-2xl border-2 border-purple-500/50 overflow-hidden shadow-lg ${className}`}>
        <img 
          src={imageSrc} 
          alt={coin.name} 
          className="w-full h-full object-cover" 
          onError={(e) => {
            console.warn('CoinImage: Image failed to load:', imageSrc, 'for coin:', coin.name);
            // Try alternative sources before giving up
            const root = (coin as any).imageRootHash || (coin as any).imageHash
            if (root && imageSrc !== `/api/image/${root}`) {
              console.log('CoinImage: Trying alternative source with hash:', root);
              setImageSrc(`/api/image/${encodeURIComponent(root)}`)
            } else {
              setImageSrc(null);
            }
          }}
        />
      </div>
    )
  }

  return (
    <div className={`${sizeClasses[size]} rounded-2xl border-2 border-purple-500/50 bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center ${className}`}>
      <span className={`font-bold text-purple-400 ${
        size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl'
      }`}>
        {coin.symbol?.charAt(0)?.toUpperCase() || '?'}
      </span>
    </div>
  )
}
