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
import { middleware } from './ModSecurity/ModSecurityLoader';
import { AggregatedProxyRouter } from './Proxy/AggregatedProxyRouter';
import { DockerMonitor, createDockerMonitor } from './Proxy/DockerMonitor';
import { DockerProxyRouter } from './Proxy/DockerProxyRouter';
import { ProxyRouter } from './Proxy/ProxyRouter';
import { ProxyRouterI } from './Proxy/ProxyRouterI';
import { SNICallbackFactory } from './Utils/SNICallbackFactory';


const app: express.Application = express();

// Setup proxy
const fixedProxyRouter: ProxyRouter = new ProxyRouter();
fixedProxyRouter.addRoute('example.com', 'http://localhost:3000');

const dockerMonitor: DockerMonitor = createDockerMonitor();

// Setup Docker Router
const dockerProxyRouter: DockerProxyRouter = new DockerProxyRouter();
dockerProxyRouter.bind(dockerMonitor)


// Setup LetsEncrypt
const certOptions: CertMonitorOptions = (new LetsEncryptUtils('/tmp/letsencrypt')).getCertOptions();
// TODO: check environment
const staging: boolean = true;
const certMonitor: CertMonitorI = (new CertMonitorFactory()).create(certOptions, staging, app);
// Watch for container changes and update
dockerMonitor.onChange((dockerInspects: DockerInspectI[]) => {
	const leDomains: Record<string, string> = (new LeDomainsProvider()).getDomains(dockerInspects);
	certMonitor.set(leDomains);
});

const sniCallback = new SNICallbackFactory(certOptions.keyFilePattern, certOptions.certFilePattern).create()
const httpsServerOptions: ServerOptions = {
	// Define callback to handle certificate requests
	SNICallback: sniCallback
};

// Setup the reverse proxy
const proxyRouter: ProxyRouterI = new AggregatedProxyRouter([fixedProxyRouter, dockerProxyRouter]);
const proxyMiddleware = createProxyMiddleware({
	router: async (req: express.Request): Promise<string | undefined> => {
		const result: string = await proxyRouter.router(req)
		console.log(`routing to ${result}`,);
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

app.use(proxyMiddleware);

// Start up everything

// Start monitoring letsencrypt certs
certMonitor.start(1440);

// Start monitoring docker containers
dockerMonitor.start();

// Start the web servers
https.createServer(httpsServerOptions, app).listen(8443);
http.createServer(app).listen(8080);
