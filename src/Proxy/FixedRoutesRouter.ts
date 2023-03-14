import * as fs from "fs";
import { AbstractProxyRouter } from "./AbstractProxyRouter";


export class FixedRoutesRouter extends AbstractProxyRouter {

    private readonly routes: Record<string, string> = {};

    public constructor(
    ) {
        super();
    }

    public async addRoutesFromFile(file: string): Promise<void> {
        const content: string = await fs.promises.readFile(file, 'utf-8');
        const json: any = JSON.parse(content);

        for (const domain in json) {
            if (Object.prototype.hasOwnProperty.call(json, domain)) {
                const target = json[domain];
                this.addRoute(domain, target);
            }
        }

        return;
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

    public getRoutes(): Readonly<Record<string, string>> {
        return this.routes;
    }

}