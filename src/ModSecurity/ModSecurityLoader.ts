import { NextFunction, Request, Response } from 'express';
import path from 'path';
import { ModSecurity } from './ModSecurity';
import { ModSecurityError } from './ModSecurityError';
import { ModSecurityTransaction } from './ModSecurityTransaction';
import { Logger, LoggerInterface } from '@jbuncle/logging-js';

export class ModSecurityLoader {

    private static logger: LoggerInterface = Logger.getLogger(`@jbuncle/pigeon-proxy-server/${ModSecurityLoader.name}`);

    private modSecPtr: Buffer;
    private ruleSetPtr: Buffer;
    private modSecurity: ModSecurity;

    public constructor(
        private readonly libPath: string,
        private readonly ruleSetFile: string,
    ) {
        if (this.libPath === undefined) {
            throw new ModSecurityError('Missing ModSecurity library');
        }
    }

    public init() {

        this.modSecurity = new ModSecurity(this.libPath);

        // Load the ModSecurity library and initialize it
        this.modSecPtr = this.modSecurity.init();

        // Create a rules set and add a rules file to it
        this.ruleSetPtr = this.modSecurity.createRulesSet();

        const rulesFile: string = path.resolve(this.ruleSetFile);
        this.modSecurity.rulesAddFile(this.ruleSetPtr, rulesFile);
        ModSecurityLoader.logger.info('Loaded rules from file', rulesFile);
    }

    /**
     * Initialise and start ModSecurity and return Express middleware.
     */
    public createMiddleware() {
        // Define an Express.js route to handle incoming requests
        return async (req: Request, res: Response, next) => {
            try {
                await this.processRequest(req, res, next);
            } catch (e: unknown) {
                next(e);
            }
        }
    }

    private bindToRequest(transaction: ModSecurityTransaction, req: Request, res: Response, next: NextFunction): void {
        req.setEncoding('utf8');

        this.bindToRequestStream(req, (data: any) => {
            try {
                // Data might be written after we've closed
                if (transaction.isOpen()) {
                    transaction.appendRequestBody(data);
                }
            } catch (e) {
                next(e);
            }
        }, (data?) => {
            try {
                // Data might be written after we've closed
                if (transaction.isOpen()) {
                    if (data) {
                        transaction.appendRequestBody(data);
                    }
                    ModSecurityLoader.logger.debug('Processing request body');
                    transaction.processRequestBody();
                }
            } catch (e) {
                next(e);
            }
        });
    }

    private bindToRequestStream(
        req: Request,
        onData: <T>(data: any) => void,
        onEnd: <T>(data: any) => void
    ) {
        req.on('data', function (chunk) {
            onData(chunk);
        });

        req.on('end', function (data) {
            onEnd(data);
        });
    }

    private bindToResponse(transaction: ModSecurityTransaction, res: Response, next: NextFunction): void {
        this.bindToResponseStream(res, (data: any) => {
            if (transaction.isOpen()) {
                transaction.appendResponseBody(data);
                ModSecurityLoader.logger.debug('Response written');
            }

            return data;
        }, (data: any) => {
            if (transaction.isOpen()) {
                ModSecurityLoader.logger.debug('Response ended');
                if (data !== undefined) {
                    transaction.appendResponseBody(data);
                }
                ModSecurityLoader.logger.debug('Processing response body');
                transaction.processResponseBody();

                transaction.finish();
            }
            return data;
        });
    }

    private bindToResponseStream(
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

    private async processRequest(req: Request, res: Response, next: NextFunction) {

        const transaction: ModSecurityTransaction = ModSecurityTransaction.create(this.modSecurity, this.modSecPtr, this.ruleSetPtr);

        const clientAddress: string = req.socket.remoteAddress;
        const clientPort: number = req.socket.remotePort;
        const serverAddress: string = req.socket.localAddress;
        const serverPort: number = req.socket.localPort;

        ModSecurityLoader.logger.debug('Processing connection');
        transaction.processConnection(clientAddress, clientPort, serverAddress, serverPort);

        ModSecurityLoader.logger.debug('Processing URI');
        const fullUrl: string = `${req.protocol}://${req.hostname}${req.originalUrl}`;
        transaction.processUri(fullUrl, req.method, req.httpVersion)


        ModSecurityLoader.logger.debug('Processing request headers');
        // TODO: use req.rawHeaders
        transaction.processRequestHeaders(this.flattenHeaders(req.headers));

        this.bindToRequest(transaction, req, res, next);
        this.bindToResponse(transaction, res, next);

        next();
    }

    /**
     * Flatten header arrays.
     * @param headers 
     * @returns 
     */
    private flattenHeaders(headers: Record<string | number, string | string[] | number>): Record<string | number, string> {

        const flattened: Record<string | number, string> = {};

        for (const key in headers) {
            if (Object.prototype.hasOwnProperty.call(headers, key)) {
                const value: string | string[] | number = headers[key];
                if (Array.isArray(value)) {
                    flattened[key] = value.join(',')
                } else {
                    flattened[key] = value.toString();
                }
            }
        }
        return flattened;
    }

}

