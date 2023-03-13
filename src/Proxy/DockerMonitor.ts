import { DockerContainerI, DockerContainers, DockerEventOptionsI, DockerEvents, DockerInspect, DockerInspectI, DockerSocket } from "@jbuncle/docker-api-js";
import EventEmitter from "events";


export function createDockerMonitor(): DockerMonitor {
    const dockerSocket: DockerSocket = new DockerSocket();
    const dockerInspect: DockerInspect = new DockerInspect(dockerSocket);
    const dockerContainers: DockerContainers = new DockerContainers(dockerSocket);
    const dockerEvents: DockerEvents = new DockerEvents(dockerSocket);

    return new DockerMonitor(dockerEvents, dockerInspect, dockerContainers);
}

export class DockerMonitor {

    private readonly containers: Record<string, DockerInspectI> = {};


    public constructor(
        private readonly dockerEvents: DockerEvents,
        private readonly dockerInspect: DockerInspect,
        private readonly dockerContainers: DockerContainers
    ) {
    }

    private isStarted: boolean = false;

    public start() {
        if (this.isStarted) {
            console.warn('Already started');
        }
        this.isStarted = true;
        this.bindToDocker();
        this.detectChanges();
    }

    private bindToDocker(): void {
        const eventsOptions: DockerEventOptionsI = {
            filters: {
                container: [],
                event: [`start`, `stop`,],
                type: [`container`],
            }
        };

        this.dockerEvents.connect(() => {
            this.detectChanges();
        }, (e: Error) => {
            throw e;
        }, eventsOptions);
    }


    private updateLock: boolean = false;

    private async detectChanges() {
        if (!this.isStarted) {
            throw new Error('Not started')
        }

        // Prevent updating multiple times at the same time
        if (this.updateLock === true) {
            return;
        }
        try {
            const containers: Record<string, DockerInspectI> = {};
            this.updateLock = true;
            const inspectInfos: DockerInspectI[] = await this.inspectRunningContainers();

            for (const inspectInfo of inspectInfos) {

                const containerId: string = inspectInfo.Id;
                containers[containerId] = inspectInfo;
            }

            const newKeys = this.difference(containers, this.containers);
            const oldKeys = this.difference(this.containers, containers);

            for (const newKey of newKeys) {
                this.add(newKey, containers[newKey]);
            }
            for (const oldKey of oldKeys) {
                this.remove(oldKey);
            }
        } finally {
            this.updateLock = false;
        }
    }

    private readonly eventEmitter = new EventEmitter();

    private static readonly EVENT_CHANGE = 'change';


    public getRunningContainers(): DockerInspectI[] {
        return Object.values(this.containers);
    }

    public onChange(callback: (inspect: DockerInspectI[]) => void): void {
        this.eventEmitter.on(DockerMonitor.EVENT_CHANGE, callback);
    }


    private add(containerId: string, inspect: DockerInspectI): void {
        console.log('Started/existing container', containerId);
        this.containers[containerId] = Object.freeze(inspect);
        this.eventEmitter.emit(DockerMonitor.EVENT_CHANGE, this.getRunningContainers());
    }

    private remove(containerId: string) {
        console.log('Stopped container', containerId);
        delete this.containers[containerId];
        this.eventEmitter.emit(DockerMonitor.EVENT_CHANGE, this.getRunningContainers());
    }

    private difference(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
        const intersectingKeys = [];
        for (const key in a) {
            // If key is not in the second object
            if (!Object.prototype.hasOwnProperty.call(b, key)) {
                intersectingKeys.push(key);
            }
        }

        return intersectingKeys;
    }

    private async inspectRunningContainers(): Promise<DockerInspectI[]> {
        const containerInfo: DockerContainerI[] = await this.dockerContainers.list();
        return this.inspectContainers(containerInfo);
    }

    private async inspectContainers(containerInfo: DockerContainerI[]): Promise<DockerInspectI[]> {
        // Convert to container objects
        const containers: string[] = containerInfo.map((theContainerInfo: DockerContainerI) => {
            return theContainerInfo.Id;
        });
        // Invoke inspect on contaienrs
        const dockerInspect: Promise<DockerInspectI>[] = containers.map(async (containerId: string): Promise<DockerInspectI> => {
            return this.dockerInspect.inspect(containerId);
        });
        // Wait for all "inspect" lookups to complete
        return Promise.all(dockerInspect);
    }

}