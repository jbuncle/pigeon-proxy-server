FROM alpine as fetch-rules

RUN apk add --no-cache sed wget tar bash
# Install rules
RUN wget https://github.com/jbuncle/modsecruity-rules/archive/main.tar.gz && \
    tar -xzvf main.tar.gz && \
    rm main.tar.gz && \
    cd modsecruity-rules-main && \
    ./install-modsec-rules && \
    cd .. && \
    rm -rf modsecruity-rules-main

FROM node:17-slim as node-modsec

# Install dependencies
RUN apt-get update && \
    apt-get install -y git build-essential automake autoconf libtool wget curl libpcre3-dev python3 gcc libstdc++6 libmaxminddb-dev libgeoip-dev && \
    rm -rf /var/lib/apt/lists/*

# Build and install modsecurity with GeoIP and MaxMind support
RUN git clone --depth 1 -b v3/master --single-branch https://github.com/SpiderLabs/ModSecurity && \
    cd ModSecurity && \
    git submodule init && \
    git submodule update && \
    ./build.sh && \
    ./configure && \
    make && \
    make install && \
    rm -rf /ModSecurity

FROM node-modsec AS npm-install

WORKDIR /app
COPY . .

ARG GITHUB_TOKEN

RUN npm config set "@jbuncle:registry" "https://npm.pkg.github.com" && \
    npm config set //npm.pkg.github.com/:_authToken $GITHUB_TOKEN && \
    npm install && \
    npm rebuild && \
    rm ~/.npmrc


FROM node-modsec

COPY --from=fetch-rules /usr/local/modsecurity-rules /usr/local/modsecurity-rules
COPY --from=npm-install /app /app

CMD [ "npm", "run", "start" ]
VOLUME [ "/etc/letsencrypt" ]
ENTRYPOINT ["/app/docker-entrypoint.sh"]
