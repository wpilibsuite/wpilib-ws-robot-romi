#!/usr/bin/env node
import WPILibWSRomiRobot from "./romi-robot";
import { WPILibWSRobotEndpoint, WPILibWSServerConfig, WPILibWSClientConfig } from "@wpilib/wpilib-ws-robot";
import MockI2C from "./i2c/mock-i2c";
import I2CPromisifiedBus from "./i2c/i2c-connection";
import program from "commander";
import ServiceConfiguration, { EndpointType } from "./service-config";
import RomiConfiguration from "./romi-config";

// Set up command line options
program
    .version("0.0.1")
    .name("wpilibws-romi")
    .option("-c, --config <file>", "configuration file")
    .option("-e, --endpoint-type <type>", "endpoint type (client/server)", "server")
    .option("-m, --mock-i2c", "Force the use of Mock I2C")
    .option("-p, --port <port>", "port to listen/connect to")
    .option("-h, --host <host>", "host to connect to (required for client)")
    .option("-u, --uri <uri>", "websocket URI")
    .helpOption("--help", "display help for command");

program.parse(process.argv);

let serviceConfig: ServiceConfiguration;
let romiConfig: RomiConfiguration;

try {
    serviceConfig = new ServiceConfiguration(program);
    romiConfig = new RomiConfiguration(program);
}
catch (err) {
    console.log(err.message);
    process.exit();
}

const I2C_BUS_NUM: number = 1;

// Set up the i2c bus out here
let i2cBus: I2CPromisifiedBus;
let endpoint: WPILibWSRobotEndpoint;

if (!program.mockI2c) {
    try {
        const HardwareI2C = require("./i2c/hw-i2c").default;
        i2cBus = new HardwareI2C(I2C_BUS_NUM);
    }
    catch (err) {
        console.log("[I2C] Error creating hardware I2C: ", err.message);
        console.log("[I2C] Falling back to MockI2C");
        i2cBus = new MockI2C(I2C_BUS_NUM);
    }
}
else {
    console.log("[I2C] Requested to use mock I2C");
    i2cBus = new MockI2C(I2C_BUS_NUM);
}

console.log(`[CONFIG] External Pins: ${romiConfig.pinConfigurationString}`);

const robot: WPILibWSRomiRobot = new WPILibWSRomiRobot(i2cBus, 0x14, romiConfig.externalIOConfig);

if (serviceConfig.endpointType === EndpointType.SERVER) {
    const serverSettings: WPILibWSServerConfig = {
        port: serviceConfig.port,
        uri: serviceConfig.uri
    };

    endpoint = WPILibWSRobotEndpoint.createServerEndpoint(robot, serverSettings);
    console.log(`[CONFIG] Mode: Server, Port: ${serviceConfig.port}, URI: ${serviceConfig.uri}`);
}
else {
    const clientSettings: WPILibWSClientConfig = {
        hostname: serviceConfig.host,
        port: serviceConfig.port,
        uri: serviceConfig.uri
    };

    endpoint = WPILibWSRobotEndpoint.createClientEndpoint(robot, clientSettings);
    console.log(`[CONFIG] Mode: Client, Host: ${serviceConfig.host}, Port: ${serviceConfig.port}, URI: ${serviceConfig.uri}`);
}

endpoint.startP()
.then(() => {
    console.log(`[SERVICE] Endpoint (${serviceConfig.endpointType}) Started`);
});
