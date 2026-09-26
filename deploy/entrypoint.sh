#!/bin/sh
# Seeds the knowledge base on first boot (while the data volume is still empty), then starts the server.
set -e

if [ "${AUTO_SEED:-true}" = "true" ]; then
    if [ -z "$(find data/vector_store -mindepth 1 ! -name .gitkeep 2>/dev/null | head -n 1)" ]; then
        echo "[entrypoint] Vector store empty, running scripts/demo_seed.py ..."
        python scripts/demo_seed.py
    else
        echo "[entrypoint] Vector store already populated, skipping seed."
    fi
fi

exec "$@"
