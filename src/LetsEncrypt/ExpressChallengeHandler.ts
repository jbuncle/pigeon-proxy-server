import type { AuthorizationI, ChallengeHandlerI, ChallengeI } from "@jbuncle/letsencrypt-js";
import { Request, Response } from "express";
import express from 'express';

export class ExpressChallengeHandler implements ChallengeHandlerI {

    public getTypes(): string[] {
        return ['http-01'];
    }

    public async create(authz: AuthorizationI, challenge: ChallengeI, keyAuthorization: string): Promise<boolean> {

        const token: string = challenge.token;

        this.challengeTokens[token] = keyAuthorization;
        console.log('Added challenge token', token);


        return true;
    }

    private static readonly CHALLENGE_PATH = '/.well-known/acme-challenge/';

    public async remove(authz: AuthorizationI, challenge: ChallengeI): Promise<boolean> {
        const token = challenge.token;

        delete this.challengeTokens[token];
        console.log('Removed challenge token', token);

        return true;
    }

    private readonly challengeTokens: Record<string, string> = {};

    public bind(express: express.Application) {
        express.use(this.createExpressHandler());
    }

    private createExpressHandler(): (req: Request, res: Response, next: express.NextFunction) => void {
        return (req, res, next) => {
            if (!req.path.startsWith(ExpressChallengeHandler.CHALLENGE_PATH)) {
                next();
                return;
            }


            const challengeToken: string = req.path.substring(ExpressChallengeHandler.CHALLENGE_PATH.length);
            if (!Object.prototype.hasOwnProperty.call(this.challengeTokens, challengeToken)) {
                console.warn('Missing requested challenge token', challengeToken);
                next();
                return;
            }
            console.log('Handling challenge request', challengeToken);
            // Send challenge response
            res.status(200).send(this.challengeTokens[challengeToken]);
        };
    }
}
