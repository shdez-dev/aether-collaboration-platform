#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_ENV="/srv/aether/secrets/aether-platform.env"
BREVO_ENV="/srv/aether/secrets/brevo.env"
DEPLOY_LOCK="/home/athe/.cache/aether-platform/deploy.lock"
BRANCH="main"
APP_URL="https://minecraft-rpi.taile4f8be.ts.net"

mode="${1:---deploy}"

if [[ "$mode" != "--deploy" && "$mode" != "--update" ]]; then
  echo "Uso: $0 [--deploy|--update]" >&2
  exit 2
fi

mkdir -p "$(dirname -- "$DEPLOY_LOCK")"
exec 9>"$DEPLOY_LOCK"
if ! flock -n 9; then
  echo "Ya hay un despliegue de Aether en curso."
  exit 0
fi

if [[ ! -d "$REPO_ROOT/.git" ]]; then
  echo "No se encontró el repositorio de Aether en $REPO_ROOT" >&2
  exit 1
fi

if [[ "$mode" == "--update" ]]; then
  git -C "$REPO_ROOT" diff --quiet
  git -C "$REPO_ROOT" diff --cached --quiet
  if [[ -n "$(git -C "$REPO_ROOT" ls-files --others --exclude-standard)" ]]; then
    echo "El repositorio tiene archivos sin seguimiento; se cancela la actualización." >&2
    exit 1
  fi
  git -C "$REPO_ROOT" fetch --quiet origin "$BRANCH"
  target="$(git -C "$REPO_ROOT" rev-parse FETCH_HEAD)"
  current="$(git -C "$REPO_ROOT" rev-parse HEAD)"
  if [[ "$current" == "$target" ]]; then
    exit 0
  fi
  git -C "$REPO_ROOT" merge --ff-only "$target"
fi

if [[ ! -s "$APP_ENV" ]]; then
  sudo -n install -d -o root -g root -m 0700 /srv/aether/secrets
  sudo -n bash -c '
    set -euo pipefail
    umask 077
    app_env="/srv/aether/secrets/aether-platform.env"
    if [[ ! -s "$app_env" ]]; then
      db_password="$(openssl rand -hex 32)"
      redis_password="$(openssl rand -hex 32)"
      jwt_secret="$(openssl rand -hex 48)"
      refresh_secret="$(openssl rand -hex 48)"
      printf "DB_NAME=aether\nDB_USER=aether\nDB_PASSWORD=%s\nREDIS_PASSWORD=%s\nJWT_SECRET=%s\nREFRESH_TOKEN_SECRET=%s\nAPP_URL=https://minecraft-rpi.taile4f8be.ts.net\n" \
        "$db_password" "$redis_password" "$jwt_secret" "$refresh_secret" > "$app_env"
      chmod 0600 "$app_env"
    fi
  '
fi

if ! sudo -n test -s "$BREVO_ENV"; then
  echo "No están disponibles las credenciales SMTP de Brevo en $BREVO_ENV" >&2
  exit 1
fi

sudo -n docker compose \
  --project-name aether-platform \
  --env-file "$APP_ENV" \
  --env-file "$BREVO_ENV" \
  --file "$REPO_ROOT/docker-compose.raspberry.yml" \
  config --quiet

sudo -n docker compose \
  --project-name aether-platform \
  --env-file "$APP_ENV" \
  --env-file "$BREVO_ENV" \
  --file "$REPO_ROOT/docker-compose.raspberry.yml" \
  up --detach --build --remove-orphans

sudo -n install -m 0644 "$REPO_ROOT/infra/raspberry-pi/aether-platform-deploy.service" /etc/systemd/system/aether-platform-deploy.service
sudo -n install -m 0644 "$REPO_ROOT/infra/raspberry-pi/aether-platform-deploy.timer" /etc/systemd/system/aether-platform-deploy.timer
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now aether-platform-deploy.timer

echo "Despliegue solicitado. Revisa el estado con: sudo docker compose --project-name aether-platform ps"
