import { existsSync, mkdirSync } from "fs";
import path from "path";
import { CertMonitorOptions } from "./CertMonitorFactory";


export class LetsEncryptUtils {

    public constructor(
        private readonly leBaseDir: string,
    ){}
    public getCertOptions() {
        if (!existsSync(this.leBaseDir)) {
            mkdirSync(this.leBaseDir);
        }

        const certificateDir: string = path.resolve(this.leBaseDir, 'certs');
        if (!existsSync(certificateDir)) {
            mkdirSync(certificateDir);
        }

        const accountsDir: string = path.resolve(this.leBaseDir, 'accounts');
        if (!existsSync(accountsDir)) {
            mkdirSync(accountsDir);
        }


        const certOptions: CertMonitorOptions = {
            accountKeyPath: accountsDir,
            keyFilePattern: path.resolve(certificateDir, '%s.key'),
            certFilePattern: path.resolve(certificateDir, '%s.crt'),
            caFilePattern: path.resolve(certificateDir, '%s.chain.pem'),
        };
        return certOptions;
    }
}