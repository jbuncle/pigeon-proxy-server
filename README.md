# Pigeon Proxy Server

![Pigeon](./resources/delivery-pigeon-small.png)

Pigeon Proxy Server is an all-in-one solution that efficiently proxies requests to multiple targets with built-in integrations for Docker, ModSecurity, and LetsEncrypt. 

Written in TypeScript, it uses the Express.js server and adds middleware (both pre-existing and custom) to create the complete solution.

It's designed to replace a setup of `nginx` (with Caching and ModSecurity), `nginx-proxy/nginx-proxy` and `nginx-proxy/acme-companion` that had become too restrictive/complicated.

*Still a work in progress*

## Features

### Current

- **Docker Integration**: The server automatically routes requests to running containers based on `VIRTUAL_HOST` and `VIRTUAL_PORT` labels on the containers.
- **LetsEncrypt**: LetsEncrypt certificates can be automatically generated and renewed for Docker containers using `LETSENCRYPT_HOST` and `LETSENCRYPT_EMAIL` labels on running containers.
- **ModSecurity**: The server integrates with libModSecurity to check and reject malicious requests.
- **Static Routes**: Watches static routes in a JSON file, allowing routing to locations outside of Docker
- **Caching**: Caches GET requests to filesystem

### TODO

- Automatically generate LetsEncrypt certificates for all domains (not just Docker).
- Allow definition of container running this app, so that it can determine which containers are accessible
- Compression?

## Running

### Run Locally in Docker

The recommended way to run the server is to use the included bash script to run it in a Docker container. To do this, run `./local-dev build-run`.

As this project uses GitHub Packages you will need to define the `GITHUB_TOKEN` variable with a `read:packages` personal access token from GitHub. 

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
| fixedRoutesFile  |                                        | (Optional) Path to a JSON file defining static/fixed routes                            |

Note: This project is still in development.
