import winston, { format, transports } from "winston";

const logFormat = format.printf((info) => {
    const metadata = info.metadata ? " " + JSON.stringify(info.metadata) : "";
    return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}${metadata}`;
});

export enum LogLevel {
    error = "error",
    warn = "warn",
    info = "info",
    verbose = "verbose",
    debug = "debug",
    silly = "silly"
}

export default class LogUtil {
    private static s_loggerNames: Set<string> = new Set<string>();
    private static s_logLevel: LogLevel = LogLevel.info;

    public static getLogger(moduleName: string = "DEFAULT"): winston.Logger {
        if (!winston.loggers.has(moduleName)) {
            winston.loggers.add(moduleName, {
                format: format.combine(
                    format.label({ label: moduleName }),
                    format.timestamp(),
                    logFormat,
                ),
                transports: [new transports.Console({
                    level: this.s_logLevel
                })]
            });

            this.s_loggerNames.add(moduleName);
        }

        return winston.loggers.get(moduleName);
    }

    public static setLogLevel(level: LogLevel, module?: string) {
        this.s_loggerNames.forEach(moduleName => {
            if (!module || module === moduleName) {
                const logger = winston.loggers.get(moduleName);
                logger.transports.forEach(transport => {
                    transport.level = level;
                });
            }
        });
    }
}
