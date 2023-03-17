import { Library } from 'ffi-napi';
import * as ref from 'ref-napi';
import { isNull, refType, types } from 'ref-napi';
import StructDi from 'ref-struct-di';
import { ModSecurityError } from './ModSecurityError';
import { Logger, LoggerInterface } from '@jbuncle/logging-js';

export const ModSecurityIntervention = StructDi(ref)({
    status: types.int,
    pause: types.int,
    url: types.CString,
    log: types.CString,
    disruptive: types.int,
});

// Define the ModSecurity C API Pointer types
const ModSecurityPtr = refType('void');
const RulesSetPtr = refType('void');
const TransactionPtr = refType('void');
const ErrorPtr = refType('void');
const voidPtr = refType('void');
const ModSecurityInterventionPtr = refType(ModSecurityIntervention);


/**
   * Define C Library functions.
   */
const BINDINGS = {
    msc_init: [ModSecurityPtr, []],
    msc_create_rules_set: [RulesSetPtr, []],
    msc_rules_add_file: [types.int, [RulesSetPtr, types.CString, ErrorPtr],],
    msc_new_transaction: [TransactionPtr, [ModSecurityPtr, RulesSetPtr]],
    msc_process_connection: [types.int, [TransactionPtr, types.CString, types.int, types.CString, types.int]],
    msc_process_uri: [types.int, [TransactionPtr, types.CString, types.CString, types.CString,]],
    msc_process_request_headers: [types.int, [TransactionPtr]],
    msc_process_response_headers: [types.int, [TransactionPtr]],
    msc_process_request_body: [types.int, [TransactionPtr]],
    msc_process_response_body: [types.int, [TransactionPtr]],
    msc_append_request_body: [types.int, [TransactionPtr, types.CString, types.size_t]],
    msc_append_response_body: [types.int, [TransactionPtr, types.CString, types.size_t]],
    msc_add_request_header: [types.int, [TransactionPtr, types.CString, types.CString]],
    msc_add_response_header: [types.int, [TransactionPtr, types.CString, types.CString]],
    msc_transaction_cleanup: [voidPtr, [TransactionPtr]],
    msc_process_logging: [types.int, [TransactionPtr]],
    msc_rules_dump: [types.int, [RulesSetPtr]],
    msc_intervention: [types.int, [TransactionPtr, ModSecurityInterventionPtr]],
};

/**
 * Wrapper class for the libModSecurity library.
 * 
 * Defines a subset of C library bindings for libModSecurity.
 * 
 * For reference see https://github.com/SpiderLabs/ModSecurity
 */
export class ModSecurity {
    private static logger: LoggerInterface = Logger.getLogger(`@jbuncle/pigeon-proxy-server/${ModSecurity.name}`);

    /**
     * Bindings to the native libModSecurity C library.
     */
    private readonly modSecurityLibrary: Record<keyof typeof BINDINGS, (...args: any[]) => any>;

    public constructor(modSecurityLibraryPath: string) {
        // Initialise bindings
        this.modSecurityLibrary = Library(modSecurityLibraryPath, BINDINGS);
    }

    /**
     * Initialises ModSecurity C API.
     *
     * @returns ModSecurity instance pointer.
     */
    public init(): Buffer {
        ModSecurity.logger.debug('msc_init');
        const modSec: Buffer = this.modSecurityLibrary.msc_init();
        if (isNull(modSec)) {
            throw new ModSecurityError('Failed to initialize ModSecurity');
        }
        return modSec;
    }

    /**
     * Create empty RuleSet.
     *
     * @returns RuleSet instance pointer.
     */
    public createRulesSet(): Buffer {
        ModSecurity.logger.debug('msc_create_rules_set');
        const ruleSetPtr: Buffer = this.modSecurityLibrary.msc_create_rules_set();
        if (isNull(ruleSetPtr)) {
            throw new ModSecurityError('Failed to create rules set');
        }
        return ruleSetPtr;
    }

