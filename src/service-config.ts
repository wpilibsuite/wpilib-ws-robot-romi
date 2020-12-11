import ProgramArguments from "./program-arguments";

export enum EndpointType {
    CLIENT = "client",
    SERVER = "server"
};

export default class ServiceConfiguration {
    private _endpointType: EndpointType = EndpointType.SERVER;
    private _forceMockI2C: boolean = false;
    private _port: number = 3300;
    private _host: string = "localhost";
    private _uri: string = "/wpilibws";

    constructor(programArgs: ProgramArguments) {
        if (programArgs.endpointType !== "client" && programArgs.endpointType !== "server") {
            throw new Error("[CONFIG] Supported endpoint types are 'client' or 'server'");
        }

        if (programArgs.endpointType === "client" && programArgs.host === undefined) {
            throw new Error("[CONFIG] Host must be defined if running as a WPILib WS Client");
        }

        // Save our endpointType
        this._endpointType = (programArgs.endpointType === "client") ?
                                EndpointType.CLIENT : EndpointType.SERVER;

        if (programArgs.port !== undefined) {
            this._port = parseInt(programArgs.port, 10);
            if (isNaN(this._port)) {
                throw new Error("[CONFIG] Invalid port number. Must be an integer");
            }
        }

        if (programArgs.host !== undefined) {
            this._host = programArgs.host;
        }

        if (programArgs.uri !== undefined) {
            this._uri = programArgs.uri;
        }

        if (programArgs.mockI2c !== undefined) {
            this._forceMockI2C = programArgs.mockI2c;
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
