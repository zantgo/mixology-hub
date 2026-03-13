# Colores para la terminal
GREEN=\033[0;32m
YELLOW=\033[1;33m
RED=\033[0;31m
NC=\033[0m # No Color

.PHONY: help start stop clean rebuild logs test-backend test-frontend setup

help: ## Muestra este menú de ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

setup: ## Instala dependencias iniciales en backend y frontend
	@echo "$(YELLOW)Installing backend dependencies...$(NC)"
	cd backend && npm install
	@echo "$(YELLOW)Installing frontend dependencies...$(NC)"
	cd frontend && npm install

start: ## Levanta todos los servicios en modo producción/demo
	@echo "$(GREEN)Starting MixologyHub stack...$(NC)"
	docker compose up -d

stop: ## Detiene todos los contenedores
	@echo "$(RED)Stopping MixologyHub stack...$(NC)"
	docker compose down

clean: ## Detiene y elimina contenedores, volúmenes y redes
	@echo "$(RED)Cleaning stack and volumes...$(NC)"
	docker compose down -v --remove-orphans

rebuild: ## Reconstruye imágenes desde cero
	@echo "$(YELLOW)Rebuilding images...$(NC)"
	docker compose up -d --build

logs: ## Sigue los logs de todos los servicios
	docker compose logs -f

test-backend: ## Ejecuta los tests del backend
	@echo "$(GREEN)Running Backend Tests...$(NC)"
	cd backend && npm run test

test-frontend: ## Ejecuta los tests del frontend
	@echo "$(GREEN)Running Frontend Tests...$(NC)"
	cd frontend && npm run test -- --watch=false

test: test-backend test-frontend ## Ejecuta todos los tests del proyecto
	@echo "$(GREEN)All tests completed successfully.$(NC)"
