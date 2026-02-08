.PHONY: help install install-api install-app install-playwright start-api start-app all dev clean

help:
	@echo "PDF Translator - Available commands:"
	@echo ""
	@echo "  make install          - Install all dependencies (API + App)"
	@echo "  make install-api      - Install API dependencies"
	@echo "  make install-app      - Install App dependencies"
	@echo "  make install-playwright - Install Playwright browsers"
	@echo ""
	@echo "  make start-api        - Start the API server (port 3001)"
	@echo "  make start-app        - Start the Next.js app (port 3000)"
	@echo "  make all              - Start both API and App concurrently"
	@echo "  make dev              - Alias for 'make all'"
	@echo ""
	@echo "  make clean            - Remove node_modules and temp files"
	@echo ""

install: install-api install-app install-playwright
	@echo "✓ All dependencies installed successfully!"

install-api:
	@echo "Installing API dependencies..."
	@cd api && npm install

install-app:
	@echo "Installing App dependencies..."
	@cd app && npm install

install-playwright:
	@echo "Installing Playwright browsers..."
	@cd api && npx playwright install chromium

start-api:
	@echo "Starting API server on port 3001..."
	@cd api && npm run dev

start-app:
	@echo "Starting Next.js app on port 3000..."
	@cd app && npm run dev

all:
	@echo "Starting API and App..."
	@make -j2 start-api start-app

dev: all

clean:
	@echo "Cleaning up..."
	@rm -rf api/node_modules
	@rm -rf api/temp
	@rm -rf app/node_modules
	@rm -rf app/.next
	@echo "✓ Cleanup complete!"
