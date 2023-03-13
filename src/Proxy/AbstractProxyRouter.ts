import { IncomingMessage } from "http";
import { ProxyRouterI } from "./ProxyRouterI";



export abstract class AbstractProxyRouter implements ProxyRouterI {

    public async router(req: IncomingMessage): Promise<string | undefined> {
        const host: string = req.headers.host;
        const domain: string = host ? host.split(':')[0] : '';
        return await this.getRoute(domain);
    }

    protected abstract getRoute(domain: string): Promise<string | undefined>;
}
