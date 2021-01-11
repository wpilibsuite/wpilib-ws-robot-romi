import program from "commander";
import { Socket } from "net";

program
    .name("ds-ip-monitor")
    .option("-t, --target <host/ip address>", "IP/Host to connect to", "localhost");

program.parse(process.argv);

console.log(program.target);

const socket: Socket = new Socket();
socket.connect(1742, program.target, () => {
    console.log("Connected to DS IP Server");
});

socket.on("data", (data) => {
    console.log("[DATA] ", data.toString());
    try {
        const ipNum: number = (JSON.parse(data.toString()).robotIP) as number;
        const buf = Buffer.alloc(4);
        buf.writeUInt32BE(ipNum);
        const ipNumSegments: number[] = [];

        for (let i = 0; i < 4; i++) {
            ipNumSegments[i] = buf.readUInt8(i);
        }

        console.log(`Current DS IP: ${ipNumSegments.join(".")}`);
    }
    catch(err) {}
});
