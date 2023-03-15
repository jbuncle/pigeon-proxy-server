import { NULL } from 'ref-napi';
import { InterventionError } from './InterventionError';
import { ModSecurity, ModSecurityIntervention } from './ModSecurity';

export class ModSecurityTransaction {


    public static create(modSecurity: ModSecurity, modsec: Buffer, ruleSet: Buffer): ModSecurityTransaction {
        // Create a new transaction with the ModSecurity instance and rules set
        const transaction = modSecurity.newTransaction(modsec, ruleSet);

        const modSecurityTransaction: ModSecurityTransaction = new ModSecurityTransaction(modSecurity, transaction);
        modSecurityTransaction.processIntervention();
        return modSecurityTransaction;
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

        const itPtr = intervention.ref();
        const interventionRequired: boolean = this.modSecurity.intervention(this.transactionPtr, itPtr);
        if (interventionRequired) {
            if (intervention.disruptive !== 0) {
                throw InterventionError.fromIntervention(intervention);
            }
        }
    }

    private constructor(
        private readonly modSecurity: ModSecurity,
        private readonly transactionPtr
    ) { }

    /**
     * Check the connection info.
     *
     * @param clientIp 
     * @param clientPort 
     * @param serverIp 
     * @param serverPort 
     */
    public processConnection(clientIp: string, clientPort: number, serverIp: string, serverPort: number): void {
        // Process the transaction with the request and response data
        this.modSecurity.processConnection(this.transactionPtr, clientIp, clientPort, serverIp, serverPort);
        this.processIntervention();
    }

    /**
     * Check request URL.
     *
     * @param fullUrl 
     * @param method 
     * @param httpVersion 
     */
    public processUri(fullUrl: string, method: string, httpVersion: string): void {
        this.modSecurity.processUri(this.transactionPtr, fullUrl, method, httpVersion)
        this.processIntervention();
    }

    /**
     * Check request headers.
     *
     * @param headers 
     */
    public processRequestHeaders(headers: Record<string, string>): void {
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
        this.modSecurity.appendRequestBody(this.transactionPtr, chunk)
        this.processIntervention();
    }

    public processRequestBody(): void {
        this.modSecurity.processRequestBody(this.transactionPtr)
        this.processIntervention();
    }

    /**
     * Check response headers.
     *
     * @param headers 
     */
    public processResponseHeaders(headers: Record<string, string>): void {
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
        this.modSecurity.processResponseBody(this.transactionPtr)
        this.processIntervention();
    }

    public appendResponseBody(chunk: string){
        this.modSecurity.appendResponseBody(this.transactionPtr, chunk);
        this.processIntervention();
    }

    /**
     * Complete the transaction.
     */
    public finish(): void {
        this.modSecurity.processLogging(this.transactionPtr);
        this.modSecurity.transactionCleanup(this.transactionPtr);
    }
}
