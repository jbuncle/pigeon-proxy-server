import type { AuthorizationI, ChallengeHandlerI, ChallengeI } from "@jbuncle/letsencrypt-js";
import { Logger, LoggerInterface } from "@jbuncle/logging-js";
import { NextFunction, Request, Response } from "express";

/**
 * Express Middleware for Handling Challenge Token.
 */
export class ExpressChallengeHandler implements ChallengeHandlerI {

    private static logger: LoggerInterface = Logger.getLogger(`@jbuncle/pigeon-proxy-server/${ExpressChallengeHandler.name}`);

    private static readonly CHALLENGE_PATH = '/.well-known/acme-challenge/';

    private readonly challengeTokens: Record<string, string> = {};

    public getTypes(): string[] {
        return ['http-01'];
    }

    public async create(authz: AuthorizationI, challenge: ChallengeI, keyAuthorization: string): Promise<boolean> {

        const token: string = challenge.token;

        this.challengeTokens[token] = keyAuthorization;
        ExpressChallengeHandler.logger.info(`Added challenge token '${token}'`);

        return true;
    }


    public async remove(authz: AuthorizationI, challenge: ChallengeI): Promise<boolean> {
        const token = challenge.token;

        delete this.challengeTokens[token];
        ExpressChallengeHandler.logger.info(`Removed challenge token '${token}'`);

        return true;
    }


    public createExpressHandler(): (req: Request, res: Response, next: NextFunction) => void {
        return (req: Request, res: Response, next: NextFunction): void => {
            const requestPath: string = req.path;
            if (!requestPath.startsWith(ExpressChallengeHandler.CHALLENGE_PATH)) {
                next();
                return;
            }


            const challengeToken: string = req.path.substring(ExpressChallengeHandler.CHALLENGE_PATH.length);
            if (!Object.prototype.hasOwnProperty.call(this.challengeTokens, challengeToken)) {
                ExpressChallengeHandler.logger.warning('Missing requested challenge token', challengeToken);
                next();
                return;
            }
            ExpressChallengeHandler.logger.notice('Handling challenge request', challengeToken);
            // Send challenge response
            res.status(200).send(this.challengeTokens[challengeToken]);
        };
    }
}
