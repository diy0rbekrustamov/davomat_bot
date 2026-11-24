#!/bin/bash
set -euo pipefail
release=/opt/davomat/releases/20261027-fullscreen
image=davomat:fullscreen-20261027
mode=${1:---deploy}
cd "$release"
test "$(docker image inspect "$image" --format '{{.Id}}')" = "$(cat .audit-tested-image)"
sha256sum -c .audit-source-sha256 >/dev/null
grep -qx 'DAVOMAT_DISABLE_BOT=0' /opt/davomat/server.env
systemctl is-active --quiet davomat-restart-control.service
test -S /opt/davomat/control/control.sock
docker compose --env-file /opt/davomat/server.env -p davomat -f docker-compose.production.yml config --quiet
if [[ "$mode" == --check ]]; then echo AUDITED_DEPLOY_CHECK_PASS; exit 0; fi
if [[ "$mode" != --deploy && "$mode" != --rollback && "$mode" != --checkpoint-check ]]; then echo 'Use --check, --deploy, or --rollback'; exit 2; fi
if test -e /opt/davomat/state/pending.json; then echo 'Pending storage journal must be reconciled before switching versions.'; exit 1; fi
nonce=$(date -u +%Y%m%dT%H%M%S)-$$
backup=/opt/davomat/audit-20261026/backups/cutover-$nonce
mkdir -p "$backup" /opt/davomat/state
chmod 700 "$backup" /opt/davomat/state
holder=''
cleanup(){ if [[ -n "$holder" ]]; then docker exec davomat-app-1 sh -c "kill -TERM $holder" >/dev/null 2>&1 || true; fi; }
trap cleanup EXIT
# This helper holds the same live database lock across the final checkpoint and container replacement.
docker exec -i davomat-app-1 sh -c 'cat > /tmp/audit-checkpoint.cjs' < deploy/audit-20261026/checkpoint.cjs
docker exec davomat-app-1 node /tmp/audit-checkpoint.cjs "$nonce" > "$backup/checkpoint.log" 2>&1 &
runner=$!
ready=false
for attempt in $(seq 1 100); do
 if [[ -z "$holder" ]] && docker exec davomat-app-1 test -f "/ram/audit-cutover-$nonce.pid"; then holder=$(docker exec davomat-app-1 cat "/ram/audit-cutover-$nonce.pid"); fi
 if docker exec davomat-app-1 test -f "/ram/audit-cutover-$nonce.ready.json"; then ready=true; break; fi
 if ! kill -0 "$runner" 2>/dev/null; then cat "$backup/checkpoint.log"; exit 1; fi
 sleep 0.5
done
if [[ "$ready" != true ]]; then cat "$backup/checkpoint.log"; exit 1; fi
docker exec davomat-app-1 cat "/ram/audit-cutover-$nonce.ready.json" > "$backup/checkpoint.json"
holder=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["pid"])' "$backup/checkpoint.json")
for suffix in sqlite github.sqlite; do docker exec davomat-app-1 cat "/ram/audit-cutover-$nonce.$suffix" > "$backup/$suffix"; done
chmod 600 "$backup"/*
python3 - "$backup" <<'PY'
import sqlite3,sys,os
for name in ['sqlite','github.sqlite']:
 p=os.path.join(sys.argv[1],name);d=sqlite3.connect('file:'+p+'?mode=ro',uri=True);assert d.execute('PRAGMA integrity_check').fetchone()[0]=='ok';d.close()
print('CUTOVER_BACKUPS_VERIFIED')
PY
if [[ "$mode" == --checkpoint-check ]]; then echo AUDITED_CHECKPOINT_CHECK_PASS; exit 0; fi
extra=()
if [[ "$mode" == --rollback ]]; then extra=(-f /opt/davomat/releases/20261027-fullscreen/deploy/fullscreen/rollback.override.yml); fi
docker compose --env-file /opt/davomat/server.env -p davomat -f docker-compose.production.yml "${extra[@]}" up -d --no-deps --no-build app
holder=''
wait "$runner" 2>/dev/null || true
if [[ "$mode" == --deploy ]]; then ln -s "$release" /opt/davomat/current.next; mv -Tf /opt/davomat/current.next /opt/davomat/current; fi
ok=false
for attempt in $(seq 1 60); do
 if docker inspect davomat-app-1 --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' | grep -qx healthy; then ok=true; break; fi
 sleep 1
done
if [[ "$ok" != true ]]; then echo 'NEW_VERSION_NOT_READY: backups and journal retained; no automatic database rollback performed.'; exit 1; fi
printf 'DAVOMAT_SWITCH_READY mode=%s backup=%s\n' "$mode" "$backup"
docker inspect davomat-app-1 --format 'image={{.Config.Image}} health={{.State.Health.Status}}'
