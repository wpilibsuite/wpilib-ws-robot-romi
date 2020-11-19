#!/usr/bin/env node
import WPILibWSRomiRobot, { IOPinMode, IPinConfiguration, DEFAULT_IO_CONFIGURATION, NUM_CONFIGURABLE_PINS } from "./romi-robot";
import { WPILibWSRobotEndpoint, WPILibWSServerConfig, WPILibWSClientConfig } from "@wpilib/wpilib-ws-robot";
import MockI2C from "./i2c/mock-i2c";
import I2CPromisifiedBus from "./i2c/i2c-connection";
import program from "commander";
import jsonfile from "jsonfile";

interface RomiConfiguration {
    ioConfig: string[]
};

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

// If we are provided a config file, try reading it. If this is undefined, the robot controller constructor will use
// its built in default mapping instead
let hardwareConfig: IPinConfiguration[] | undefined = undefined;
const ioPinModes: string[] = DEFAULT_IO_CONFIGURATION.map(val => (val.mode as string));

if (program.config !== undefined) {
    try {
        const romiConfig: RomiConfiguration = jsonfile.readFileSync(program.config);

        if (romiConfig && romiConfig.ioConfig && (romiConfig.ioConfig instanceof Array)) {
            const portConfigs: string[] = romiConfig.ioConfig;
            if (portConfigs.length !== NUM_CONFIGURABLE_PINS) {
                console.error("[CONFIG] Invalid number of IO port configurations.");
                process.exit(1);
            }

            // Copy over the default values
            hardwareConfig = [];
            DEFAULT_IO_CONFIGURATION.forEach(val => hardwareConfig.push(Object.assign({}, val)));

            for (let i = 0; i < NUM_CONFIGURABLE_PINS; i++) {
                let pinMode: IOPinMode;
                const incomingPinMode: string = portConfigs[i].toLowerCase();
                ioPinModes[i] = incomingPinMode;

                switch (incomingPinMode) {
                    case "pwm":
                        pinMode = IOPinMode.PWM;
                        break;
                    case "ain":
                        // Special case for first pin
                        if (i === 0) {
                            console.error("[CONFIG] Invalid mode for pin EXT 0");
                            process.exit(1);
                        }
                        pinMode = IOPinMode.ANALOG_IN;
                        break;
                    case "dio":
                        pinMode = IOPinMode.DIO;
                        break;
                    default:
                        console.error("[CONFIG] Invalid mode specified for pin EXT " + i);
                        process.exit(1);
                }

                hardwareConfig[i].mode = pinMode;
            }
        }
        else {
            // Fallback to defaults
            console.log("[CONFIG] Invalid or malformed configuration file.");
            process.exit(1);
        }
    }
    catch (err) {
        console.error("[CONFIG] Error parsing config file: ", err);
        process.exit(1);
    }
}

let endpointPort: number = 8080;
let endpointHost: string = "localhost";
let endpointUri: string = "/wpilibws";

if (program.port !== undefined) {
    endpointPort = parseInt(program.port, 10);
    if (isNaN(endpointPort)) {
        console.log("[CONFIG] Invalid port number. Must be an integer");
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
        console.log("[I2C] Error creating hardware I2C: ", err.message);
        console.log("[I2C] Falling back to MockI2C");
        i2cBus = new MockI2C(I2C_BUS_NUM);
    }
}
else {
    console.log("[I2C] Requested to use mock I2C");
    i2cBus = new MockI2C(I2C_BUS_NUM);
}

console.log(`[CONFIG] External Pin Configuration: ${ioPinModes}`);

const robot: WPILibWSRomiRobot = new WPILibWSRomiRobot(i2cBus, 0x14, hardwareConfig);

if (endpointType === "server") {
    const serverSettings: WPILibWSServerConfig = {
        port: endpointPort,
        uri: endpointUri
    };

    endpoint = WPILibWSRobotEndpoint.createServerEndpoint(robot, serverSettings);
    console.log(`[CONFIG] Mode: Server, Port: ${endpointPort}, URI: ${endpointUri}`);
}
else {
    const clientSettings: WPILibWSClientConfig = {
        hostname: endpointHost,
        port: endpointPort,
        uri: endpointUri
    };

    endpoint = WPILibWSRobotEndpoint.createClientEndpoint(robot, clientSettings);
    console.log(`[CONFIG] Mode: Client, Host: ${endpointHost}, Port: ${endpointPort}, URI: ${endpointUri}`);
}

endpoint.startP()
.then(() => {
    console.log(`Endpoint (${endpointType}) Started`);
});
