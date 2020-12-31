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

    private _statusActions: Map<string, () => void> = new Map<string, () => void>();
    private _statusAccessors: Map<string, () => any> = new Map<string, () => any>();
    private _imuActions: Map<string, () => void> = new Map<string, () => void>();
    private _imuStatusAccessors: Map<string, () => any> = new Map<string, () => any>();

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
        });

        this._app.get("/imu/status", (req, res) => {
            const data: AllStatusResponse = {};
            this._imuStatusAccessors.forEach((valueProducer, accessorName) => {
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

    public addStatusAction(actionName: string, actionFunc: () => void) {
        if (this._statusActions.has(actionName)) {
            return;
        }

        this._statusActions.set(actionName, actionFunc);
        this._app.post(`/${actionName}`, (req, res) => {
            actionFunc();
            res.status(200).send({});
        });
    }

    public addIMUAction(actionName: string, actionFunc: () => void) {
        if (this._imuActions.has(actionName)) {
            return;
        }

        this._imuActions.set(actionName, actionFunc);
        this._app.post(`/imu/${actionName}`, (req, res) => {
            actionFunc();
            res.status(200).send({});
        });
    }

    public addIMUStatusQuery(accessorName: string, valueProducer: () => any) {
        if (this._imuStatusAccessors.has(accessorName)) {
            return;
        }

        this._imuStatusAccessors.set(accessorName, valueProducer);
        this._app.get(`/imu/status/${accessorName}`, (req, res) => {
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

    public getEndpoints(): string[] {
        const list: string[] = [];

        this._statusAccessors.forEach((valProducer, accessorName) => {
            list.push(`GET /status/${accessorName}`);
        });

        this._statusActions.forEach((actionFunc, actionName) => {
            list.push(`POST /${actionName}`);
        });

        this._imuStatusAccessors.forEach((valProducer, accessorName) => {
            list.push(`GET /imu/status/${accessorName}`);
        });

        this._imuActions.forEach((actionFunc, actionName) => {
            list.push(`POST /imu/${actionName}`);
        });

        return list;
    }
}
