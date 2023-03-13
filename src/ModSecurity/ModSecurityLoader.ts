import { Request, Response } from 'express';
import path from 'path';
import { InterventionError } from './InterventionError';
import { ModSecurity } from './ModSecurity';
import { ModSecurityTransaction } from './ModSecurityTransaction';
import { findModSec } from './ModSecurityUtil';




export class ModSecurityLoader {

    public constructor(
        private readonly libPath: string,
        private readonly ruleSetFile: string,
    ) {
        if (this.libPath === undefined) {
            throw new Error('Missing ModSecurity library');
        }
    }

    /**
     * Initialise and start ModSecurity and return Express middleware.

     */
    public createMiddleware() {


        const modSecurity = new ModSecurity(this.libPath);

        // Load the ModSecurity library and initialize it
        const modsec = modSecurity.init();

        // Create a rules set and add a rules file to it
        const ruleSet = modSecurity.createRulesSet();

        console.log('Initialised rules');
        // modsecurity.msc_rules_dump(ruleSet);


        const rulesFile: string = path.resolve(this.ruleSetFile);

        modSecurity.rulesAddFile(ruleSet, rulesFile);
        console.log('Loaded rules from file');

        // Define an Express.js route to handle incoming requests
        const middleware = (req: Request, res: Response, next) => {
            try {
                console.log('ModSec processing request');

                processRequest(req, res, next);
                console.log('ModSec passed on');

            } catch (e: unknown) {
                if (e instanceof InterventionError) {
                    console.warn(e.log);
                    if (e.url !== null) {
                        res.redirect(e.url)
                    }
                    if (e.status !== 200) {
                        res.status(e.status);
                        res.send(ModSecurityLoader.getErrorMessage(e.status))
                        res.end();
                    }
                }
                throw e;
            }
            console.log('ModSec middleware completed');
        }

        function processRequest(req, res, next) {

            const transaction = ModSecurityTransaction.create(modSecurity, modsec, ruleSet);

            try {

                transaction.processConnection(req.ip);

                const fullUrl = `${req.protocol}://${req.hostname}${req.originalUrl}`;
                transaction.processUri(fullUrl, req.method, req.httpVersion)

                transaction.processRequestHeaders(req.headers);
                transaction.processRequestBody(req.body);

                next();
                console.log('ModSec processed request');

                transaction.processResponseHeaders(res.headers);
                transaction.processResponseBody(res.body);
            } finally {
                transaction.finish();
            }
        }

        return middleware;
    }

    private static getErrorMessage(errorCode: number): string {
        switch (errorCode) {
            case 400:
                return "Bad Request";
            case 401:
                return "Unauthorized";
            case 403:
                return "Forbidden";
            case 404:
                return "Not Found";
            case 500:
                return "Internal Server Error";
            default:
                return "Unknown Error";
        }
    }
}

