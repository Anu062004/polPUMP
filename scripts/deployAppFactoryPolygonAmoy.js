require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Deploy Factory contract to Polygon Amoy testnet
 * 
 * Usage:
 * 1. Set PRIVATE_KEY in .env file
 * 2. Make sure you have MATIC on Polygon Amoy testnet for gas
 * 3. Run: node scripts/deployAppFactoryPolygonAmoy.js
 */

async function main() {
  console.log('🚀 Deploying Factory contract to Polygon Amoy testnet...\n');

  // Check for private key
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not found in environment variables');
    console.log('Please set PRIVATE_KEY in your .env file');
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
  console.log('💰 Balance:', ethers.formatEther(balance), 'MATIC');
  
  if (balance === 0n) {
    console.error('❌ Insufficient balance. Please get MATIC from Polygon Amoy faucet:');
    console.log('   https://faucet.polygon.technology/');
    process.exit(1);
  }

  // Factory contract bytecode and ABI (you need to compile Factory.sol first)
  // For now, we'll use a simplified approach - you should compile contracts first
  console.log('\n📦 Loading Factory contract...');
  
  // Read compiled contract from artifacts
  let Factory;
  try {
    const artifactsPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'Factory.sol', 'Factory.json');
    if (!fs.existsSync(artifactsPath)) {
      throw new Error('Artifacts not found. Please compile contracts first: npx hardhat compile');
    }
    
    const factoryArtifact = require(artifactsPath);
    Factory = new ethers.ContractFactory(
      factoryArtifact.abi,
      factoryArtifact.bytecode,
      wallet
    );
    console.log('✅ Loaded Factory from artifacts');
  } catch (error) {
    console.error('❌ Could not load Factory contract:', error.message);
    console.error('\n💡 Please compile contracts first:');
    console.error('   npx hardhat compile');
    process.exit(1);
  }

  // Deployment parameters
  const treasury = process.env.FACTORY_TREASURY || wallet.address;
  const defaultFeeBps = parseInt(process.env.FACTORY_FEE_BPS || '50', 10); // 0.5% = 50 bps

  console.log('\n📋 Deployment Parameters:');
  console.log('   Treasury:', treasury);
  console.log('   Default Fee:', defaultFeeBps, 'bps (0.5%)');

  // Deploy Factory
  console.log('\n🚀 Deploying Factory contract...');
  try {
    const factory = await Factory.deploy(treasury, defaultFeeBps);
    console.log('⏳ Transaction hash:', factory.deploymentTransaction()?.hash);
    console.log('⏳ Waiting for confirmation...');
    
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    
    console.log('\n✅ Factory deployed successfully!');
    console.log('📍 Factory Address:', factoryAddress);
    
    // Verify deployment
    const deployedTreasury = await factory.treasury();
    const deployedFeeBps = await factory.defaultFeeBps();
    
    console.log('\n🔍 Verification:');
    console.log('   Treasury:', deployedTreasury);
    console.log('   Fee BPS:', deployedFeeBps.toString());
    
    // Save deployment info
    const deployment = {
      network: 'polygon-amoy-testnet',
      chainId: 80002,
      address: factoryAddress,
      treasury,
      defaultFeeBps,
      deployer: wallet.address,
      rpcUrl: RPC_URL,
      deployedAt: new Date().toISOString(),
      transactionHash: factory.deploymentTransaction()?.hash
    };

    // Ensure deployments directory exists
    if (!fs.existsSync('deployments')) {
      fs.mkdirSync('deployments');
    }

    const outFile = path.join('deployments', 'app-factory-polygon-amoy.json');
    fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
    console.log('\n💾 Saved deployment info to:', outFile);

    // Update .env.example or show instructions
    console.log('\n📝 Next steps:');
    console.log('1. Update your .env file with:');
    console.log(`   NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`);
    console.log('\n2. Update lib/contract-config.ts if using hardcoded address');
    console.log('\n3. Test creating a token using the Create Token button');
    
    console.log('\n✅ Deployment complete!');
    
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

