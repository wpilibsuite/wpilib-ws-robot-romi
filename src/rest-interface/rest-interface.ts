import express, {Request, Response} from "express";
import cors from "cors";
import { Server } from "http";

const DEFAULT_PORT: number = 9001;

export interface RestInterfaceConfig {
    port?: number;
}

export default class RestInterface {
    private _app: express.Express;
    private _server: Server;
    private _port: number;

    private _statusAccessors: Set<string> = new Set<string>();

    constructor(config?: RestInterfaceConfig) {
        this._port = DEFAULT_PORT;

        if (config) {
            if (config.port !== undefined) {
                this._port = config.port;
            }
        }

        const app = this._app = express();
        app.use(express.json());
        app.use(cors());
    }

    public addStatusQuery(accessorName: string, valueProducer: () => any) {
        if (this._statusAccessors.has(accessorName)) {
            return;
        }

        this._statusAccessors.add(accessorName);
        this._app.get(`/status/${accessorName}`, (req, res) => {
            res.status(200).send(valueProducer());
        });
    }

    public start() {
        this._server = this._app.listen(this._port, () => {
            console.log(`[REST-INTERFACE] Server listening on port ${this._port}`);
        });
    }

    public stop() {
        if (this._server) {
            console.log("[REST-INTERFACE] Server Closing");
            this._server.close();
            this._server = undefined;
        }
    }

    public getAccessorList(): string[] {
        const list: string[] = [];

        this._statusAccessors.forEach(val => {
            list.push(`GET /status/${val}`);
        });

        return list;
    }
}
