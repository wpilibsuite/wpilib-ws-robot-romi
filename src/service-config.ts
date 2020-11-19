import { CommanderStatic } from "commander";

export enum EndpointType {
    CLIENT = "client",
    SERVER = "server"
};

export default class ServiceConfiguration {
    private _endpointType: EndpointType = EndpointType.SERVER;
    private _forceMockI2C: boolean = false;
    private _port: number = 8080;
    private _host: string = "localhost";
    private _uri: string = "/wpilibws";

    constructor(program: CommanderStatic) {
        if (program.endpointType !== "client" && program.endpointType !== "server") {
            throw new Error("[CONFIG] Supported endpoint types are 'client' or 'server'");
        }

        if (program.endpointType === "client" && program.host === undefined) {
            throw new Error("[CONFIG] Host must be defined if running as a WPILib WS Client");
        }

        // Save our endpointType
        this._endpointType = (program.endpointType === "client") ?
                                EndpointType.CLIENT : EndpointType.SERVER;

        if (program.port !== undefined) {
            this._port = parseInt(program.port, 10);
            if (isNaN(this._port)) {
                throw new Error("[CONFIG] Invalid port number. Must be an integer");
            }
        }

        if (program.host !== undefined) {
            this._host = program.host;
        }

        if (program.uri !== undefined) {
            this._uri = program.uri;
        }
    }

    public get endpointType(): EndpointType {
        return this._endpointType;
    }

    public get forceMockI2C(): boolean {
        return this._forceMockI2C;
    }

    public get port(): number {
        return this._port;
    }

    public get host(): string {
        return this._host;
    }

    public get uri(): string {
        return this._uri;
    }
}
