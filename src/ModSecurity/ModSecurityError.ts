/**
 * Represent a generic ModSecurity error.
 */
export class ModSecurityError extends Error {

    public constructor(msg) {
        super(msg);
    }
}
