/* eslint-disable @typescript-eslint/naming-convention */
import type { DockerInspectI } from "@jbuncle/docker-api-js";

/**
 * Fetch domains by looking at running containers for LETSENCRYPT_HOST and LETSENCRYPT_EMAIL environment variables.
 */
export class LeDomainsProvider {


    private static readonly DOCKERENV_HOST = `LETSENCRYPT_HOST`;

    private static readonly DOCKERENV_EMAIL = `LETSENCRYPT_EMAIL`;

    public constructor() { }

    /**
     * Extracts LetsEncrypt domain:email pairs from the containers using LETSENCRYPT_HOST and LETSENCRYPT_EMAIL environment variables.
     *
     * @returns Map of domains and associated emails extracted from running containers.
     */
    public getDomains(inspectInfos: DockerInspectI[]): Record<string, string> {

        return this.getDomainsFromInspectInfos(inspectInfos);
    }


    /**
     * Extract all LetsEncrypt domain names and admin emails from docker inspect data.
     * 
     * @param inspectInfos
     * @returns 
     */
    private getDomainsFromInspectInfos(
        inspectInfos: DockerInspectI[]
    ): Record<string, string> {
        const leDomains: Record<string, string> = {};
        for (const inspectInfo of inspectInfos) {
            const [host, email] = this.extractHostAndEmail(inspectInfo);
            if (host === undefined) {
                continue;
            }

            if (email === undefined) {
                throw new Error(`Found letsencrypt host '${host}' without associated email`);
            }

            const domainNames: string[] = host.split(`,`);
            for (const domainName of domainNames) {
                leDomains[domainName] = email;
            }
        }
        return leDomains;
    }

    /**
     * Extract hostname and email to use for LetsEncrypt.
     *
     * @param inspectInfo 
     * @returns 
     */
    private extractHostAndEmail(inspectInfo: DockerInspectI): [host: string | undefined, key: string | undefined] {
        let host: string | undefined = undefined;
        let email: string | undefined = undefined;

        const env: string[] = inspectInfo.Config.Env;
        if (this.isIterable(env)) {
            for (const value of env) {
                if (value.startsWith(`${LeDomainsProvider.DOCKERENV_HOST}=`)) {
                    host = value.split(`=`, 2)[1];
                    continue;
                }
                if (value.startsWith(`${LeDomainsProvider.DOCKERENV_EMAIL}=`)) {
                    email = value.split(`=`, 2)[1];
                }
            }
        }
        return [host, email];
    }

    private isIterable(variable): boolean {
        return variable !== null && Symbol.iterator in Object(variable)
    }
}