#! /bin/bash
# Convenience script for building and starting up
set -e
echo $(pwd)

TAG=jbuncle/pigeon-proxy-server


push() {
    echo "Creating development tag from latest"
    docker tag ${TAG}:latest ${TAG}:development
    echo "Pushing development tag" 
    docker push ${TAG}:development
}

build() {
    # npm run build
    docker build -t ${TAG} .
}

run() {
    docker run --rm -it \
        --volume=/var/run/docker.sock:/var/run/docker.sock \
        --network=shared \
        -p 80:8080 \
        ${TAG}
}

case $1 in
    "build")
        build
    ;;
    "run")
        run
    ;;
    "push")
        push
    ;;
    "build-run")
        build
        run
    ;;
    "build-push")
        build
        push
    ;;
    "print-file")
        print-file
    ;;
    *)
        echo "Specify 'build', 'run', 'build-run'"
    ;;
esac