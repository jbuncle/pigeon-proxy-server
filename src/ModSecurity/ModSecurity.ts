import * as ffi from 'ffi-napi';
import * as ref from 'ref-napi';
import StructDi from 'ref-struct-di';

const struct = StructDi(ref);
export const ModSecurityIntervention = struct({
    status: ref.types.int,
    pause: ref.types.int,
    url: ref.types.CString,
    log: ref.types.CString,
    disruptive: ref.types.int,
});

// Define the ModSecurity C API types
const ModSecurityPtr = ref.refType('void');
const RulesSetPtr = ref.refType('void');
const TransactionPtr = ref.refType('void');
const voidPtr = ffi.types.void;


/**
 * Wrapper for libModSecurity library.
 */
export class ModSecurity {

    private readonly modsecurity;

    public constructor(lib: string) {
        console.log('Setting bindings for modsecurity');

        this.modsecurity = ffi.Library(lib, {
            msc_init: [ModSecurityPtr, []],
            msc_create_rules_set: [RulesSetPtr, []],
            msc_rules_add_file: [ffi.types.int, ["pointer", "string", "pointer"],],
            msc_new_transaction: [TransactionPtr, ['pointer', 'pointer']],
            msc_process_connection: [ffi.types.int, ['pointer', 'string']],
            msc_process_uri: [ffi.types.int, [TransactionPtr, 'string', 'string', 'string']],
            msc_process_request_headers: [ffi.types.int, [TransactionPtr]],
            msc_process_response_headers: [ffi.types.int, [TransactionPtr]],
            msc_process_request_body: [ffi.types.int, [TransactionPtr]],
            msc_process_response_body: [ffi.types.int, [TransactionPtr]],
            msc_append_request_body: [ffi.types.int, [TransactionPtr, 'string', 'size_t']],
            msc_append_response_body: [ffi.types.int, [TransactionPtr, 'string', 'size_t']],
            msc_add_request_header: [ffi.types.int, [TransactionPtr, ffi.types.CString, ffi.types.CString]],
            msc_add_response_header: [ffi.types.int, [TransactionPtr, ffi.types.CString, ffi.types.CString]],
            msc_transaction_cleanup: [voidPtr, [TransactionPtr]],
            msc_process_logging: [ffi.types.int, [TransactionPtr]],
            msc_rules_dump: [ffi.types.int, [RulesSetPtr]],
            msc_intervention: [ref.types.int, [TransactionPtr, ref.refType(ModSecurityIntervention)]],
        });
    }

    public init() {
        const modsec = this.modsecurity.msc_init();
        if (modsec.isNull()) {
            throw new Error('Failed to initialize ModSecurity');
        }
        return modsec;
    }

    public createRulesSet() {
        const ruleSet = this.modsecurity.msc_create_rules_set();
        if (ruleSet.isNull()) {
            throw new Error('Failed to create rules set');
        }
        return ruleSet;
    }

    public rulesAddFile(ruleSet, rulesFile) {
        const errorPtr = ref.alloc(ref.types.CString);
        // Number of rules loaded, -1 if failed.
        const numberOfRules = this.modsecurity.msc_rules_add_file(ruleSet, rulesFile, errorPtr);
        if (numberOfRules < 0) {
            const error = ref.get(errorPtr);
            throw new Error(error);
        }
        return numberOfRules;
    }

    public newTransaction(modsec, ruleSet) {
        return this.modsecurity.msc_new_transaction(modsec, ruleSet);
    }

    public processConnection(transaction, ip: string) {
        return this.modsecurity.msc_process_connection(transaction, ip);
    }

    public processUri(transaction, fullUrl, method, httpVersion) {
        return this.modsecurity.msc_process_uri(transaction, fullUrl, method, httpVersion);
    }

    public addRequestHeader(transaction, key, value) {
        return this.modsecurity.msc_add_request_header(transaction, key, value);
    }

    public processRequestHeaders(transaction) {
        return this.modsecurity.msc_process_request_headers(transaction);
    }

    public appendRequestBody(transaction, body: string) {
        return this.modsecurity.msc_append_request_body(transaction, body, body.length);
    }

    public processRequestBody(transaction) {
        return this.modsecurity.msc_process_request_body(transaction);
    }

    public addResponseHeader(transaction, key, value) {
        return this.modsecurity.msc_add_response_header(transaction, key, value);
    }

    public processResponseHeaders(transaction) {
        return this.modsecurity.msc_process_response_headers(transaction);
    }

    public appendResponseBody(transaction, body) {
        return this.modsecurity.msc_append_response_body(transaction, body, body.length);
    }

    public processResponseBody(transaction) {
        return this.modsecurity.msc_process_response_body(transaction);
    }

    public processLogging(transaction) {
        return this.modsecurity.msc_process_logging(transaction);
    }

    public transactionCleanup(transaction) {
        return this.modsecurity.msc_transaction_cleanup(transaction);
    }

    public intervention(transaction, itPtr) {
        return this.modsecurity.msc_intervention(transaction, itPtr);
    }
}