import { DockerInspectI } from '@jbuncle/docker-api-js';
import { CertMonitorEvent, CertMonitorI } from '@jbuncle/letsencrypt-js';
import express from 'express';
import fs, { mkdirSync } from 'fs';
import http from 'http';
import { createProxyMiddleware, Filter, Options } from 'http-proxy-middleware';
import https from 'https';
import morgan from 'morgan';
import path from 'path';
import tls, { SecureContext, SecureContextOptions } from 'tls';
import { CertMonitorFactory, CertMonitorOptions } from './LetsEncrypt/CertMonitorFactory';
import { LeDomainsProvider } from './LetsEncrypt/DockerDomainsProvider';
import { AggregatedProxyRouter } from './Proxy/AggregatedProxyRouter';
import { DockerMonitor, createDockerMonitor } from './Proxy/DockerMonitor';
import { DockerProxyRouter } from './Proxy/DockerProxyRouter';
import { ProxyRouter } from './Proxy/ProxyRouter';
import { ProxyRouterI } from './Proxy/ProxyRouterI';
import { format } from "util";
import { middleware } from './ModSecurity/ModSecurityLoader';


const app: express.Application = express();

// Setup proxy
const fixedProxyRouter: ProxyRouter = new ProxyRouter();
fixedProxyRouter.addRoute('example.com', 'http://localhost:3000');

const dockerMonitor: DockerMonitor = createDockerMonitor();

// Setup Docker Router
const dockerProxyRouter: DockerProxyRouter = new DockerProxyRouter();
dockerProxyRouter.bind(dockerMonitor)

function getCertOptions() {
	const leBaseDir: string = '/tmp/letsencrypt';
	if (!fs.existsSync(leBaseDir)) {
		mkdirSync(leBaseDir);
	}

	const certificateDir: string = path.resolve(leBaseDir, 'certs');
	if (!fs.existsSync(certificateDir)) {
		mkdirSync(certificateDir);
	}

	const accountsDir: string = path.resolve(leBaseDir, 'accounts');
	if (!fs.existsSync(accountsDir)) {
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

// Setup LetsEncrypt
const certOptions: CertMonitorOptions = getCertOptions();

const staging: boolean = true;
const certMonitor: CertMonitorI = (new CertMonitorFactory()).create(certOptions, staging, app);
certMonitor.on(CertMonitorEvent.ERROR, (e) => {
	console.error(e);
});
certMonitor.on(CertMonitorEvent.SKIPPED, (domain: string) => {
	console.log('Skipped', domain);
});
certMonitor.on(CertMonitorEvent.GENERATED, (domain: string) => {
	console.log('Generated', domain);
});


certMonitor.start(1440);
dockerMonitor.onChange((dockerInspects: DockerInspectI[]) => {
	const leDomains: Record<string, string> = (new LeDomainsProvider()).getDomains(dockerInspects);
	certMonitor.set(leDomains);
});

// Create handler to allow domain (CName) specific certificates
const getCertificate = async (hostname, callback) => {
	// TODO: default cert?

	// TODO: check inputs including domain/CName

	const keyPath: string = format(certOptions.keyFilePattern, path.basename(hostname));
	const certPath: string = format(certOptions.certFilePattern, path.basename(hostname));

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
		const secureContext: SecureContext = tls.createSecureContext(certificate);
		callback(null, secureContext);
	} catch (e) {
		console.error(e);
		callback(e, null);
	}
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

// Start monitoring docker containers
dockerMonitor.start();

// Start the web servers
https.createServer({
	// Define callback to handle certificate requests
	SNICallback: getCertificate
}, app).listen(8443);
http.createServer(app).listen(8080);
