import path from "path";
import { SecureContext, SecureContextOptions, createSecureContext } from "tls";
import { format } from "util";
import * as fs from "fs";


export class SNICallbackFactory {

	public constructor(
		private readonly keyFilePattern: string,
		private readonly certFilePattern: string,
	) { }

	public create(): ((servername: string, cb: (err: Error | null, ctx?: SecureContext) => void) => void) | undefined {

		// Create handler to allow domain (CName) specific certificates
		return async (hostname, callback) => {
			// TODO: default cert?

			// TODO: check inputs including domain/CName

			const keyPath: string = format(this.keyFilePattern, path.basename(hostname));
			const certPath: string = format(this.certFilePattern, path.basename(hostname));

			// Generate certificate object dynamically based on the hostname
			try {
				const [key, cert] = await Promise.all([
					fs.promises.readFile(keyPath),
					fs.promises.readFile(certPath)
				]);

				console.log('fetching', keyPath, certPath);
				const certificate: SecureContextOptions = {
					key,
					cert
				};
				const secureContext: SecureContext = createSecureContext(certificate);
				callback(null, secureContext);
			} catch (e) {
				console.error(e);
				callback(e, null);
			}
		};
	}

}