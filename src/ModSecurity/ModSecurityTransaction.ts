import { NULL } from 'ref-napi';
import { InterventionError } from './InterventionError';
import { ModSecurity, ModSecurityIntervention } from './ModSecurity';
import { Logger, LoggerInterface } from '@jbuncle/logging-js';
import { ModSecurityError } from './ModSecurityError';

/**
 * Represents a unit that will be used to inspect a single request.
 */
export class ModSecurityTransaction {


    private isClosed: boolean = false;

    private static logger: LoggerInterface = Logger.getLogger(`@jbuncle/pigeon-proxy-server/${ModSecurityTransaction.name}`);

    public static create(modSecurity: ModSecurity, modSecPtr: Buffer, ruleSetPtr: Buffer): ModSecurityTransaction {
        // Create a new transaction with the ModSecurity instance and rules set
        const transaction = modSecurity.newTransaction(modSecPtr, ruleSetPtr);

        const modSecurityTransaction: ModSecurityTransaction = new ModSecurityTransaction(modSecurity, transaction);
        modSecurityTransaction.processIntervention();
        return modSecurityTransaction;
    }

    private constructor(
        private readonly modSecurity: ModSecurity,
        private readonly transactionPtr
    ) { }


    public isOpen():boolean {
        return !this.isClosed;
    }
    /**
     * Check the connection info.
     *
     * @param clientIp 
     * @param clientPort 
     * @param serverIp 
     * @param serverPort 
     */
    public processConnection(clientIp: string, clientPort: number, serverIp: string, serverPort: number): void {
        this.assertOpen();
        // Process the transaction with the request and response data
        this.modSecurity.processConnection(this.transactionPtr, clientIp, clientPort, serverIp, serverPort);
        this.processIntervention();
    }

    private assertOpen(): void {
        if (this.isClosed) {
            throw new ModSecurityError('Transaction has been closed.');
        }
    }

    /**
     * Check request URL.
     *
     * @param fullUrl 
     * @param method 
     * @param httpVersion 
     */
    public processUri(fullUrl: string, method: string, httpVersion: string): void {
        this.assertOpen();
        this.modSecurity.processUri(this.transactionPtr, fullUrl, method, httpVersion)
        this.processIntervention();
    }

    /**
     * Check request headers.
     *
     * @param headers 
     */
    public processRequestHeaders(headers: Record<string, string>): void {
        this.assertOpen();
        for (const key in headers) {
            if (Object.prototype.hasOwnProperty.call(headers, key)) {
                const value = headers[key];
                this.modSecurity.addRequestHeader(this.transactionPtr, key, value);
                this.processIntervention();
            }
        }
        this.modSecurity.processRequestHeaders(this.transactionPtr)
        this.processIntervention();
    }

    public appendRequestBody(chunk: string): void {
        this.assertOpen();
        this.modSecurity.appendRequestBody(this.transactionPtr, chunk)
        this.processIntervention();
    }

    public processRequestBody(): void {
        this.assertOpen();
        this.modSecurity.processRequestBody(this.transactionPtr)
        this.processIntervention();
    }

    /**
     * Check response headers.
     *
     * @param headers 
     */
    public processResponseHeaders(headers: Record<string, string>): void {
        this.assertOpen();
        for (const key in headers) {
            if (Object.prototype.hasOwnProperty.call(headers, key)) {
                const value = headers[key];
                this.modSecurity.addResponseHeader(this.transactionPtr, key, value);
                this.processIntervention();
            }
        }
        this.modSecurity.processResponseHeaders(this.transactionPtr)
        this.processIntervention();
    }

    /**
     * Check response body.
     */
    public processResponseBody(): void {
        this.assertOpen();
        this.modSecurity.processResponseBody(this.transactionPtr)
        this.processIntervention();
    }

    public appendResponseBody(chunk: string) {
        this.assertOpen();
        this.modSecurity.appendResponseBody(this.transactionPtr, chunk);
        this.processIntervention();
    }

    /**
     * Complete the transaction.
     */
    public finish(): void {
        this.assertOpen();
        try {
            this.modSecurity.processLogging(this.transactionPtr);
            this.modSecurity.transactionCleanup(this.transactionPtr);
        } finally {
            this.isClosed = true;
        }
    }

    /**
     * Check if ModSecurity has determined if an "intervention" is required, and convert to an error if necessary.
     */
    private processIntervention() {
        const intervention: typeof ModSecurityIntervention = new ModSecurityIntervention({
            status: 200,
            url: NULL,
            log: NULL,
            disruptive: 0,
            pause: 0
        });

        const itPtr: Buffer = intervention.ref();
        const interventionRequired: boolean = this.modSecurity.intervention(this.transactionPtr, itPtr);
        if (interventionRequired) {
            ModSecurityTransaction.logger.info(`Intervention required ${JSON.stringify(intervention)}`);
            if (intervention.disruptive !== 0) {
                ModSecurityTransaction.logger.info(`Disruption required`);
                throw InterventionError.fromIntervention(intervention);
            }
        }
    }
}