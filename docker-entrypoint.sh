#!/bin/bash

# Get the container ID
CONTAINER_ID=$(cat /proc/self/cgroup | grep "docker" | sed s/\\//\\n/g | tail -1)

# Set the container ID as an environment variable
export CONTAINER_ID=$CONTAINER_ID


echo $CONTAINER_ID
# Run the command
exec "$@"
