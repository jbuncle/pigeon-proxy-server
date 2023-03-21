import { ConsoleLoggerFactory, LogLevel, Logger } from '@jbuncle/logging-js';


Logger.setLoggerFactory(new ConsoleLoggerFactory(LogLevel.DEBUG, {
    '^@jbuncle/pigeon-proxy-server/ModSecurity$' : LogLevel.INFO,
    '^@jbuncle/pigeon-proxy-server/ModSecurityLoader$' : LogLevel.INFO,
    '^@jbuncle/pigeon-proxy-server/DockerProxyRouter$' : LogLevel.INFO,
    '^@jbuncle/pigeon-proxy-server/DockerMonitor$' : LogLevel.INFO,
    '^@jbuncle/pigeon-proxy-server/SNICallbackFactory$' : LogLevel.INFO,

}));


import { App } from './App';

App.main();