
import { NextFunction, Request, Response } from 'express';
import { FetchedResponse, FsRequestCache } from './FsRequestCache';

export class RequestCache {

    public constructor(
        private readonly fsRequestCache: FsRequestCache = new FsRequestCache(),
    ) { }

    public createMiddleware() {

        return async (req: Request, res: Response, next: NextFunction) => {
            const fullUrl: string = `${req.protocol}://${req.hostname}${req.originalUrl}`;
            if (req.method !== 'GET' || req.headers['cache-control'] === 'no-cache') {
                console.log('Skipped caching', fullUrl)
                // Only cache GET requests
                next();
                return;
            }

            try {
                // Fetch data from response
                const cached: FetchedResponse | undefined = await this.fsRequestCache.fetch(fullUrl);
                if (cached !== undefined) {
                    cached.headers['x-cache-status'] = 'HIT';
                    res.set(cached.headers);
                    res.send(cached.data);
                    return;
                }
            } catch (err) {
                // Cache file doesn't exist or there was an error reading it.
                console.error(err);
            }

            // Cache file is stale or doesn't exist, so cache the response data.
            this.captureResponse(res, fullUrl);

            next();
        };
    }

    /**
     * Capture data written to the Response object and write to cache.
     *
     * @param res 
     * @param fullUrl 
     */
    private captureResponse(res: Response<any, Record<string, any>>, fullUrl: string) {

        // TODO: write to temporary file, then move the file to required destination when complete
        // Writing to memory like this will hit OOM issues
        // Similarly, should have a limit
        let responseData: Buffer = Buffer.from('');
        let stopCache: boolean = false;

        this.bindToResponse(res, (data: any) => {
            if (stopCache) {
                return data;
            }

            responseData = Buffer.concat([responseData, data]);
            if (responseData.byteLength > 62914560) {
                stopCache = true;
                responseData = Buffer.of(0);
            }
            return data;
        }, (data: any) => {

            if (stopCache) {
                return data;
            }

            if (data !== undefined) {
                if (Buffer.isBuffer(data)) {
                    responseData = Buffer.concat([responseData, data]);
                } else {
                    responseData = Buffer.concat([responseData, Buffer.from(data)]);
                }
            }

            const body: Buffer = responseData;

            if (res.statusCode === 200) {
                try {
                    void this.fsRequestCache.write(fullUrl, { data: body, headers: res.getHeaders(), status: res.statusCode });
                } catch (err) {
                    console.error(`Failed to cache ${fullUrl}: ${err}`);
                }
            } else {
                this.fsRequestCache.purge(fullUrl);
            }

            return data;
        });
    }

    private bindToResponse(
        res: Response,
        onWrite: <T>(data: any) => T,
        onEnd: <T>(data: any) => T
    ): void {

        const originalWrite = res.write;
        res.write = (data, ...args: any) => {
            // Buffer.concat(responseData, data);
            data = onWrite(data);
            return originalWrite.apply(res, [data, ...args]);
        };

        const originalEnd = res.end;
        res.end = (data: any, ...args: any) => {
            data = onEnd(data);
            return originalEnd.apply(res, [data, ...args]);
        };
    }
}