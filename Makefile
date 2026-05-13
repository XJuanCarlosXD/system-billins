.DEFAULT_GOAL := help

COMPOSE = docker compose
BACK    = $(COMPOSE) exec backend
FRONT   = $(COMPOSE) exec frontend

help: ## Muestra los comandos disponibles
	@echo "Targets disponibles:"
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ---------- ciclo de vida ----------
up: ## Levanta los servicios en foreground
	$(COMPOSE) up

up-d: ## Levanta los servicios en background
	$(COMPOSE) up -d

down: ## Baja los servicios (mantiene volumes)
	$(COMPOSE) down

stop: ## Para los servicios sin removerlos
	$(COMPOSE) stop

restart: ## Reinicia los servicios
	$(COMPOSE) restart

build: ## Construye las imagenes
	$(COMPOSE) build

rebuild: ## Reconstruye sin cache
	$(COMPOSE) build --no-cache

ps: ## Lista contenedores
	$(COMPOSE) ps

logs: ## Sigue logs de todos los servicios
	$(COMPOSE) logs -f

logs-back: ## Logs solo del backend
	$(COMPOSE) logs -f backend

logs-front: ## Logs solo del frontend
	$(COMPOSE) logs -f frontend

# ---------- backend (django) ----------
migrate: ## Aplica migraciones (solo SQLite local; nunca al Oracle legado)
	$(BACK) python manage.py migrate

makemigrations: ## Genera migraciones
	$(BACK) python manage.py makemigrations

createsuperuser: ## Crea usuario admin
	$(BACK) python manage.py createsuperuser

shell-back: ## Shell de Django
	$(BACK) python manage.py shell

bash-back: ## Bash dentro del contenedor backend
	$(BACK) bash

manage: ## Pasa cmd: make manage cmd="check"
	$(BACK) python manage.py $(cmd)

oracle-check: ## Verifica conexion al Oracle legado sin escribir nada
	$(BACK) python manage.py shell -c "from django.db import connections; cur=connections['legacy_oracle'].cursor(); cur.execute(\"SELECT USER, SYS_CONTEXT('USERENV','DB_NAME') FROM DUAL\"); print(cur.fetchone())"

# ---------- frontend (vite) ----------
shell-front: ## Bash dentro del contenedor frontend
	$(FRONT) sh

install-front: ## Reinstala deps del frontend dentro del contenedor
	$(FRONT) npm install

lint-front: ## Corre lint del frontend
	$(FRONT) npm run lint

# ---------- limpieza ----------
clean: ## Baja todo y borra volumes (pierde sqlite local)
	$(COMPOSE) down -v

prune: ## Limpia imagenes y caches docker no usadas
	docker system prune -f

.PHONY: help up up-d down stop restart build rebuild ps logs logs-back logs-front \
        migrate makemigrations createsuperuser shell-back bash-back manage oracle-check \
        shell-front install-front lint-front clean prune
