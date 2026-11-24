#!/bin/bash
# Builds and tests are separate. Only the image recorded by the completed audit can be deployed.
set -euo pipefail
exec bash /opt/davomat/releases/20261026-audit/deploy/audit-20261026/deploy.sh "${1:---deploy}"
