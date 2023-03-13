import { AbstractProxyRouter } from "./AbstractProxyRouter";


export class ProxyRouter extends AbstractProxyRouter {

    private readonly routes: Record<string, string> = {};

    public constructor(
    ) {
        super();
    }

    public addRoute(domain: string, target: string): void {
        this.routes[domain] = target;
    }

    protected async getRoute(domain: string): Promise<string | undefined> {
        if (Object.prototype.hasOwnProperty.call(this.routes, domain)) {
            return this.routes[domain];
        }

        return undefined;
    }

}