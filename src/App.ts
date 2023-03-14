import { DockerInspectI } from '@jbuncle/docker-api-js';
import { CertMonitorI } from '@jbuncle/letsencrypt-js';
import express from 'express';
import http from 'http';
import { Filter, Options, createProxyMiddleware } from 'http-proxy-middleware';
import https, { ServerOptions } from 'https';
import morgan from 'morgan';
import { CertMonitorFactory, CertMonitorOptions } from './LetsEncrypt/CertMonitorFactory';
import { LeDomainsProvider } from './LetsEncrypt/DockerDomainsProvider';
import { LetsEncryptUtils } from './LetsEncrypt/LetsEncryptUtil';
import { ModSecurityLoader } from './ModSecurity/ModSecurityLoader';
import { findModSec } from './ModSecurity/ModSecurityUtil';
import { AggregatedProxyRouter } from './Proxy/AggregatedProxyRouter';
import { DockerMonitor, createDockerMonitor } from './Proxy/DockerMonitor';
import { DockerProxyRouter } from './Proxy/DockerProxyRouter';
import { FixedRoutesRouter } from './Proxy/FixedRoutesRouter';
import { ProxyRouterI } from './Proxy/ProxyRouterI';
import { SNICallbackFactory } from './Utils/SNICallbackFactory';




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


		const app: express.Application = express();

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


		// Setup LetsEncrypt
		const certOptions: CertMonitorOptions = new LetsEncryptUtils(leCertDir, leAccountsDir).getCertOptions();
		// TODO: check lib and rules exists/accessible
		const modSecurityMiddleware = new ModSecurityLoader(modSecurityLib, modSecurityRules).createMiddleware();

		const certMonitor: CertMonitorI = (new CertMonitorFactory()).create(certOptions, staging, app);
		// Watch for container changes and update
		dockerMonitor.onChange((dockerInspects: DockerInspectI[]) => {
			const leDomains: Record<string, string> = (new LeDomainsProvider()).getDomains(dockerInspects);
			certMonitor.set(leDomains);
		});

		const sniCallback = new SNICallbackFactory(certOptions.keyFilePattern, certOptions.certFilePattern).create();
		const httpsServerOptions: ServerOptions = {
			// Define callback to handle certificate requests
			SNICallback: sniCallback
		};

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

		// Hide errors
		app.use((err, req, res, next) => {
			if (err) {
				res.status(500).send('Something went wrong');
			}
			try {
				next(err);
				res.status(500).send('Something went wrong');
			} catch (e) {
				console.error(e);
			}
		});

		// Request logging
		app.use(morgan('combined'));
		// Setup WAF
		app.use(modSecurityMiddleware);

		app.use(proxyMiddleware);

		// Setup caching
		// TODO
		// Start up everything
		// Start monitoring letsencrypt certs
		certMonitor.start(1440);

		// Start monitoring docker containers
		dockerMonitor.start();

		// Start the web servers
		https.createServer(httpsServerOptions, app).listen(8443);
		http.createServer(app).listen(8080);

	}
}
