#!/usr/bin/env node
import WPILibWSRomiRobot, { IOPinMode, IPinConfiguration } from "./romi-robot";
import { WPILibWSRobotEndpoint, WPILibWSServerConfig, WPILibWSClientConfig } from "wpilib-ws-robot";
import MockI2C from "./i2c/mock-i2c";
import I2CPromisifiedBus from "./i2c/i2c-connection";
import program from "commander";
import jsonfile from "jsonfile";

const DEFAULT_IO_CONFIGURATION: IPinConfiguration[] = [
    { pinNumber: 11, mode: IOPinMode.DIO },
    { pinNumber: 4, analogChannel: 6, mode: IOPinMode.ANALOG_IN },
    { pinNumber: 20, analogChannel: 2, mode: IOPinMode.ANALOG_IN },
    { pinNumber: 21, analogChannel: 3, mode: IOPinMode.PWM },
    { pinNumber: 22, analogChannel: 4, mode: IOPinMode.PWM }
];

// Set up command line options
program
    .version("0.0.1")
    .name("wpilibws-romi")
    .option("-c, --hardware-config <file>", "hardware configuration file")
    .option("-e, --endpoint-type <type>", "endpoint type (client/server)", "server")
    .option("-m, --mock-i2c", "Force the use of Mock I2C")
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

// If we are provided a config file, try reading it
let hardwareConfig: IPinConfiguration[] | undefined = undefined;

if (program.hardwareConfig !== undefined) {
    try {
        const portConfigsRaw: any = jsonfile.readFileSync(program.hardwareConfig);

        // check if the raw object we get back is an array
        if (portConfigsRaw instanceof Array) {
            const portConfigs: string[] = (portConfigsRaw as string[]);
            if (portConfigs.length < 5) {
                console.error("Invalid number of port configurations");
                process.exit(1);
            }

            hardwareConfig = DEFAULT_IO_CONFIGURATION;

            for (let i = 0; i < 5; i++) {
                let pinMode: IOPinMode;
                switch (portConfigs[i].toLowerCase()) {
                    case "pwm":
                        pinMode = IOPinMode.PWM;
                        break;
                    case "ain":
                        // Special case for first pin
                        if (i === 0) {
                            console.error("Invalid pin mode for external pin 0");
                            process.exit(1);
                        }
                        pinMode = IOPinMode.ANALOG_IN;
                        break;
                    case "dio":
                        pinMode = IOPinMode.DIO;
                        break;
                    default:
                        console.error("Invalid pin mode specified for pin " + i);
                        process.exit(1);
                }

                hardwareConfig[i].mode = pinMode;
            }
        }
        else {
            console.error("Config file should be defined as array of strings");
            process.exit(1);
        }
    }
    catch (err) {
        console.error("Error parsing config file: ", err);
    }
}

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

if (!program.mockI2c) {
    try {
        const HardwareI2C = require("./i2c/hw-i2c").default;
        i2cBus = new HardwareI2C(I2C_BUS_NUM);
    }
    catch (err) {
        console.log("Error creating hardware I2C: ", err.message);
        console.log("Falling back to MockI2C");
        i2cBus = new MockI2C(I2C_BUS_NUM);
    }
}
else {
    console.log("Requested to use mock I2C");
    i2cBus = new MockI2C(I2C_BUS_NUM);
}

const robot: WPILibWSRomiRobot = new WPILibWSRomiRobot(i2cBus, 0x14, hardwareConfig);

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
