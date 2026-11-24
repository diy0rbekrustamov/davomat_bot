# Developer-only Davomat restart control

Deployed 2026-10-26: image `davomat:restart-20261026`, SHA256 `ac36ebe6bf55f7a0b16ff042185ead6c384da1ebfd9baf16e8b4837922d12d7e`.

Telegram user 8197301287 sees **🔄 Davomatni qayta ishga tushirish** in the private reply keyboard. It opens a 60-second confirmation; cancel, expired/replayed confirmations, other users and group chats cannot trigger the action. Recovery handler runs before GitHub database middleware and performs no database operations.

The bot calls an authenticated Unix socket in a read-only mount. It has no Docker socket or general host command access. The systemd host helper accepts only the fixed restart operation for `davomat-app-1`; body-selected commands and containers are rejected. It executes `docker restart --time 40 davomat-app-1`, waits for the container's audited readiness healthcheck, then reports the result only to the developer. There is a 90-second cooldown and concurrent/duplicate request protection. No database or Docker volume is deleted.

Host files:
- `/opt/davomat/control-service/server.py`
- `/etc/systemd/system/davomat-restart-control.service`
- `/opt/davomat/control/`: private token, Unix socket, operation status (root-only).

Useful commands:
```sh
systemctl status davomat-restart-control.service
journalctl -u davomat-restart-control.service -n 30 --no-pager
bash /opt/davomat/rollback-restart-feature.sh
```
Rollback returns to `davomat:audit-20261026` without restoring an old database. The tested checkpoint/commit-journal safeguards remain in place. Global `/opt/davomat/build-runtime.sh --check` now checks this latest release.

Verification: 4 Python host-helper tests; 8 restart-specific bot/client cases; 31 total bot/queue/reminder/QR tests; the 10-case synthetic backend integration passed. All restart execution in tests was mocked. The actual protected Unix socket was tested from the canary and production container; valid authentication returns 200 and an invalid token returns 403. An isolated canary served admin and teacher pages and readiness. Production is healthy with the bot running. The real button was not pressed as a test, to avoid an extra production restart.

Deployment's coherent snapshots are in `/opt/davomat/audit-20261026/backups/cutover-20261026T083802-380026/`. The existing GitHub-primary persistence and other sites are retained.

Limitation: if the bot cannot receive or process any Telegram updates at all, its button cannot invoke the helper; SSH/Contabo recovery is still required. The helper is independent of the app, so it continues operating after the app is stopped by an accepted restart request. Completion messages are best effort if Telegram is unavailable.
