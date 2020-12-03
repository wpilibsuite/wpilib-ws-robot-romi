import express, {Request, Response} from "express";
import cors from "cors";
import { Server } from "http";

const DEFAULT_PORT: number = 9001;

export interface RestInterfaceConfig {
    port?: number;
}

interface AllStatusResponse {
    [key: string]: any;
}

export default class RestInterface {
    private _app: express.Express;
    private _server: Server;
    private _port: number;

    private _statusAccessors: Map<string, () => any> = new Map<string, () => any>();

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

        // Register the global `status` query, which provides an
        // all-in-one data dump of status
        this._app.get("/status", (req, res) => {
            const data: AllStatusResponse = {};
            this._statusAccessors.forEach((valueProducer, accessorName) => {
                data[accessorName] = valueProducer();
            });

            res.status(200).send(data);
        })
    }

    public addStatusQuery(accessorName: string, valueProducer: () => any) {
        if (this._statusAccessors.has(accessorName)) {
            return;
        }

        this._statusAccessors.set(accessorName, valueProducer);
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

        this._statusAccessors.forEach((valProducer, accessorName) => {
            list.push(`GET /status/${accessorName}`);
        });

        return list;
    }
}
