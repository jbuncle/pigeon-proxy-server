import { ModSecurityError } from "./ModSecurityError";

/**
 * Represents a ModSecurity Intervention error.
 */
export class InterventionError extends ModSecurityError {


    public static fromIntervention(intervention) {

        return new InterventionError(intervention.status, intervention.pause !== 0, intervention.url, intervention.log);
    }

    public constructor(
        public readonly status: number,
        public readonly pause: boolean,
        public readonly url: string | null,
        public readonly log: string | null
    ) {
        super(log);
    }
}
