require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Deploy ALL contracts to Polygon Amoy testnet
 * 
 * This script deploys:
 * 1. Factory (for token + bonding curve creation) - Already deployed
 * 2. WETH9 (Wrapped MATIC)
 * 3. UniswapV2Factory (DEX factory)
 * 4. UniswapV2Router02 (DEX router)
 * 5. AutoTradingFactory (optional, for auto pool creation)
 * 
 * Usage: node scripts/deployAllContractsPolygonAmoy.js
 */

async function main() {
  console.log('🚀 Deploying ALL contracts to Polygon Amoy testnet...\n');

  // Check for private key
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not found in environment variables');
    process.exit(1);
  }

  // Polygon Amoy RPC
  const RPC_URL = process.env.POLYGON_AMOY_RPC || 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f';
  
  // Create provider and wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log('📝 Deployer address:', wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log('💰 Balance:', ethers.formatEther(balance), 'MATIC\n');
  
  if (balance === 0n) {
    console.error('❌ Insufficient balance. Please get MATIC from Polygon Amoy faucet:');
    console.log('   https://faucet.polygon.technology/');
    process.exit(1);
  }

  const deployment = {
    network: 'polygon-amoy-testnet',
    chainId: 80002,
    deployer: wallet.address,
    rpcUrl: RPC_URL,
    deployedAt: new Date().toISOString()
  };

  // Helper to load contract artifact
  const loadContract = (contractName) => {
    const artifactsPath = path.join(__dirname, '..', 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`);
    if (!fs.existsSync(artifactsPath)) {
      // Try DEX subdirectory
      const dexPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'DEX', `${contractName}.sol`, `${contractName}.json`);
      if (fs.existsSync(dexPath)) {
        return require(dexPath);
      }
      throw new Error(`Contract ${contractName} not found. Please compile: npx hardhat compile`);
    }
    return require(artifactsPath);
  };

  try {
    // 1. Check if Factory is already deployed
    const existingFactory = process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '0x0Bd71a034D5602014206B965677E83C6484561F2';
    console.log('📋 Existing Factory:', existingFactory);
    console.log('   (Skipping Factory deployment - already deployed)\n');

    deployment.factory = existingFactory;
    deployment.factoryTxHash = 'Already deployed';

    // 2. Deploy WETH9
    console.log('📦 Deploying WETH9 (Wrapped MATIC)...');
    const wethArtifact = loadContract('WETH9');
    const WETH = new ethers.ContractFactory(wethArtifact.abi, wethArtifact.bytecode, wallet);
    const weth = await WETH.deploy();
    const wethTx = weth.deploymentTransaction();
    console.log('   Transaction hash:', wethTx?.hash);
    console.log('   Waiting for confirmation...');
    await weth.waitForDeployment();
    const wethAddress = await weth.getAddress();
    console.log('   ✅ WETH9 deployed:', wethAddress);
    deployment.weth = wethAddress;
    deployment.wethTxHash = wethTx?.hash;
    console.log('');

    // 3. Deploy UniswapV2Factory
    console.log('🏭 Deploying UniswapV2Factory...');
    const factoryArtifact = loadContract('UniswapV2Factory');
    const UniswapFactory = new ethers.ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, wallet);
    const uniswapFactory = await UniswapFactory.deploy(wallet.address); // feeToSetter
    const uniswapFactoryTx = uniswapFactory.deploymentTransaction();
    console.log('   Transaction hash:', uniswapFactoryTx?.hash);
    console.log('   Waiting for confirmation...');
    await uniswapFactory.waitForDeployment();
    const uniswapFactoryAddress = await uniswapFactory.getAddress();
    console.log('   ✅ UniswapV2Factory deployed:', uniswapFactoryAddress);
    deployment.uniswapFactory = uniswapFactoryAddress;
    deployment.uniswapFactoryTxHash = uniswapFactoryTx?.hash;
    console.log('');

    // 4. Deploy UniswapV2Router02
    console.log('🔄 Deploying UniswapV2Router02...');
    const routerArtifact = loadContract('UniswapV2Router02');
    const Router = new ethers.ContractFactory(routerArtifact.abi, routerArtifact.bytecode, wallet);
    const router = await Router.deploy(uniswapFactoryAddress, wethAddress);
    const routerTx = router.deploymentTransaction();
    console.log('   Transaction hash:', routerTx?.hash);
    console.log('   Waiting for confirmation...');
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    console.log('   ✅ UniswapV2Router02 deployed:', routerAddress);
    deployment.router = routerAddress;
    deployment.routerTxHash = routerTx?.hash;
    console.log('');

    // 5. Deploy AutoTradingFactory (optional)
    console.log('🏗️ Deploying AutoTradingFactory...');
    try {
      const autoTradingArtifact = loadContract('AutoTradingFactory');
      const AutoTradingFactory = new ethers.ContractFactory(autoTradingArtifact.abi, autoTradingArtifact.bytecode, wallet);
      const autoTradingFactory = await AutoTradingFactory.deploy(
        uniswapFactoryAddress,
        routerAddress,
        wethAddress,
        wallet.address // fee recipient
      );
      const autoTradingTx = autoTradingFactory.deploymentTransaction();
      console.log('   Transaction hash:', autoTradingTx?.hash);
      console.log('   Waiting for confirmation...');
      await autoTradingFactory.waitForDeployment();
      const autoTradingAddress = await autoTradingFactory.getAddress();
      console.log('   ✅ AutoTradingFactory deployed:', autoTradingAddress);
      deployment.autoTradingFactory = autoTradingAddress;
      deployment.autoTradingFactoryTxHash = autoTradingTx?.hash;
    } catch (error) {
      console.log('   ⚠️  AutoTradingFactory deployment skipped:', error.message);
      deployment.autoTradingFactory = null;
    }
    console.log('');

    // Save deployment info
    if (!fs.existsSync('deployments')) {
      fs.mkdirSync('deployments');
    }

    const outFile = path.join('deployments', 'all-contracts-polygon-amoy.json');
    fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
    console.log('💾 Saved deployment info to:', outFile);

    // Update .env file
    const envUpdates = [
      `NEXT_PUBLIC_FACTORY_ADDRESS=${existingFactory}`,
      `NEXT_PUBLIC_UNISWAP_FACTORY_ADDRESS=${uniswapFactoryAddress}`,
      `NEXT_PUBLIC_ROUTER_ADDRESS=${routerAddress}`,
      `NEXT_PUBLIC_WETH_ADDRESS=${wethAddress}`
    ];
    
    if (deployment.autoTradingFactory) {
      envUpdates.push(`NEXT_PUBLIC_AUTO_TRADING_FACTORY_ADDRESS=${deployment.autoTradingFactory}`);
    }

    console.log('\n📝 Update your .env file with:');
    envUpdates.forEach(line => console.log('   ' + line));

    // Update lib/trading-config.ts
    const tradingConfig = `// Auto-generated by deployAllContractsPolygonAmoy.js
export const TRADING_CONFIG = {
  FACTORY_ADDRESS: '${existingFactory}',
  ROUTER_ADDRESS: '${routerAddress}',
  WETH_ADDRESS: '${wethAddress}',
  UNISWAP_FACTORY_ADDRESS: '${uniswapFactoryAddress}',
  AUTO_TRADING_FACTORY_ADDRESS: '${deployment.autoTradingFactory || ''}',
  NETWORK: 'polygon-amoy-testnet',
  RPC_URL: '${RPC_URL}',
  CHAIN_ID: 80002
};
`;
    
    fs.writeFileSync(path.join('lib', 'trading-config.ts'), tradingConfig);
    console.log('\n🎨 Updated lib/trading-config.ts');

    // Summary
    console.log('\n✅ ALL CONTRACTS DEPLOYED SUCCESSFULLY!\n');
    console.log('📊 Deployment Summary:');
    console.log('   Factory (Bonding Curve):', existingFactory);
    console.log('   WETH9:', wethAddress);
    console.log('   UniswapV2Factory:', uniswapFactoryAddress);
    console.log('   UniswapV2Router02:', routerAddress);
    if (deployment.autoTradingFactory) {
      console.log('   AutoTradingFactory:', deployment.autoTradingFactory);
    }
    console.log('\n🔗 View on PolygonScan:');
    console.log(`   Factory: https://amoy.polygonscan.com/address/${existingFactory}`);
    console.log(`   WETH: https://amoy.polygonscan.com/address/${wethAddress}`);
    console.log(`   Uniswap Factory: https://amoy.polygonscan.com/address/${uniswapFactoryAddress}`);
    console.log(`   Router: https://amoy.polygonscan.com/address/${routerAddress}`);
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    if (error.transaction) {
      console.error('Transaction hash:', error.transaction.hash);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

