/* eslint-disable @typescript-eslint/naming-convention */
// TODO: remove internal dependencies
import type { CertMonitorI } from "@jbuncle/letsencrypt-js";
import { BasicCertMonitorFactory } from "@jbuncle/letsencrypt-js";
import express from 'express';
import { ExpressChallengeHandler } from "./ExpressChallengeHandler";


export type CertMonitorOptions = {
    certFilePattern: string;
    keyFilePattern: string;
    caFilePattern: string;
    accountKeyPath: string;
}

/**
 * Create a CertMonitor based on running/started docker containers (that use required environment variables).
 */
export class CertMonitorFactory {

    public create(
        certOptions: CertMonitorOptions,
        staging: boolean,
        express: express.Application
    ): CertMonitorI {
        const options: CertMonitorOptions = certOptions;
        const { certFilePattern, keyFilePattern, caFilePattern, accountKeyPath } = options;
        const challengeHandler: ExpressChallengeHandler = new ExpressChallengeHandler();
        challengeHandler.bind(express);
        return new BasicCertMonitorFactory(
            [challengeHandler],
            certFilePattern,
            keyFilePattern,
            caFilePattern,
            accountKeyPath
        ).create(staging);
    }
}