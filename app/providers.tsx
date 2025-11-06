'use client'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { getDefaultWallets, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { polygonAmoy } from 'wagmi/chains'
import '@rainbow-me/rainbowkit/styles.css'

const { connectors } = getDefaultWallets({
  appName: 'POL Pump - Polygon Meme Token Creator',
  projectId: 'a14234612450c639dd0adcbb729ddfd8',
})

const config = createConfig({
  chains: [polygonAmoy],
  connectors,
  transports: {
    [polygonAmoy.id]: http('https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'),
  },
})

const qc = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider theme={darkTheme({ overlayBlur: 'small' })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

