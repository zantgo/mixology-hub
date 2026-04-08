GREEN=\033[0;32m
YELLOW=\033[1;33m
RED=\033[0;31m
NC=\033[0m 

.PHONY: help start stop clean rebuild logs test-backend test-frontend test-e2e setup

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

setup:
	@echo "$(YELLOW)Installing backend dependencies...$(NC)"
	cd backend && npm install
	@echo "$(YELLOW)Installing frontend dependencies...$(NC)"
	cd frontend && npm install

start:
	@echo "$(GREEN)Starting MixologyHub stack...$(NC)"
	docker compose up -d

stop:
	@echo "$(RED)Stopping MixologyHub stack...$(NC)"
	docker compose down

clean:
	@echo "$(RED)Cleaning stack and volumes...$(NC)"
	docker compose down -v --remove-orphans

rebuild:
	@echo "$(YELLOW)Rebuilding images...$(NC)"
	docker compose up -d --build

logs:
	docker compose logs -f

test-backend:
	@echo "$(GREEN)Running Backend Tests...$(NC)"
	cd backend && npm run test

test-frontend:
	@echo "$(GREEN)Running Frontend Tests...$(NC)"
	cd frontend && npm run test:ci

test-e2e:
	@echo "$(GREEN)Running Backend E2E Tests...$(NC)"
	cd backend && npm run test:e2e

test: test-backend test-frontend
	@echo "$(GREEN)All tests completed successfully.$(NC)"
