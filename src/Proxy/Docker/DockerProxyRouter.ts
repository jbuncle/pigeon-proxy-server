import { DockerInspectI } from "@jbuncle/docker-api-js";
import { AbstractProxyRouter } from "../AbstractProxyRouter";
import { DockerMonitor } from "./DockerMonitor";
import { Logger, LoggerInterface } from "@jbuncle/logging-js";


export class DockerProxyRouter extends AbstractProxyRouter {

    private static logger: LoggerInterface = Logger.getLogger(`@jbuncle/pigeon-proxy-server/${DockerProxyRouter.name}`);

    private routes: Record<string, string> = {};

    protected async getRoute(domain: string): Promise<string | undefined> {
        DockerProxyRouter.logger.info('Getting route', domain);
        if (Object.prototype.hasOwnProperty.call(this.routes, domain)) {

            const target: string = this.routes[domain];

            DockerProxyRouter.logger.info(`Found route ${domain} => ${target}`);
            return target;
        }
        return undefined;
    }

    public constructor(
    ) {
        super();
    }

    public bind(dockerMonitor: DockerMonitor) {

        dockerMonitor.onChange((inspectInfos: DockerInspectI[]) => {
            this.updateRoutes(inspectInfos);
        });
    }


    private async updateRoutes(inspectInfos: DockerInspectI[]) {

        const routes = {};

        for (const inspectInfo of inspectInfos) {
            const env = this.getEnv(inspectInfo);

            if (!Object.prototype.hasOwnProperty.call(env, 'VIRTUAL_HOST')) {
                continue;
            }

            const domains: string[] = env['VIRTUAL_HOST'].split(',');

            const targetPort: string = this.getNetworkPort(inspectInfo, env);
            const ipAddress = this.getIp(inspectInfo);

            // TODO: allow ssl to be set by container
            let protocol = 'http';
            if (targetPort === '443' || targetPort === '8443') {
                protocol = 'https';
            }
            for (const domain of domains) {
                routes[domain] = `${protocol}://${ipAddress}:${targetPort}`;
            }
        }

        this.routes = routes;
        console.log('Updated docker routes', this.routes)

    }

    private getNetworkPort(inspectInfo: DockerInspectI, env: Record<string, string>): string {

        const targetPort: string = env['VIRTUAL_PORT'];

        if (targetPort !== undefined) {
            return targetPort;
        }
        const networkPorts = inspectInfo.NetworkSettings.Ports;
        if (networkPorts) {
            for (const port in networkPorts) {
                // TODO: assess ports to find most suitable
                if (Object.prototype.hasOwnProperty.call(networkPorts, port)) {
                    const portNumber = port.split('/')[0];

                    return portNumber;
                }
            }
        }
        return '80';
    }

    private getEnv(inspectInfo: DockerInspectI): Record<string, string> {
        const env = {};
        for (const envVal of inspectInfo.Config.Env) {
            const parts = envVal.split('=', 2);
            env[parts[0]] = parts[1];
        }

        return env;
    }


    private getIp(inspectInfo: DockerInspectI): string | undefined {
        const networks = inspectInfo.NetworkSettings.Networks;
        for (const networkKey in networks) {
            // TODO: check if network is accessible (shared) with the currently running container
            if (Object.prototype.hasOwnProperty.call(networks, networkKey)) {
                const network = networks[networkKey];
                return network.IPAddress;
            }
        }
        return undefined;
    }


}