require('dotenv').config();
const { ethers } = require('ethers');

/**
 * Verify that the Factory contract is deployed and accessible
 * 
 * Usage: node scripts/verifyContract.js
 */

async function main() {
  console.log('🔍 Verifying Factory contract on Polygon Amoy...\n');

  // Get factory address from config or env
  const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '0x560C7439E28359E2E8C0D72A52e8b5d6645766e7';
  const RPC_URL = process.env.POLYGON_AMOY_RPC || 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f';

  console.log('📋 Configuration:');
  console.log('   Factory Address:', FACTORY_ADDRESS);
  console.log('   Network: Polygon Amoy Testnet');
  console.log('   RPC:', RPC_URL);
  console.log('');

  // Create provider
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Factory ABI
  const FACTORY_ABI = [
    'function treasury() view returns (address)',
    'function defaultFeeBps() view returns (uint16)'
  ];

  try {
    // Check if contract exists
    const code = await provider.getCode(FACTORY_ADDRESS);
    if (code === '0x') {
      console.error('❌ Contract not found at address:', FACTORY_ADDRESS);
      console.log('\n💡 Make sure:');
      console.log('   1. Contract is deployed to Polygon Amoy');
      console.log('   2. Address is correct');
      console.log('   3. Network is Polygon Amoy (chain ID 80002)');
      process.exit(1);
    }

    console.log('✅ Contract code found');

    // Try to call contract functions
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

    try {
      const treasury = await factory.treasury();
      const feeBps = await factory.defaultFeeBps();

      console.log('✅ Contract is accessible');
      console.log('\n📊 Contract Info:');
      console.log('   Treasury:', treasury);
      console.log('   Default Fee:', feeBps.toString(), 'bps (' + (Number(feeBps) / 100) + '%)');

      // Check if we can read from it
      console.log('\n✅ Contract verification successful!');
      console.log('\n🔗 View on PolygonScan:');
      console.log(`   https://amoy.polygonscan.com/address/${FACTORY_ADDRESS}`);

    } catch (error) {
      console.error('❌ Could not read contract data:', error.message);
      console.log('\n💡 Contract exists but may not be the correct Factory contract');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

