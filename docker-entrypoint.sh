#!/bin/bash

function get_container_id {
    # Try to get the container ID from the mountinfo file
    id=$(grep -oP '.*\/var\/lib\/docker\/containers\/(.*?)\/hosts.*' /proc/self/mountinfo | sed -nE 's|.*\/var\/lib\/docker\/containers\/([0-9a-f]+).*|\1|p' 2>/dev/null)
    if [ -n "$id" ]; then
        echo "${id}"
        return
    fi

    # If all else fails, return an empty string
    echo ""
}

container_id=$(get_container_id)
if [ ! "${container_id}" == "" ]; then
    echo "Container ID: ${container_id}"
    export CONTAINER_ID=${container_id}
else
    echo "Container ID not found"
fi

#echo "HOSTNAME=${HOSTNAME}"

# Run the command
exec "$@"
