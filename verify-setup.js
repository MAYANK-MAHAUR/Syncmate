#!/usr/bin/env node
// verify-setup.js
// Run with: node verify-setup.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying lazyA Setup...\n');

let hasErrors = false;

// Check 1: .env.local file
console.log('1. Checking .env.local file...');
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    console.log('   ✅ .env.local exists');
    
    require('dotenv').config({ path: envPath });
    
    // Check required env vars
    const requiredVars = ['COMPOSIO_API_KEY', 'FIREWORKS_API_KEY'];
    requiredVars.forEach(varName => {
        if (process.env[varName]) {
            console.log(`   ✅ ${varName} is set`);
        } else {
            console.log(`   ❌ ${varName} is missing`);
            hasErrors = true;
        }
    });
} else {
    console.log('   ❌ .env.local not found');
    console.log('   → Copy .env.local.example to .env.local and fill in your API keys');
    hasErrors = true;
}

// Check 2: Node modules
console.log('\n2. Checking dependencies...');
const nodeModulesPath = path.join(process.cwd(), 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
    console.log('   ✅ node_modules exists');
    
    const requiredPackages = [
        'composio-core',
        'openai',
        'next',
        'react'
    ];
    
    requiredPackages.forEach(pkg => {
        const pkgPath = path.join(nodeModulesPath, pkg);
        if (fs.existsSync(pkgPath)) {
            console.log(`   ✅ ${pkg} installed`);
        } else {
            console.log(`   ❌ ${pkg} not installed`);
            hasErrors = true;
        }
    });
} else {
    console.log('   ❌ node_modules not found');
    console.log('   → Run: bun install');
    hasErrors = true;
}

// Check 3: Required files
console.log('\n3. Checking project files...');
const requiredFiles = [
    'src/app/api/run-agent/route.js',
    'src/utils/agent.js',
    'src/utils/llm.js',
    'src/helpers/common.js'
];

requiredFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${file} exists`);
    } else {
        console.log(`   ❌ ${file} missing`);
        hasErrors = true;
    }
});

// Check 4: Test API connections (if env vars are set)
console.log('\n4. Testing API connections...');
if (process.env.COMPOSIO_API_KEY && process.env.FIREWORKS_API_KEY) {
    testAPIs();
} else {
    console.log('   ⚠️  Skipping (API keys not set)');
}

async function testAPIs() {
    // Test Composio
    try {
        const response = await fetch('https://backend.composio.dev/api/v1/apps?limit=1', {
            headers: { 'X-API-Key': process.env.COMPOSIO_API_KEY }
        });
        if (response.ok) {
            console.log('   ✅ Composio API is working');
        } else {
            console.log(`   ❌ Composio API error: ${response.status}`);
            hasErrors = true;
        }
    } catch (err) {
        console.log('   ❌ Composio API connection failed:', err.message);
        hasErrors = true;
    }

    // Test Fireworks
    try {
        const response = await fetch('https://api.fireworks.ai/inference/v1/models', {
            headers: { 
                'Authorization': `Bearer ${process.env.FIREWORKS_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            console.log('   ✅ Fireworks AI API is working');
        } else {
            console.log(`   ❌ Fireworks AI API error: ${response.status}`);
            hasErrors = true;
        }
    } catch (err) {
        console.log('   ❌ Fireworks AI API connection failed:', err.message);
        hasErrors = true;
    }
}

// Final summary
setTimeout(() => {
    console.log('\n' + '='.repeat(50));
    if (hasErrors) {
        console.log('❌ Setup has issues. Please fix the errors above.');
        console.log('\nQuick fixes:');
        console.log('  1. Copy .env.local.example to .env.local');
        console.log('  2. Add your API keys to .env.local');
        console.log('  3. Run: bun install');
        console.log('  4. Run: bun run dev');
        process.exit(1);
    } else {
        console.log('✅ Setup looks good! You can run: bun run dev');
        process.exit(0);
    }
}, 2000);