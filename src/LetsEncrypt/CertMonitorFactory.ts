/* eslint-disable @typescript-eslint/naming-convention */
// TODO: remove internal dependencies
import { CertMonitorEvent, CertMonitorI } from "@jbuncle/letsencrypt-js";
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
        const certMonitor = new BasicCertMonitorFactory(
            [challengeHandler],
            certFilePattern,
            keyFilePattern,
            caFilePattern,
            accountKeyPath
        ).create(staging);


        // TODO: proper logging
        certMonitor.on(CertMonitorEvent.ERROR, (e) => {
            console.error(e);
        });
        certMonitor.on(CertMonitorEvent.SKIPPED, (domain: string) => {
            console.log('Skipped', domain);
        });
        certMonitor.on(CertMonitorEvent.GENERATED, (domain: string) => {
            console.log('Generated', domain);
        });

        return certMonitor;
    }
}