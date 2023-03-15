import { NextFunction, Request, Response } from 'express';
import path from 'path';
import { InterventionError } from './InterventionError';
import { ModSecurity } from './ModSecurity';
import { ModSecurityTransaction } from './ModSecurityTransaction';
import { ModSecurityError } from './ModSecurityError';

export class ModSecurityLoader {

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
        console.log('Loaded rules from file', rulesFile);
    }

    private bindToRequest(transaction, req: Request, res: Response, next: NextFunction): void {
        req.setEncoding('utf8');

        req.on('data', function (chunk) {
            try {
                transaction.appendRequestBody(chunk);
            } catch (e) {
                next(e);
            }
        });

        req.on('end', function () {
            try {
                transaction.processRequestBody();
            } catch (e) {
                next(e);
            }
        });

    }
    private bindToResponse(transaction: ModSecurityTransaction, res: Response, next: NextFunction): void {
        res.on('data', function (chunk) {
            try {
                transaction.appendResponseBody(chunk);
            } catch (e) {
                next(e);
            }
        });
        res.on('end', function () {
            try {
                transaction.processResponseBody();
            } catch (e) {
                next(e);
            }
        });
        res.on("close", () => {
            transaction.finish();
        });
    }

    private async processRequest(req: Request, res: Response, next: NextFunction) {

        const transaction: ModSecurityTransaction = ModSecurityTransaction.create(this.modSecurity, this.modSecPtr, this.ruleSetPtr);

        const clientAddress: string = req.socket.remoteAddress;
        const clientPort: number = req.socket.remotePort;
        const serverAddress: string = req.socket.localAddress;
        const serverPort: number = req.socket.localPort;

        transaction.processConnection(clientAddress, clientPort, serverAddress, serverPort);

        const fullUrl: string = `${req.protocol}://${req.hostname}${req.originalUrl}`;
        transaction.processUri(fullUrl, req.method, req.httpVersion)

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

}

