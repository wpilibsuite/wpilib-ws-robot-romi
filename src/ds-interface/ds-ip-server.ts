import { Server, Socket } from "net";
import { Address4 } from "ip-address";

const DS_IP_INTERFACE_PORT: number = 1742;

export default class DSServer {
    private _ipAddrString: string = "";
    private _ipAddrNum: number = 0;

    private _server: Server;

    private _activeSockets: Socket[] = [];

    public updateRobotCodeIpV4Addr(newIp: string | null): void {
        if (newIp !== this._ipAddrString) {
            if (newIp === null) {
                this._ipAddrString = "";
                this._ipAddrNum = 0;
            }
            else {
                if (!Address4.isValid(newIp)) {
                    console.log("[DS-INTERFACE] Invalid IP address provided");
                    return;
                }

                this._ipAddrString = newIp;
                const addr = new Address4(newIp);
                const addrArray = addr.toArray();
                const addrNum = (addrArray[0] << 24) |
                                (addrArray[1] << 16) |
                                (addrArray[2] << 8) |
                                addrArray[3];
                this._ipAddrNum = addrNum;
            }

            this._informAllClients();
        }
    }

    public start() {
        this._server = new Server((socket) => {
            this._activeSockets.push(socket);
            this._informClient(socket);

            socket.once("close", (hadError) => {
                for (let i = 0; i < this._activeSockets.length; i++) {
                    if (this._activeSockets[i] === socket) {
                        console.log("[DS-INTERFACE] Socket removed");
                        this._activeSockets.splice(i, 1);
                        break;
                    }
                }
            });
        });

        this._server.listen(DS_IP_INTERFACE_PORT);
    }

    public stop() {
        if (this._server && this._server.listening) {
            console.log("[DS-INTERFACE] Server Closing");
            this._server.close();
            this._server = undefined;
        }
    }

    private _informAllClients() {
        this._activeSockets.forEach(socket => {
            this._informClient(socket);
        });
    }

    private _informClient(socket: Socket) {
        socket.write(`{"robotIP":${this._ipAddrNum}}\n`);
    }
}
