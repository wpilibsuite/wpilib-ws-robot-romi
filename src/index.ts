#!/usr/bin/env node
import WPILibWSRomiRobot from "./romi-robot";
import { WPILibWSRobotEndpoint, WPILibWSServerConfig, WPILibWSClientConfig } from "wpilib-ws-robot";
import MockI2C from "./i2c/mock-i2c";
import I2CPromisifiedBus from "./i2c/i2c-connection";
import program from "commander";

// Set up command line options
program
    .version("0.0.1")
    .name("wpilibws-romi")
    .option("-e, --endpoint-type <type>", "endpoint type (client/server)", "server")
    .option("-p, --port <port>", "port to listen/connect to")
    .option("-h, --host <host>", "host to connect to (required for client)")
    .option("-u, --uri <uri>", "websocket URI")
    .helpOption("--help", "display help for command");

program.parse(process.argv);

// Sanity check
if (program.endpointType !== "client" && program.endpointType !== "server") {
    console.log("Supported endpoint types are 'client' or 'server'");
    program.help();
}

if (program.endpointType === "client" && program.host === undefined) {
    console.log("Host must be defined if running as a WPILib WS Client");
    program.help();
}

const endpointType = program.endpointType;

let endpointPort: number = 8080;
let endpointHost: string = "localhost";
let endpointUri: string = "/wpilibws";

if (program.port !== undefined) {
    endpointPort = parseInt(program.port, 10);
    if (isNaN(endpointPort)) {
        console.log("Invalid port number. Must be an integer");
        program.help();
    }
}

if (program.host !== undefined) {
    endpointHost = program.host;
}

if (program.uri !== undefined) {
    endpointUri = program.uri;
}

const I2C_BUS_NUM: number = 1;

// Set up the i2c bus out here
let i2cBus: I2CPromisifiedBus;
let endpoint: WPILibWSRobotEndpoint;

try {
    const HardwareI2C = require("./i2c/hw-i2c").default;
    i2cBus = new HardwareI2C(I2C_BUS_NUM);
}
catch (err) {
    console.log("Error creating hardware I2C: ", err.message);
    console.log("Falling back to MockI2C");
    i2cBus = new MockI2C(I2C_BUS_NUM);
}

const robot: WPILibWSRomiRobot = new WPILibWSRomiRobot(i2cBus, 0x14);

if (endpointType === "server") {
    const serverSettings: WPILibWSServerConfig = {
        port: endpointPort,
        uri: endpointUri
    };

    endpoint = WPILibWSRobotEndpoint.createServerEndpoint(robot, serverSettings);
    console.log(`Mode: Server, Port: ${endpointPort}, URI: ${endpointUri}`);
}
else {
    const clientSettings: WPILibWSClientConfig = {
        hostname: endpointHost,
        port: endpointPort,
        uri: endpointUri
    };

    endpoint = WPILibWSRobotEndpoint.createClientEndpoint(robot, clientSettings);
    console.log(`Mode: Client, Host: ${endpointHost}, Port: ${endpointPort}, URI: ${endpointUri}`);
}

endpoint.startP()
.then(() => {
    console.log(`Endpoint (${endpointType}) Started`);
});
