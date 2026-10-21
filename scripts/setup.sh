#!/bin/bash
echo "Going to project root"
cd "$(dirname "$0")/.."

echo "Installing packages..."
npm install

if [ ! -f ".env" ]; then
  cp ".env.example" ".env"
  echo ".env created"
else
  echo ".env already exists"
fi

echo ""
echo "PostgreSQL setup"
echo "Press Enter to use the existing database."
echo ""

read -r -p "DATABASE_URL: " DB_URL

if [ -n "$DB_URL" ]; then
  # Save DATABASE_URL
  grep -v "^DATABASE_URL=" .env > .env.tmp || true
  mv .env.tmp .env
  echo "DATABASE_URL=\"$DB_URL\"" >> .env

  echo ""
  echo "Setting up database..."

else
  echo ""
  echo "No DATABASE_URL provided."
  echo ""
  echo "Setting up with existing database..."

fi

sleep 3
  echo "Generating Prisma client..."
  npm run prisma:generate

echo ""
echo "Connecting to PostgreSQL..."
  sleep 3
  echo "Pushing database schema..."

if ! npm run prisma:db:push; then
  echo ""
  echo "❌ Database connection/setup failed."
  echo "Please check your DATABASE_URL and PostgreSQL server."
  exit 1
fi

echo ""
echo "✅ Database connection successful."


sleep 2

echo ""
echo "Ingenst into database"
npm run ingest:pdf -- ./data/raw/financial_knowledge_graph_sample.pdf

sleep 2

echo ""
echo "Running tests..."

if ! npm run test; then
  echo ""
  echo "❌ Tests failed."
  exit 1
fi

echo ""
echo "✅ All tests passed."

  echo "Setting up the MCP server to claude config"
  npm run claude:config -- --transport=http

  echo "Running the MCP server"
  npm run start:http

  echo ""
  echo "Done - now you can ask with your claude desktop. make sure you restart the MCP server in claude after you add the config."
  echo ""

echo ""
echo "Setup complete!"
echo ""
echo "Available commands:"
echo "  npm run start:http"
echo "  npm test"
echo ""