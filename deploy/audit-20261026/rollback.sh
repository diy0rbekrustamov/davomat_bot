#!/bin/bash
set -euo pipefail
exec bash /opt/davomat/releases/20261026-audit/deploy/audit-20261026/deploy.sh --rollback
