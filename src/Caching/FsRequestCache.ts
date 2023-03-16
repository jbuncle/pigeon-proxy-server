


import { createHash } from 'crypto';
import fs, { Stats, existsSync } from 'fs';
import { OutgoingHttpHeaders } from 'http';
import path from 'path';

export type FetchedResponse = {
    data: Buffer;
    headers: Record<string, number | string | string[]>;
};

export type Response = FetchedResponse & {
    status: number;
}

export class FsRequestCache {

    public constructor(
        private readonly cacheTimeMs: number = 3600000,
        private readonly cacheBasePath: string = '/tmp/cache/pigeon-proxy/'
    ) {}

    /**
     * Write data to cache.
     * @param uri The full resource identifier.
     * @param responseData The response data to write 
     */
    public async write(uri: string, { data, headers }: Response): Promise<void> {
        const cachePath: string = this.getCacheFilePath(uri);
        try {
            await fs.promises.mkdir(path.dirname(cachePath), { recursive: true });
            void fs.promises.writeFile(cachePath, data);
            void fs.promises.writeFile(`${cachePath}.headers`, JSON.stringify(headers));
        } catch (err) {
            console.error(`Failed to cache ${uri}: ${err}`);
        }
    }

    /**
     * Fetch resource from cache.
     * @param uri The full resource identifier.
     * @returns The resource or undefined if the resource has expired or never existed.
     */
    public async fetch(uri: string): Promise<undefined | FetchedResponse> {
        const cachePath: string = this.getCacheFilePath(uri);
        if (fs.existsSync(cachePath)) {
            const isStale: boolean = this.isStale(cachePath);

            if (isStale) {
                // Cache file is stale, so delete it
                this.purgeFiles(cachePath);
                return undefined;
            }

            const cachedData: Buffer = fs.readFileSync(cachePath);
            const cachedHeaders: Buffer = fs.readFileSync(`${cachePath}.headers`);
            const headers: OutgoingHttpHeaders = JSON.parse(cachedHeaders.toString());

            return {
                headers: headers,
                data: cachedData,
            };
        }
        return undefined;
    }

    /**
     * Remove resource for given resource identifier.
     *
     * @param uri The full resource identifier.
     */
    public purge(uri: string): void {
        const cachePath: string = this.getCacheFilePath(uri);
        this.purgeFiles(cachePath);
    }

    private purgeFiles(cachePath: string): void {
        void this.purgeFile(cachePath);
        void this.purgeFile(`${cachePath}.headers`);
    }

    private async purgeFile(file: string): Promise<void> {
        if (existsSync(file)) {
            fs.promises.unlink(file);
        }
    }

    private isStale(cachePath: string) {
        const stats: Stats = fs.statSync(cachePath);
        const cacheAgeMs: number = Date.now() - stats.mtimeMs;

        return cacheAgeMs > this.cacheTimeMs;
    }

    private getCacheFilePath(uri: string): string {

        const hash: string = createHash('sha256').update(uri).digest('hex');

        const firstDir = hash.substring(0, 2); // Extract the first 2 characters from the hash
        const secondDir = hash.substring(2, 4); // Extract the next 2 characters from the hash
        const thirdDir = hash.substring(4, 6); // Extract the next 2 characters from the hash

        const filename = hash.substring(6); // Extract the remaining characters as the filename

        const nestedDir = path.join(firstDir, secondDir, thirdDir); // Join the extracted directories using path.join()

        return path.join(this.cacheBasePath, nestedDir, filename);
    }
}