    /**
     * Add rules from file to the RuleSet.
     *
     * @param ruleSetPtr The RuleSet pointer.
     * @param rulesFile Path to rules conf file, to add to RuleSet.
     *
     * @returns number of rules added.
     */
    public rulesAddFile(ruleSetPtr: Buffer, rulesFile: string): number {
        ModSecurity.logger.debug('msc_rules_add_file');
        const errorPtr = ref.alloc(types.CString);
        // Number of rules loaded, -1 if failed.
        const numberOfRules = this.modSecurityLibrary.msc_rules_add_file(ruleSetPtr, rulesFile, errorPtr);
        if (numberOfRules < 0) {
            const error = ref.get(errorPtr);
            throw new ModSecurityError(error);
        }
        return numberOfRules;
    }

    /**
     * Create a new "transaction".
     * 
     * "The transaction is the unit that will be used the inspect every request. It holds 
     * all the information for a given request."
     *
     * @param modSecPtr The ModSecurity pointer (from init())
     * @param ruleSetPtr The RuleSet pointer (from createRulesSet())
     *
     * @returns Transaction pointer
     */
    public newTransaction(modSecPtr: Buffer, ruleSetPtr: Buffer): Buffer {
        ModSecurity.logger.debug('msc_new_transaction');
        const transactionPtr: Buffer = this.modSecurityLibrary.msc_new_transaction(modSecPtr, ruleSetPtr);
        if (isNull(transactionPtr)) {
            throw new Error('Failed to create transaction');
        }
        return transactionPtr;
    }

    /**
     * Perform the analysis on the connection.
     *
     * @param transactionPtr Transaction pointer.
     * @param clientIp Client's IP address in text format.
     * @param clientPort Client's port
     * @param serverIp Server's IP address in text format.
     * @param serverPort Server's port
     */
    public processConnection(transactionPtr: Buffer, clientIp: string, clientPort: number, serverIp: string, serverPort: number): void {
        ModSecurity.logger.debug('msc_process_connection');
        if (this.modSecurityLibrary.msc_process_connection(transactionPtr, clientIp, clientPort, serverIp, serverPort) !== 1) {
            throw new ModSecurityError('msc_process_connection failed');
        }
    }

    /**
     * Perform the analysis on the URI and all the query string variables.
     *
     * @param transactionPtr Transaction pointer.
     * @param fullUrl Uri.
     * @param method Protocol (GET, POST, PUT).
     * @param httpVersion Http version (1.0, 1.2, 2.0).
     */
    public processUri(transactionPtr: Buffer, fullUrl: string, method: string, httpVersion: string): void {
        ModSecurity.logger.debug('msc_process_uri');
        if (this.modSecurityLibrary.msc_process_uri(transactionPtr, fullUrl, method, httpVersion) !== 1) {
            throw new ModSecurityError('msc_process_uri failed');
        }
    }

    /**
     * Adds a request header to the transaction.
     *
     * @param transactionPtr Transaction pointer.
     * @param key Header name.
     * @param value Header value.
     */
    public addRequestHeader(transactionPtr: Buffer, key: string, value: string): void {
        ModSecurity.logger.debug('msc_add_request_header');
        if (this.modSecurityLibrary.msc_add_request_header(transactionPtr, key, value) !== 1) {
            throw new ModSecurityError('msc_add_request_header failed');
        }
    }

    /**
     * Perform the analysis on the request readers.
     *
     * Remember to check for a possible intervention.
     * 
     * @param transactionPtr Transaction pointer.
     */
    public processRequestHeaders(transactionPtr: Buffer): void {
        ModSecurity.logger.debug('msc_process_request_headers');
        if (this.modSecurityLibrary.msc_process_request_headers(transactionPtr) !== 1) {
            throw new ModSecurityError('msc_process_request_headers failed');
        }
    }

    /**
     * Adds request body to be inspected.
     *
     * "While feeding ModSecurity remember to keep checking if there is an
     * intervention, Sec Language has the capability to set the maximum
     * inspection size which may be reached, and the decision on what to do
     * in this case is upon the rules."
     * 
     * @param transactionPtr Transaction pointer.
     * @param body The request body (or chunk of the request body).
     */
    public appendRequestBody(transactionPtr: Buffer, body: string): void {
        ModSecurity.logger.debug('msc_append_request_body');
        if (this.modSecurityLibrary.msc_append_request_body(transactionPtr, body, body.length) !== 1) {
            throw new ModSecurityError('msc_append_request_body failed');
        }
    }

