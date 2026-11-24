#!/bin/bash
set -euo pipefail
exec bash /opt/davomat/releases/20261026-restart/deploy/restart-control/deploy.sh "${1:---deploy}"
