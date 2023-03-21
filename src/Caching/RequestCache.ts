
import { Logger, LoggerInterface } from '@jbuncle/logging-js';
import { NextFunction, Request, Response } from 'express';
import { FetchedResponse, FsRequestCache } from './FsRequestCache';
import { RequestHandler } from 'http-proxy-middleware';

export class RequestCache {

    private static logger: LoggerInterface = Logger.getLogger(`@jbuncle/pigeon-proxy-server/${RequestCache.name}`);

    public constructor(
        private readonly fsRequestCache: FsRequestCache = new FsRequestCache(),
    ) { }

    public createMiddleware(): RequestHandler {

        return async (req: Request, res: Response, next: NextFunction) => {
            const acceptEncoding: string = String(req.headers['accept-encoding']);
            const acceptLanguage: string = String(req.headers['accept-language']);
            const uri: string = `${acceptEncoding.replace(' ', '')};${acceptLanguage.replace(' ', '')};${req.protocol}://${req.hostname}${req.originalUrl}`;

            if (req.method !== 'GET'
                || req.headers['cache-control'] === 'no-cache'
                || req.headers.authorization !== undefined
            ) {
                RequestCache.logger.debug(`Skipped caching ${uri}`)
                // Only cache GET requests
                next();
                return;
            }

            try {
                // Fetch data from response
                const cached: FetchedResponse | undefined = await this.fsRequestCache.fetch(uri);
                if (cached !== undefined) {
                    RequestCache.logger.debug(`Returning response from cache for '${uri}'`);
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
            this.captureResponse(res, uri);

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
                    RequestCache.logger.debug(`Failed to cache ${fullUrl} - ${err.message}`, { error: err })
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