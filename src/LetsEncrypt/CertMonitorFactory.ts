/* eslint-disable @typescript-eslint/naming-convention */
// TODO: remove internal dependencies
import { BasicCertMonitorFactoryOptions, CertMonitorEvent, CertMonitorI } from "@jbuncle/letsencrypt-js";
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
        challengeHandler: ExpressChallengeHandler,
        termsOfServiceAgreed: boolean,
        skipChallengeVerification: boolean = false,
    ): CertMonitorI {
        const options: CertMonitorOptions = certOptions;
        const { certFilePattern, keyFilePattern, caFilePattern, accountKeyPath } = options;
        const basicCertMonitorFactoryOptions: BasicCertMonitorFactoryOptions  = {
            handlers: [challengeHandler],
            certFilePathFormat: certFilePattern,
            keyFilePathFormat: keyFilePattern,
            caFilePathFormat: caFilePattern,
            accountKeyDir: accountKeyPath,
            termsOfServiceAgreed,
            skipChallengeVerification
        };

        return new BasicCertMonitorFactory(basicCertMonitorFactoryOptions).create(staging);
    }
}