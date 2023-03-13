import * as ref from 'ref-napi';
import { InterventionError } from './InterventionError';
import { ModSecurity, ModSecurityIntervention } from './ModSecurity';


export class ModSecurityTransaction {


    public static create(modSecurity: ModSecurity, modsec, ruleSet): ModSecurityTransaction {
        // Create a new transaction with the ModSecurity instance and rules set
        const transaction = modSecurity.newTransaction(modsec, ruleSet);
        if (transaction.isNull()) {
            throw new Error('Failed to create transaction');
        }
        const modSecurityTransaction: ModSecurityTransaction = new ModSecurityTransaction(modSecurity, transaction);
        modSecurityTransaction.processIntervention();
        return modSecurityTransaction;
    }

    private processIntervention() {
        const intervention: typeof ModSecurityIntervention = new ModSecurityIntervention({
            status: 200,
            url: ref.NULL,
            log: ref.NULL,
            disruptive: 0
        });

        const itPtr = intervention.ref();
        const interventionRequired = this.modSecurity.intervention(this.transaction, itPtr);
        if (interventionRequired !== 0) {
            if (intervention.disruptive !== 0) {
                throw InterventionError.fromIntervention(intervention);
            }
        }
    }

    private constructor(
        private readonly modSecurity: ModSecurity,
        private readonly transaction
    ) { }

    public processConnection(ip: string): void {
        // Process the transaction with the request and response data
        if (this.modSecurity.processConnection(this.transaction, ip) !== 1) {
            throw new Error('Failed msc_process_connection');
        }
        this.processIntervention();
    }

    public processUri(fullUrl: string, method: string, httpVersion: string): void {
        if (this.modSecurity.processUri(this.transaction, fullUrl, method, httpVersion) !== 1) {
            throw new Error('Failed msc_process_uri');
        }
        this.processIntervention();
    }

    public processRequestHeaders(headers: Record<string, string>): void {
        for (const key in headers) {
            if (Object.prototype.hasOwnProperty.call(headers, key)) {
                const value = headers[key];
                this.modSecurity.addRequestHeader(this.transaction, key, value);
                this.processIntervention();
            }
        }
        if (this.modSecurity.processRequestHeaders(this.transaction) !== 1) {
            throw new Error('Failed msc_process_request_headers');
        }
        this.processIntervention();
    }

    public processRequestBody(body: string): void {
        if (body) {
            this.modSecurity.appendRequestBody(this.transaction, body);
        } else {
            console.log('No request body');
        }

        if (this.modSecurity.processRequestBody(this.transaction) !== 1) {
            throw new Error('Failed msc_process_request_body');
        }
        this.processIntervention();
    }

    public processResponseHeaders(headers: Record<string, string>): void {
        for (const key in headers) {
            if (Object.prototype.hasOwnProperty.call(headers, key)) {
                const value = headers[key];
                this.modSecurity.addResponseHeader(this.transaction, key, value);
                this.processIntervention();
            }
        }
        if (this.modSecurity.processResponseHeaders(this.transaction) !== 1) {
            throw new Error('Failed msc_process_response_headers');
        }
        this.processIntervention();
    }

    public processResponseBody(body: string): void {
        if (body) {
            this.modSecurity.appendResponseBody(this.transaction, body);
        } else {
            console.log('No response body');
        }

        if (this.modSecurity.processResponseBody(this.transaction) !== 1) {
            throw new Error('Failed msc_process_response_body');
        }
        this.processIntervention();
    }

    public finish(): void {
        this.modSecurity.processLogging(this.transaction);
        this.modSecurity.transactionCleanup(this.transaction);
    }
}
