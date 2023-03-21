import { Logger, LoggerInterface } from '@jbuncle/logging-js';
import path from "path";
import { SecureContext, SecureContextOptions, createSecureContext } from "tls";
import { format } from "util";
import * as fs from "fs";


export class SNICallbackFactory {

	private static logger: LoggerInterface = Logger.getLogger(`@jbuncle/pigeon-proxy-server/${SNICallbackFactory.name}`);

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
				SNICallbackFactory.logger.debug(`Fetching key '${keyPath}' and cert '${certPath}'`);
				const [key, cert] = await Promise.all([
					fs.promises.readFile(keyPath),
					fs.promises.readFile(certPath)
				]);

				const secureContextOptions: SecureContextOptions = {
					key,
					cert
				};
				const secureContext: SecureContext = createSecureContext(secureContextOptions);
				callback(null, secureContext);
			} catch (e) {
				SNICallbackFactory.logger.warning(`Error when looking up SSL Certificate for '${hostname}': ${e}`);
				callback(e, null);
			}
		};
	}

}