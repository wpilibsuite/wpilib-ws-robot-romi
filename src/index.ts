#!/usr/bin/env node
import fs from "fs";
import path from "path";
import WPILibWSRomiRobot from "./romi-robot";
import { WPILibWSRobotEndpoint, WPILibWSServerConfig, WPILibWSClientConfig } from "@wpilib/wpilib-ws-robot";
import MockI2C from "./i2c/mock-i2c";
import I2CPromisifiedBus from "./i2c/i2c-connection";
import program from "commander";
import ServiceConfiguration, { EndpointType } from "./service-config";
import RomiConfiguration from "./romi-config";
import ProgramArguments from "./program-arguments";
import MockRomiI2C from "./mocks/mock-romi";
import { FIRMWARE_IDENT } from "./romi-shmem-buffer";
import RestInterface from "./rest-interface/rest-interface";
import MockRomiImu from "./mocks/mock-imu";
import GyroCalibrationUtil from "./gyro-calibration-util";
import DSServer from "./ds-interface/ds-ip-server";

let packageVersion: string = "0.0.0";

const packageJsonPath = path.resolve(__dirname, "../package.json");

try {
    // Read in package.json to get version information
    const packageJsonContents = fs.readFileSync(packageJsonPath);
    const packageJsonObj = JSON.parse(packageJsonContents.toString());
    if (packageJsonObj.version !== undefined) {
        packageVersion = packageJsonObj.version;
    }
}
catch (e) {
    console.error("Error reading package.json: ", e);
}

// Set up command line options
program
    .version(packageVersion)
    .name("wpilibws-romi")
    .option("-c, --config <file>", "configuration file")
    .option("-e, --endpoint-type <type>", "endpoint type (client/server)", "server")
    .option("-m, --mock-i2c", "Force the use of Mock I2C")
    .option("-p, --port <port>", "port to listen/connect to")
    .option("-h, --host <host>", "host to connect to (required for client)")
    .option("-u, --uri <uri>", "websocket URI")
    .helpOption("--help", "display help for command");

program.parse(process.argv);

console.log(`Version: ${packageVersion}`);

let serviceConfig: ServiceConfiguration;
let romiConfig: RomiConfiguration;

try {
    serviceConfig = new ServiceConfiguration(program as ProgramArguments);
}
catch (err) {
    console.log(err.message);
    process.exit();
}

try {
    romiConfig = new RomiConfiguration(program as ProgramArguments);
}
catch (err) {
    romiConfig = new RomiConfiguration();
    console.log("[CONFIG] Error loading romi configuration")
    console.log(err.message);
    console.log("[CONFIG] Falling back to defaults");
}

const I2C_BUS_NUM: number = 1;

// Set up the i2c bus out here
let i2cBus: I2CPromisifiedBus;
let endpoint: WPILibWSRobotEndpoint;

if (!serviceConfig.forceMockI2C) {
    try {
        const HardwareI2C = require("./i2c/hw-i2c").default;
        i2cBus = new HardwareI2C(I2C_BUS_NUM);
    }
    catch (err) {
        console.log("[I2C] Error creating hardware I2C: ", err.message);
        console.log("[I2C] Falling back to MockI2C");
        i2cBus = new MockI2C(I2C_BUS_NUM);

        const mockRomi: MockRomiI2C = new MockRomiI2C(0x14);
        mockRomi.setFirmwareIdent(FIRMWARE_IDENT);
        (i2cBus as MockI2C).addDeviceToBus(mockRomi);

        const mockImu: MockRomiImu = new MockRomiImu(0x6B);
        (i2cBus as MockI2C).addDeviceToBus(mockImu);
    }
}
else {
    console.log("[I2C] Requested to use mock I2C");
    i2cBus = new MockI2C(I2C_BUS_NUM);
    const mockRomi: MockRomiI2C = new MockRomiI2C(0x14);
    mockRomi.setFirmwareIdent(FIRMWARE_IDENT);
    (i2cBus as MockI2C).addDeviceToBus(mockRomi);

    const mockImu: MockRomiImu = new MockRomiImu(0x6B);
    (i2cBus as MockI2C).addDeviceToBus(mockImu);
}

console.log(`[CONFIG] External Pins: ${romiConfig.pinConfigurationString}`);

const robot: WPILibWSRomiRobot = new WPILibWSRomiRobot(i2cBus, 0x14, romiConfig);

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

// Set up the gyro calibration util
const gyroCalibrationUtil: GyroCalibrationUtil = new GyroCalibrationUtil(robot.getIMU());

// Set up the REST interface
const restInterface: RestInterface = new RestInterface();
restInterface.addStatusQuery("service-version", () => {
    return {
        serviceVersion: packageVersion
    };
});

restInterface.addStatusQuery("firmware-status", () => {
    return {
        firmwareMatch: robot.firmwareIdent === FIRMWARE_IDENT
    };
});

restInterface.addStatusQuery("external-io-config", () => {
    return romiConfig.externalIOConfig.map(val => {
        return val.mode;
    });
});

restInterface.addStatusQuery("battery-status", () => {
    return {
        voltage: robot.getBatteryPercentage() * 9.0,
        percent: robot.getBatteryPercentage()
    };
});

restInterface.addIMUAction("calibrate", () => {
    gyroCalibrationUtil.calibrate();
});

restInterface.addIMUStatusQuery("calibration-state", () => {
    return {
        state: gyroCalibrationUtil.currentState,
        percentComplete: gyroCalibrationUtil.percentComplete,
        estimatedTimeLeft: gyroCalibrationUtil.estimatedTimeLeft
    };
});

restInterface.addIMUStatusQuery("last-gyro-calibration-values", () => {
    return {
        zeroOffset: gyroCalibrationUtil.lastZeroOffsetValue,
        noise: gyroCalibrationUtil.lastNoiseValue
    };
});

restInterface.addIMUStatusQuery("gyro-reading", () => {
    return robot.getIMU().gyroDPS;
});

restInterface.addIMUStatusQuery("accel-reading", () => {
    return robot.getIMU().accelerationG;
});

restInterface.addIMUStatusQuery("gyro-offset", () => {
    return robot.getIMU().gyroOffset;
});

const dsServer: DSServer = new DSServer();
dsServer.start();

robot.on("wsConnection", (remoteConnectionInfo) => {
    dsServer.updateRobotCodeIpV4Addr(remoteConnectionInfo.remoteAddrV4);
});

robot.on("wsNoConnections", () => {
    dsServer.updateRobotCodeIpV4Addr(null);
});

endpoint.startP()
.then(() => {
    console.log(`[SERVICE] Endpoint (${serviceConfig.endpointType}) Started`);
})
.then(() => {
    console.log("[REST-INTERFACE] Endpoints:");
    restInterface.getEndpoints().forEach(accessor => {
        console.log(`[REST-INTERFACE] ${accessor}`);
    });

    restInterface.start();
})