    /**
     * Perform the analysis on the request body (if any).
     *
     * "This function perform the analysis on the request body. It is optional to
     * call that function. If this API consumer already know that there isn't a
     * body for inspect it is recommended to skip this step."
     * 
     * "It is necessary to "append" the request body prior to the execution
     * of this function."
     *
     * @param transactionPtr Transaction pointer.
     */
    public processRequestBody(transactionPtr: Buffer): void {
        ModSecurity.logger.debug('msc_process_request_body');
        if (this.modSecurityLibrary.msc_process_request_body(transactionPtr) !== 1) {
            throw new ModSecurityError('msc_process_request_body failed');
        }
    }

    /**
     * Adds a response header.
     *
     * @param transactionPtr Transaction pointer.
     * @param key Header name.
     * @param value Header value.
     */
    public addResponseHeader(transactionPtr: Buffer, key: string, value: string): void {
        ModSecurity.logger.debug('msc_add_response_header');
        if (this.modSecurityLibrary.msc_add_response_header(transactionPtr, key, value) !== 1) {
            throw new ModSecurityError('msc_add_response_header failed');
        }
    }

    /**
     * Perform the analysis on the response headers.
     *
     * @param transactionPtr Transaction pointer.
     */
    public processResponseHeaders(transactionPtr: Buffer): void {
        ModSecurity.logger.debug('msc_process_response_headers');
        if (this.modSecurityLibrary.msc_process_response_headers(transactionPtr) !== 1) {
            throw new ModSecurityError('msc_process_response_headers failed');
        }
    }

    /**
     * Adds response body to be inspected.
     *
     * @param transactionPtr Transaction pointer.
     * @param body The response body (or chunk of response body)
     */
    public appendResponseBody(transaction: Buffer, body: string): void {
        ModSecurity.logger.debug('msc_append_response_body');
        if (this.modSecurityLibrary.msc_append_response_body(transaction, body, body.length) !== 1) {
            throw new ModSecurityError('msc_append_response_body failed');
        }
    }

    /**
     * Perform the analysis on the response body (if any).
     *
     * @param transactionPtr Transaction pointer.
     */
    public processResponseBody(transactionPtr: Buffer): void {
        ModSecurity.logger.debug('msc_process_response_body');
        if (this.modSecurityLibrary.msc_process_response_body(transactionPtr) !== 1) {
            throw new ModSecurityError('msc_process_response_body failed');
        }
    }

    /**
     * Logging all information relative to this transaction.
     *
     * "At this point there is not need to hold the connection, the response can be
     * delivered prior to the execution of this function."
     *
     * @param transactionPtr Transaction pointer.
     */
    public processLogging(transactionPtr: Buffer): void {
        ModSecurity.logger.debug('msc_process_logging');
        if (this.modSecurityLibrary.msc_process_logging(transactionPtr) !== 1) {
            throw new ModSecurityError('msc_process_logging failed');
        }
    }

    /**
     * Removes all the resources allocated by a given Transaction.
     *
     * @param transactionPtr Transaction pointer.
     */
    public transactionCleanup(transactionPtr: Buffer): void {
        ModSecurity.logger.debug('msc_transaction_cleanup');
        if (this.modSecurityLibrary.msc_transaction_cleanup(transactionPtr) === 1) {
            throw new ModSecurityError('msc_transaction_cleanup failed');
        }
    }

    /**
     * Check if ModSecurity has anything to ask to the server.
     *
     * Intervention can generate a log event and/or perform a disruptive action.
     *
     * @param transactionPtr Transaction pointer.
     * @param interventionPtr Intervention pointer.
     *
     * @returns true if an intervention is required, false if not.
     */
    public intervention(transactionPtr: Buffer, interventionPtr: Buffer): boolean {
        ModSecurity.logger.debug('msc_intervention');
        return this.modSecurityLibrary.msc_intervention(transactionPtr, interventionPtr) === 1;
    }
}