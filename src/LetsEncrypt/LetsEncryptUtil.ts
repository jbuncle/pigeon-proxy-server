import { existsSync, mkdirSync } from "fs";
import path from "path";
import { CertMonitorOptions } from "./CertMonitorFactory";


export class LetsEncryptUtils {

    public constructor(
        private readonly certDir: string,
        private readonly accountsDir: string,
    ) { }

    public getCertOptions(): CertMonitorOptions {
        if (!existsSync(this.certDir)) {
            mkdirSync(this.certDir, { recursive: true });
        }

        const certificateDir: string = path.resolve(this.certDir);
        if (!existsSync(certificateDir)) {
            mkdirSync(certificateDir, { recursive: true });
        }

        const accountsDir: string = path.resolve(this.accountsDir);
        if (!existsSync(accountsDir)) {
            mkdirSync(accountsDir, { recursive: true });
        }

        return {
            accountKeyPath: accountsDir,
            keyFilePattern: path.resolve(certificateDir, '%s.key'),
            certFilePattern: path.resolve(certificateDir, '%s.crt'),
            caFilePattern: path.resolve(certificateDir, '%s.chain.pem'),
        };
    }
}