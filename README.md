# Reverse Proxy Server

Reverse Proxy Server is an all-in-one solution for proxying requests to different targets with support for Docker, ModSecurity, and LetsEncrypt. It's written in TypeScript, predominantly using Express.js server with both pre-existing and custom middleware. It's designed to replace a setup of `nginx` (with Caching and ModSecurity), `nginx-proxy/nginx-proxy` and `nginx-proxy/acme-companion` that had become too restrictive/complicated.

## Features

### Current

- Docker Integration: The server automatically routes requests to running containers based on `VIRTUAL_HOST` and `VIRTUAL_PORT` labels on the containers.
- LetsEncrypt: LetsEncrypt certificates can be automatically generated and renewed for Docker containers using `LETSENCRYPT_HOST` and `LETSENCRYPT_EMAIL` labels on running containers.
- ModSecurity: The server integrates with libModSecurity to check and reject malicious requests.

### TODO

- FileSystem caching of static content.
- Automatically generate LetsEncrypt certificates for all domains (not just Docker).
- Allow configuration file to define static routes (i.e. routes not defined by Docker containers).

## Running

### Run Locally in Docker

The recommended way to run the server is to use the included bash script to run it in a Docker container. To do this, run `./local-dev build-run`.

### Development

To run the server natively on your development machine, you'll need to have `libModSecurity` installed. On Ubuntu, you can install it with `sudo apt-get install libmodsecurity-dev`.

Once you have `libModSecurity` installed, run `npm run start` to start the server. You may need to run `npm rebuild` first.

### Options

The following options are available when running the server:

| Option           | Default                                | Description                                                                            |
| ---------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| staging          | true                                   | Whether the environment is a staging one. This is currently only used for LetsEncrypt. |
| modSecurityLib   | *attempts to locate*                   | Path to the libmodsecurity.so library. Defaults to automatically trying to find it.    |
| modSecurityRules | /usr/local/modsecurity-rules/main.conf | Path to the ModSecurity rules file.                                                    |
| leAccountsDir    | /etc/letsencrypt/accounts              | The directory where LetsEncrypt accounts are stored.                                   |
| leCertDir        | /etc/letsencrypt/live                  | The directory where LetsEncrypt certificates are stored.                               |

Note: This project is still in development.