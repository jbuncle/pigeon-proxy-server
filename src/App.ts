import { DockerInspectI } from '@jbuncle/docker-api-js';
import { CertMonitorI } from '@jbuncle/letsencrypt-js';
import express from 'express';
import http, { Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { Filter, Options, createProxyMiddleware } from 'http-proxy-middleware';
import https, { Server as HttpsServer, ServerOptions } from 'https';
import morgan from 'morgan';
import { RequestCache } from './Caching/RequestCache';
import { CertMonitorFactory, CertMonitorOptions } from './LetsEncrypt/CertMonitorFactory';
import { LeDomainsProvider } from './LetsEncrypt/DockerDomainsProvider';
import { LetsEncryptUtils } from './LetsEncrypt/LetsEncryptUtil';
import { InterventionError } from './ModSecurity/InterventionError';
import { ModSecurityLoader } from './ModSecurity/ModSecurityLoader';
import { findModSec } from './ModSecurity/ModSecurityUtil';
import { AggregatedProxyRouter } from './Proxy/AggregatedProxyRouter';
import { DockerMonitor, createDockerMonitor } from './Proxy/DockerMonitor';
import { DockerProxyRouter } from './Proxy/DockerProxyRouter';
import { FileRoutesRouter } from './Proxy/FileRoutesRouter';
import { ProxyRouterI } from './Proxy/ProxyRouterI';
import { SNICallbackFactory } from './Utils/SNICallbackFactory';
import { ConsoleLoggerFactory, LogLevel, Logger, LoggerInterface } from '@jbuncle/logging-js';


/**
 * Get error message for HTTP status code.
 *
 * @param errorCode 
 * @returns 
 */
function getErrorMessage(errorCode: number): string {
	switch (errorCode) {
		case 400:
			return "Bad Request";
		case 401:
			return "Unauthorized";
		case 403:
			return "Forbidden";
		case 404:
			return "Not Found";
		case 500:
			return "Internal Server Error";
		default:
			return "Unknown Error";
	}
}

const modSecurityErrorMiddleware = (err, req, res, next) => {

	// Handle ModSecurity errors
	if (err instanceof InterventionError) {
		console.warn(err.log);
		// TODO: check if 'pause' property needs handling...
		if (err.url !== null) {
			res.redirect(err.url);
			res.end();
			return;
		}

		res.status(err.status);
		res.send(getErrorMessage(err.status));
		res.end();
		return;
	}
	next(err);
};
const errorMiddleware = (err, req, res, next) => {
	// Everything else
	if (err) {
		console.error(err);
		res.status(500);
		res.send(getErrorMessage(500));
		res.end();
	}
};
export class App {


	private static getArgs(): Record<string, string> {
		// Get the arguments passed to the script
		const args = process.argv.slice(2);

		// Parse the arguments
		const options = {};
		args.forEach((arg) => {
			const [key, value] = arg.split('=');
			options[key.slice(2)] = value;
		});

		return options;
	}

	public static async main() {
		const logger: LoggerInterface = Logger.getLogger(`@jbuncle/pigeon-proxy-server/${App.name}`);
		logger.debug('Starting...');

		const args: Record<string, string> = App.getArgs();

		const staging: boolean = (args.stage) ? args.stage !== 'production' : true;
		const modSecurityLib: string | undefined = (args.modSecurityLib) ? args.modSecurityLib : findModSec();
		const modSecurityRules: string = (args.modSecurityRules) ? args.modSecurityRules : '/usr/local/modsecurity-rules/main.conf';

		const leCertDir: string = (args.leCertDir) ? args.leCertDir : '/etc/letsencrypt/live';
		const leAccountsDir: string = (args.leAccountsDir) ? args.leAccountsDir : '/etc/letsencrypt/accounts';
		const fixedRoutesFile: string = (args.fixedRoutesFile) ? args.fixedRoutesFile : undefined;

		// Setup LetsEncrypt Options
		const certOptions: CertMonitorOptions = new LetsEncryptUtils(leCertDir, leAccountsDir).getCertOptions();

		// Setup Express
		const app: express.Application = express();
		const sniCallback = new SNICallbackFactory(certOptions.keyFilePattern, certOptions.certFilePattern).create();
		const httpsServerOptions: ServerOptions = {
			// Define callback to handle certificate requests
			SNICallback: sniCallback
		};

		// Create the web servers
		const secureServer: HttpsServer<typeof IncomingMessage, typeof ServerResponse> = https.createServer(httpsServerOptions, app)
		const insecureServer: HttpServer<typeof IncomingMessage, typeof ServerResponse> = http.createServer(app);

		// Setup proxy
		const fileRoutesRouter: FileRoutesRouter = new FileRoutesRouter();
		if (fixedRoutesFile !== undefined) {
			logger.info('Loading routes from file', fixedRoutesFile);
			fileRoutesRouter.addFile(fixedRoutesFile);
		}

		const dockerMonitor: DockerMonitor = createDockerMonitor();

		// Setup Docker Router
		const dockerProxyRouter: DockerProxyRouter = new DockerProxyRouter();
		dockerProxyRouter.bind(dockerMonitor);


		// Load ModSecurity
		const modSecurityLoader: ModSecurityLoader = new ModSecurityLoader(modSecurityLib, modSecurityRules);
		modSecurityLoader.init();
		const modSecurityMiddleware = modSecurityLoader.createMiddleware();

		const certMonitor: CertMonitorI = (new CertMonitorFactory()).create(certOptions, staging, app);
		// Watch for container changes and update
		dockerMonitor.onChange((dockerInspects: DockerInspectI[]) => {
			const leDomains: Record<string, string> = (new LeDomainsProvider()).getDomains(dockerInspects);
			certMonitor.set(leDomains);
		});

		// Setup the reverse proxy
		const proxyRouter: ProxyRouterI = new AggregatedProxyRouter([fileRoutesRouter, dockerProxyRouter]);
		const proxyMiddleware = createProxyMiddleware({
			router: async (req: express.Request): Promise<string | undefined> => {
				const result: string = await proxyRouter.router(req);
				logger.debug(`Routing to ${result}`);
				return result;
			},
			logLevel: 'silent',
			changeOrigin: true,
			ws: true,
		} as Filter | Options);

		// Request logging
		app.use(morgan('combined'));

		// TODO: Setup caching
		app.use(new RequestCache().createMiddleware());

		// Setup WAF
		app.use(modSecurityMiddleware);

		// Setup proxying
		app.use(proxyMiddleware);

		// Handle ModSecurity errors
		app.use(modSecurityErrorMiddleware);

		// Handle general errors
		app.use(errorMiddleware);

		// Start up everything
		// Start monitoring letsencrypt certs
		certMonitor.start(1440);

		// Start monitoring docker containers
		dockerMonitor.start();

		insecureServer.listen(8080);
		secureServer.listen(8443);
	}

}
