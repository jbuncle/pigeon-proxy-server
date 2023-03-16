import fs from 'fs';
import path from 'path';
import { AbstractProxyRouter } from './AbstractProxyRouter';

/**
 * Request router which watches and uses files containing route definitions.
 */
export class FileRoutesRouter extends AbstractProxyRouter {

    private fileRoutes: Record<string, Record<string, string>> = {};
    private routes: Record<string, string> = {};

    public constructor() {
        super();
    }


    /**
     * Add and watch file.
     */
    public addFile(filePath: string) {
        const fileName: string = path.basename(filePath);

        fs.watch(filePath, async (eventType: string, eventFile: string) => {
            if (eventType === 'change' && eventFile === fileName) {
                try {
                    console.log('Loading route changes from', filePath);
                    await this.loadFile(filePath);
                } catch (e) {
                    console.error(e);
                }
            }
        });
        // Initial load
        this.loadFile(filePath);
    }


    private async loadFile(filePath: string) {
        const contents = await fs.promises.readFile(filePath, 'utf8');

        const json: Record<string, string> = JSON.parse(contents);

        this.fileRoutes[filePath] = json;
        this.flattenRoutes();
    }

    private flattenRoutes(): void {
        const newRoutes: Record<string, string> = {};

        for (const filePath in this.fileRoutes) {
            if (Object.prototype.hasOwnProperty.call(this.fileRoutes, filePath)) {
                const value: Record<string, string> = this.fileRoutes[filePath];

                for (const key in value) {
                    if (Object.prototype.hasOwnProperty.call(value, key)) {
                        const element = value[key];

                        newRoutes[key] = element;
                    }
                }
            }
        }

        this.routes = newRoutes;
    }


    protected async getRoute(domain: string): Promise<string> {
        return this.routes[domain];
    }

}