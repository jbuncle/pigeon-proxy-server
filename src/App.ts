import { DockerInspectI } from '@jbuncle/docker-api-js';
import { CertMonitorI } from '@jbuncle/letsencrypt-js';
import express from 'express';
import http, { Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { Filter, Options, createProxyMiddleware } from 'http-proxy-middleware';
import https, { Server as HttpsServer, ServerOptions } from 'https';
import morgan from 'morgan';
import { CertMonitorFactory, CertMonitorOptions } from './LetsEncrypt/CertMonitorFactory';
import { LeDomainsProvider } from './LetsEncrypt/DockerDomainsProvider';
import { LetsEncryptUtils } from './LetsEncrypt/LetsEncryptUtil';
import { InterventionError } from './ModSecurity/InterventionError';
import { ModSecurityLoader } from './ModSecurity/ModSecurityLoader';
import { findModSec } from './ModSecurity/ModSecurityUtil';
import { AggregatedProxyRouter } from './Proxy/AggregatedProxyRouter';
import { DockerMonitor, createDockerMonitor } from './Proxy/DockerMonitor';
import { DockerProxyRouter } from './Proxy/DockerProxyRouter';
import { FixedRoutesRouter } from './Proxy/FixedRoutesRouter';
import { ProxyRouterI } from './Proxy/ProxyRouterI';
import { SNICallbackFactory } from './Utils/SNICallbackFactory';
import { RequestCache } from './Caching/RequestCache';

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
		const fixedProxyRouter: FixedRoutesRouter = new FixedRoutesRouter();
		if (fixedRoutesFile !== undefined) {
			console.log('Loading routes from file', fixedRoutesFile);
			await fixedProxyRouter.addRoutesFromFile(fixedRoutesFile);
			console.log(fixedProxyRouter.getRoutes());
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
		const proxyRouter: ProxyRouterI = new AggregatedProxyRouter([fixedProxyRouter, dockerProxyRouter]);
		const proxyMiddleware = createProxyMiddleware({
			router: async (req: express.Request): Promise<string | undefined> => {
				const result: string = await proxyRouter.router(req);
				console.log(`routing to ${result}`);
				return result;
			},
			logLevel: 'silent',
			changeOrigin: true,
			onError: (err) => {
				throw err;
				console.error(err);
				// res.status(500).send('Something went wrong');
			},
		} as Filter | Options);

		// Request logging
		app.use(morgan('combined'));

		// TODO: Setup caching
		app.use(new RequestCache().createMiddleware());

		// Setup WAF
		app.use(modSecurityMiddleware);

		app.use(proxyMiddleware);

		// Handle errors
		app.use((err, req, res, next) => {

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
				res.send(App.getErrorMessage(err.status));
				res.end();
				return;
			}

			// Everything else
			if (err) {
				console.error(err);
				res.status(500);
				res.send(App.getErrorMessage(500));
				res.end();
			}
		});

		// Setup caching
		// TODO
		// Start up everything
		// Start monitoring letsencrypt certs
		certMonitor.start(1440);

		// Start monitoring docker containers
		dockerMonitor.start();

		insecureServer.listen(8080);
		secureServer.listen(8443);
	}



	/**
	 * Get error message for HTTP status code.
	 *
	 * @param errorCode 
	 * @returns 
	 */
	private static getErrorMessage(errorCode: number): string {
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
}
