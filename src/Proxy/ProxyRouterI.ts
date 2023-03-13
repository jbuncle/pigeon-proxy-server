import { IncomingMessage } from "http";



export interface ProxyRouterI {
    router(req: IncomingMessage): Promise<string | undefined>;
}
