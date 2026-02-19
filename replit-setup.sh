#!/bin/bash
# Setup script for Replit deployment
# This script configures git to avoid divergent branches error

echo "🔧 Configuring git for Replit..."

# Configure git pull to use merge strategy (avoids divergent branches error)
git config pull.rebase false

# Alternative: Configure to always fast-forward only (safer for Replit)
# git config pull.ff only

echo "✅ Git configuration complete!"
echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🏗️ Building project..."
npm run build

echo ""
echo "✅ Setup complete! You can now run:"
echo "   git pull origin main"
echo "   npm run start:prod"
