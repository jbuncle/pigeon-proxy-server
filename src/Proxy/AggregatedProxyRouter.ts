import { IncomingMessage } from "http";
import { ProxyRouterI } from "./ProxyRouterI";



export class AggregatedProxyRouter implements ProxyRouterI {


    public constructor(
        private readonly routers: ProxyRouterI[]
    ) {
    }


    public async router(req: IncomingMessage): Promise<string | undefined> {

        for (const router of this.routers) {
            const result: string | undefined = await router.router(req);
            if (result !== undefined) {
                return result;
            }
        }
        return undefined;
    }


}